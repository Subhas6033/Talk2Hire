import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const WEBRTC_CONNECT_TIMEOUT_MS = 15000;

const MobileCameraPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("interviewId");
  const userId = searchParams.get("userId");

  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [connectionState, setConnectionState] = useState("idle");

  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const connectTimeoutRef = useRef(null);
  const offerSentRef = useRef(false); // prevent duplicate offers on reconnect

  // ── Socket setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || !userId) {
      setError("Invalid mobile camera link. Please scan the QR code again.");
      return;
    }

    const socket = io(SOCKET_URL, {
      query: {
        interviewId: sessionId,
        userId,
        // Keep type="settings" — server uses this to prevent Deepgram/TTS/face
        // detection from running on the mobile socket. The server relays WebRTC
        // signaling from the settings room to the interview room.
        type: "settings",
      },
      transports: ["websocket", "polling"],
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("📱 Mobile socket connected:", socket.id);
      setIsConnected(true);
    });

    // Receive answer from desktop
    socket.on("webrtc_answer", async (data) => {
      console.log("📱 Received WebRTC answer from desktop");
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: data.type, sdp: data.sdp }),
        );
        console.log("📱 Remote description set successfully");
      } catch (err) {
        console.error("📱 Error setting remote description:", err);
        handleWebRTCFailure("Failed to set remote description: " + err.message);
      }
    });

    // Receive ICE candidates from desktop
    socket.on("webrtc_ice_candidate", async (data) => {
      // fromMobile=true means it's our own candidate echoed back — skip it
      if (data.fromMobile === true) return;
      const pc = peerConnectionRef.current;
      if (!pc || !data.candidate) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.warn("📱 ICE candidate error:", err.message);
      }
    });

    socket.on("connect_error", (err) => {
      console.error("📱 Socket error:", err.message);
      setError("Failed to connect to server. Check your internet connection.");
    });

    socket.on("disconnect", (reason) => {
      console.log("📱 Socket disconnected:", reason);
      setIsConnected(false);
    });

    return () => {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      closePeerConnection();
      if (cameraStreamRef.current)
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      socket.disconnect();
    };
  }, [sessionId, userId]); // eslint-disable-line

  // ── Start camera + WebRTC once socket connects ────────────────────────────
  useEffect(() => {
    if (!isConnected || cameraGranted) return;
    requestCameraAndStartWebRTC();
  }, [isConnected]); // eslint-disable-line

  async function requestCameraAndStartWebRTC() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      cameraStreamRef.current = stream;
      setCameraGranted(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => {
          if (e.name !== "AbortError") console.error(e);
        });
      }

      // Notify server that mobile camera is connected (for secondary_camera_ready event)
      socketRef.current?.emit("secondary_camera_connected", {
        interviewId: sessionId,
        userId,
        timestamp: Date.now(),
      });

      await startWebRTCOffer(stream);
    } catch (err) {
      console.error("📱 Camera setup error:", err);
      let msg = "Unable to access front camera. ";
      if (err.name === "NotAllowedError")
        msg += "Please grant camera permission and refresh.";
      else if (err.name === "NotFoundError") msg += "No front camera found.";
      else if (err.name === "NotReadableError")
        msg += "Camera in use by another app.";
      else msg += err.message;
      setError(msg);
    }
  }

  async function startWebRTCOffer(stream) {
    // Prevent sending duplicate offers if this runs twice (React strict mode / reconnect)
    if (offerSentRef.current) {
      console.log("📱 Offer already sent — skipping duplicate");
      return;
    }

    closePeerConnection();
    setConnectionState("connecting");

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionRef.current = pc;

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
      console.log("📱 Added track:", track.kind);
    });

    // FIX: tag ICE candidates with fromMobile=true so desktop can distinguish
    // them from its own candidates (desktop checks data.fromMobile === false to skip)
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("webrtc_ice_candidate", {
          candidate: event.candidate,
          interviewId: sessionId,
          fromMobile: true, // ← critical: tells desktop this came from mobile
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log("📱 WebRTC state:", state);
      if (state === "connected") {
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        setConnectionState("connected");
        offerSentRef.current = false; // allow re-offer if disconnected
      } else if (state === "failed") {
        handleWebRTCFailure("ICE connection failed");
      } else if (state === "disconnected") {
        offerSentRef.current = false; // allow re-offer after disconnect
        setTimeout(() => {
          if (peerConnectionRef.current?.connectionState !== "connected") {
            handleWebRTCFailure("WebRTC disconnected and did not recover");
          }
        }, 5000);
      }
    };

    const offer = await pc.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    });
    await pc.setLocalDescription(offer);

    offerSentRef.current = true;
    console.log("📱 Sending WebRTC offer to desktop");
    socketRef.current?.emit("webrtc_offer", {
      sdp: offer.sdp,
      type: offer.type,
      interviewId: sessionId,
      fromMobile: true,
    });

    connectTimeoutRef.current = setTimeout(() => {
      if (peerConnectionRef.current?.connectionState !== "connected") {
        handleWebRTCFailure(
          "Connection timeout after " + WEBRTC_CONNECT_TIMEOUT_MS + "ms",
        );
      }
    }, WEBRTC_CONNECT_TIMEOUT_MS);
  }

  function handleWebRTCFailure(reason) {
    console.error("📱 WebRTC failed:", reason);
    setConnectionState("failed");
    offerSentRef.current = false;
    setError(
      "Direct video connection failed. Try switching to WiFi or refreshing.",
    );
    socketRef.current?.emit("webrtc_failed", {
      reason,
      interviewId: sessionId,
    });
  }

  function closePeerConnection() {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      try {
        peerConnectionRef.current.close();
      } catch (_) {}
      peerConnectionRef.current = null;
    }
  }

  if (!sessionId || !userId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Invalid Link</h2>
          <p className="text-gray-400">
            Scan the QR code from your desktop interview session.
          </p>
        </div>
      </div>
    );
  }

  const statusLabel = {
    idle: "Initializing...",
    connecting: "Connecting...",
    connected: "Streaming Live",
    failed: "Connection Failed",
  }[connectionState];
  const statusColor = {
    idle: "bg-gray-400",
    connecting: "bg-yellow-300 animate-pulse",
    connected: "bg-green-300 animate-pulse",
    failed: "bg-red-400",
  }[connectionState];

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-linear-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-4 shadow-xl">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Secondary Camera
          </h1>
          <p className="text-gray-400 text-sm">
            Keep this page open during your interview
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border-2 border-red-500 rounded-xl p-6 text-center">
            <p className="text-red-300 text-sm font-medium mb-3">{error}</p>
            {connectionState === "failed" && (
              <button
                onClick={() => {
                  setError(null);
                  setConnectionState("connecting");
                  if (cameraStreamRef.current)
                    startWebRTCOffer(cameraStreamRef.current);
                }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
              >
                Retry Connection
              </button>
            )}
          </div>
        )}

        <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-gray-700">
          <div className="bg-linear-to-r from-orange-600 to-red-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${statusColor}`} />
              <span className="text-white font-bold text-sm">
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="relative aspect-9/16 bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />

            {connectionState === "connecting" && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                <div className="animate-spin w-10 h-10 border-4 border-gray-600 border-t-orange-500 rounded-full mb-3" />
                <p className="text-white text-sm font-medium">
                  {!isConnected
                    ? "Connecting to server..."
                    : "Establishing P2P link..."}
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  This takes a few seconds
                </p>
              </div>
            )}

            {connectionState === "connected" && (
              <div className="absolute top-4 right-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-green-600/90 backdrop-blur-sm rounded-lg shadow-xl">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-xs font-bold">
                    LIVE · P2P
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-700">
            <div className="text-xs text-gray-400 space-y-1">
              <p>
                Server:{" "}
                <span className="text-white">
                  {isConnected ? "Connected" : "Connecting..."}
                </span>
              </p>
              <p>
                Camera:{" "}
                <span className="text-white">
                  {cameraGranted ? "Active" : "Requesting..."}
                </span>
              </p>
              <p>
                Stream:{" "}
                <span className="text-white">
                  {connectionState === "connected"
                    ? "🟢 P2P Direct"
                    : connectionState === "connecting"
                      ? "⏳ Negotiating..."
                      : connectionState === "failed"
                        ? "🔴 Failed"
                        : "Waiting..."}
                </span>
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">
          Keep your screen on and this page open
        </p>
      </div>
    </div>
  );
};

export default MobileCameraPage;
