import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

// Free Google STUN servers — work for ~80% of NAT configurations.
// If users are on strict corporate/carrier NAT, add a TURN server here.
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// How long to wait for ICE to reach "connected" before declaring failure
const WEBRTC_CONNECT_TIMEOUT_MS = 15000;

const MobileCameraPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("interviewId");
  const userId = searchParams.get("userId");

  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [connectionState, setConnectionState] = useState("idle");
  // "idle" | "connecting" | "connected" | "failed" | "streaming"

  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const connectTimeoutRef = useRef(null);

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || !userId) {
      setError("Invalid mobile camera link. Please scan the QR code again.");
      return;
    }

    console.log("📱 Mobile WebRTC camera initializing:", { sessionId, userId });

    const socket = io(SOCKET_URL, {
      query: {
        interviewId: sessionId,
        userId,
        // MUST be "settings" — prevents server from starting Deepgram/TTS/face
        // detection for this socket (which would terminate the interview because
        // no face is visible on the mobile device's front camera angle)
        type: "settings",
      },
      transports: ["websocket", "polling"],
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("📱 Mobile socket connected:", socket.id);
      setIsConnected(true);
    });

    // ── WebRTC signaling: receive answer from desktop ─────────────────────
    socket.on("webrtc_answer", async (data) => {
      console.log("📱 Received WebRTC answer from desktop");
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: data.type, sdp: data.sdp }),
        );
        console.log("📱 Remote description (answer) set successfully");
      } catch (err) {
        console.error("📱 Error setting remote description:", err);
        handleWebRTCFailure("Failed to set remote description: " + err.message);
      }
    });

    // ── WebRTC signaling: receive ICE candidates from desktop ─────────────
    socket.on("webrtc_ice_candidate", async (data) => {
      // Only process candidates FROM desktop (fromMobile=false)
      if (data.fromMobile) return;
      const pc = peerConnectionRef.current;
      if (!pc || !data.candidate) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        // Non-fatal — ICE trickle can have ordering issues
        console.warn("📱 Error adding ICE candidate:", err.message);
      }
    });

    socket.on("connect_error", (err) => {
      console.error("📱 Socket connection error:", err);
      setError("Failed to connect to server. Check your internet connection.");
    });

    socket.on("disconnect", (reason) => {
      console.log("📱 Socket disconnected:", reason);
      setIsConnected(false);
      if (connectionState !== "connected") {
        setConnectionState("failed");
      }
    });

    return () => {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      closePeerConnection();
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId]);

  // ── Camera + WebRTC setup — runs once socket is connected ─────────────────
  useEffect(() => {
    if (!isConnected || cameraGranted) return;
    requestCameraAndStartWebRTC();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  async function requestCameraAndStartWebRTC() {
    try {
      console.log("📱 Step 1: Requesting front camera");
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

      // Show local preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch((e) => {
          if (e.name !== "AbortError") console.error("Preview play:", e);
        });
      }

      console.log("📱 Step 2: Notifying server of mobile connection");
      socketRef.current.emit("secondary_camera_connected", {
        interviewId: sessionId,
        userId,
        timestamp: Date.now(),
      });

      console.log("📱 Step 3: Starting WebRTC offer");
      await startWebRTCOffer(stream);
    } catch (err) {
      console.error("📱 Camera/WebRTC setup error:", err);
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

  // ── WebRTC offer creation ─────────────────────────────────────────────────
  async function startWebRTCOffer(stream) {
    // Clean up any existing peer connection
    closePeerConnection();

    setConnectionState("connecting");

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionRef.current = pc;

    // Add all camera tracks to the peer connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
      console.log("📱 Added track to peer connection:", track.kind);
    });

    // ── ICE candidate gathering: send each candidate to desktop via socket ──
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("webrtc_ice_candidate", {
          candidate: event.candidate,
          interviewId: sessionId,
        });
      }
    };

    // ── Connection state monitoring ───────────────────────────────────────
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log("📱 WebRTC connection state:", state);

      if (state === "connected") {
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        setConnectionState("connected");
        console.log(
          "📱 ✅ WebRTC P2P connected — video streaming directly to desktop",
        );
      } else if (state === "failed") {
        handleWebRTCFailure("ICE connection failed");
      } else if (state === "disconnected") {
        console.warn("📱 WebRTC disconnected — attempting restart");
        // Browser may auto-recover; give it 5s before declaring failure
        setTimeout(() => {
          if (peerConnectionRef.current?.connectionState !== "connected") {
            handleWebRTCFailure("WebRTC disconnected and did not recover");
          }
        }, 5000);
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log("📱 ICE gathering state:", pc.iceGatheringState);
    };

    pc.onsignalingstatechange = () => {
      console.log("📱 Signaling state:", pc.signalingState);
    };

    // ── Create and send SDP offer ─────────────────────────────────────────
    const offer = await pc.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false, // We are SENDING video only, not receiving
    });
    await pc.setLocalDescription(offer);

    console.log("📱 Sending WebRTC offer to desktop via socket");
    socketRef.current?.emit("webrtc_offer", {
      sdp: offer.sdp,
      type: offer.type,
      interviewId: sessionId,
    });

    // ── Timeout guard — if ICE never reaches connected, fall back ─────────
    connectTimeoutRef.current = setTimeout(() => {
      if (peerConnectionRef.current?.connectionState !== "connected") {
        handleWebRTCFailure(
          "WebRTC connection timeout after " + WEBRTC_CONNECT_TIMEOUT_MS + "ms",
        );
      }
    }, WEBRTC_CONNECT_TIMEOUT_MS);
  }

  function handleWebRTCFailure(reason) {
    console.error("📱 WebRTC failed:", reason);
    setConnectionState("failed");
    setError(
      "Direct video connection failed. This can happen on some mobile networks. " +
        "Try switching to WiFi or refreshing the page.",
    );
    // Notify desktop so it can show appropriate UI
    socketRef.current?.emit("webrtc_failed", { reason });
  }

  function closePeerConnection() {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.onicegatheringstatechange = null;
      peerConnectionRef.current.onsignalingstatechange = null;
      try {
        peerConnectionRef.current.close();
      } catch (_) {}
      peerConnectionRef.current = null;
    }
  }

  if (!sessionId || !userId) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md text-center shadow-2xl">
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Invalid Link
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This page must be accessed by scanning the QR code from your desktop
            interview session.
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
    streaming: "Streaming Live",
  }[connectionState];

  const statusColor = {
    idle: "bg-gray-400",
    connecting: "bg-yellow-300 animate-pulse",
    connected: "bg-green-300 animate-pulse",
    failed: "bg-red-400",
    streaming: "bg-green-300 animate-pulse",
  }[connectionState];

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 to-gray-800 flex flex-col items-center justify-center p-4">
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
          <p className="text-gray-300 text-sm">
            Keep this page open during your interview
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border-2 border-red-500 rounded-xl p-6 text-center">
            <svg
              className="w-12 h-12 text-red-500 mx-auto mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-red-300 text-sm font-medium mb-3">{error}</p>
            {connectionState === "failed" && (
              <button
                onClick={() => {
                  setError(null);
                  setConnectionState("connecting");
                  if (cameraStreamRef.current) {
                    startWebRTCOffer(cameraStreamRef.current);
                  }
                }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
              >
                Retry Connection
              </button>
            )}
          </div>
        )}

        <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-gray-700">
          {/* Status bar */}
          <div className="bg-linear-to-r from-orange-600 to-red-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${statusColor}`} />
                <span className="text-white font-bold text-sm">
                  {statusLabel}
                </span>
              </div>
              {isConnected && (
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                  />
                </svg>
              )}
            </div>
          </div>

          {/* Camera preview */}
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
                    : "Establishing direct connection..."}
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

          {/* Status details */}
          <div className="bg-gray-750 px-6 py-4 border-t border-gray-700">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-blue-400 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-gray-300">
                <p className="font-semibold mb-1">Status:</p>
                <ul className="space-y-1 text-xs text-gray-400">
                  <li>Server: {isConnected ? "Connected" : "Not connected"}</li>
                  <li>
                    Camera: {cameraGranted ? "Access granted" : "Requesting..."}
                  </li>
                  <li>
                    Video stream:{" "}
                    {connectionState === "connected"
                      ? "🟢 Direct P2P — low latency"
                      : connectionState === "connecting"
                        ? "⏳ Negotiating..."
                        : connectionState === "failed"
                          ? "🔴 Failed"
                          : "Waiting..."}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileCameraPage;
