import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

// Enhanced ICE servers with better fallback options
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turns:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

if (import.meta.env.VITE_TURN_URL) {
  ICE_SERVERS.push({
    urls: import.meta.env.VITE_TURN_URL,
    username: import.meta.env.VITE_TURN_USERNAME || "",
    credential: import.meta.env.VITE_TURN_CREDENTIAL || "",
  });
}

const RTC_CONFIG = {
  iceTransportPolicy: "all",
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

const CAMERA_CONFIG = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 15, max: 20 },
  aspectRatio: 4 / 3,
};

const WEBSOCKET_TIMEOUT = 30000;
const WEBRTC_ANSWER_TIMEOUT = 45000;
const READY_TIMEOUT = 15000;

const Dot = ({ active, color = "green" }) => {
  const colors = {
    green: active ? "bg-emerald-500" : "bg-gray-200",
    orange: active ? "bg-orange-500" : "bg-gray-200",
    yellow: active ? "bg-amber-500" : "bg-gray-200",
    red: active ? "bg-red-500" : "bg-gray-200",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${colors[color]} ${active ? "animate-pulse" : ""}`}
    />
  );
};

const StatusRow = ({ label, value, active, color }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
    <span className="text-gray-400 text-xs">{label}</span>
    <span className="flex items-center gap-2 text-xs font-medium text-gray-700">
      <Dot active={active} color={color} />
      {value}
    </span>
  </div>
);

const Spinner = ({ className = "" }) => (
  <svg
    className={`animate-spin ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v8H4z"
    />
  </svg>
);

const MobileCameraPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("interviewId");
  const userId = searchParams.get("userId");

  const [phase, setPhase] = useState("connecting");
  const [error, setError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [trackPublished, setTrackPublished] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [zoomApplied, setZoomApplied] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("unknown");

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const rawStreamRef = useRef(null);
  const videoElRef = useRef(null);
  const mountedRef = useRef(true);
  const frameTimerRef = useRef(null);
  const webRTCStartedRef = useRef(false);
  const iceCandidatesRef = useRef([]);
  const reconnectAttemptsRef = useRef(0);
  const answerTimeoutRef = useRef(null);
  const readyTimeoutRef = useRef(null);

  // FIX 1: Generation counter — each startWebRTC() call gets a unique number.
  // Any answer arriving with a different generation is from a timed-out round
  // and must be discarded to prevent "setRemoteDescription: wrong state: stable".
  const webRTCGenRef = useRef(0);

  const teardown = useCallback(async () => {
    console.log("🧹 Cleaning up mobile camera resources");

    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    if (answerTimeoutRef.current) {
      clearTimeout(answerTimeoutRef.current);
      answerTimeoutRef.current = null;
    }
    if (readyTimeoutRef.current) {
      clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (_) {}
      pcRef.current = null;
    }

    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });
      rawStreamRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    webRTCStartedRef.current = false;
    iceCandidatesRef.current = [];
    reconnectAttemptsRef.current = 0;
    webRTCGenRef.current = 0; // FIX 1: reset generation on teardown
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardown();
    };
  }, [teardown]);

  useEffect(() => {
    if (!sessionId || !userId) {
      setPhase("error");
      setError("Invalid link — please scan the QR code again.");
    }
  }, [sessionId, userId]);

  const applyHardwareZoomOut = useCallback(async (mediaStream) => {
    try {
      const track = mediaStream.getVideoTracks()[0];
      if (!track) return false;
      const capabilities = track.getCapabilities?.();
      if (!capabilities?.zoom) return false;
      const minZoom = capabilities.zoom.min;
      await track.applyConstraints({ advanced: [{ zoom: minZoom }] });
      console.log(`✅ Zoom set to minimum (${minZoom})`);
      return true;
    } catch (err) {
      console.warn("⚠️ Hardware zoom failed:", err.message);
      return false;
    }
  }, []);

  const startFrameRelay = useCallback((stream) => {
    if (frameTimerRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d", { alpha: false });

    const vid = document.createElement("video");
    vid.autoplay = true;
    vid.playsInline = true;
    vid.muted = true;
    vid.srcObject = stream;

    let frameCount = 0;
    let sending = false;

    frameTimerRef.current = setInterval(() => {
      if (vid.readyState < 2) return;
      if (pcRef.current?.connectionState === "connected") {
        clearInterval(frameTimerRef.current);
        frameTimerRef.current = null;
        return;
      }
      if (sending) return;

      ctx.drawImage(vid, 0, 0, 320, 240);
      sending = true;
      canvas.toBlob(
        async (blob) => {
          try {
            if (!blob || blob.size > 50 * 1024) return;
            const ab = await blob.arrayBuffer();
            const bytes = new Uint8Array(ab);
            let binary = "";
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            socketRef.current?.emit("mobile_camera_frame", {
              frame: base64,
              timestamp: Date.now(),
              frameNum: frameCount++,
            });
          } finally {
            sending = false;
          }
        },
        "image/jpeg",
        0.5,
      );
    }, 333);
  }, []);

  const startWebRTC = useCallback(
    async (socket) => {
      if (!mountedRef.current) return;
      if (webRTCStartedRef.current) {
        console.log("📱 WebRTC already started - reusing existing connection");
        return;
      }

      webRTCStartedRef.current = true;
      reconnectAttemptsRef.current = 0;

      // FIX 1: Bump generation and clear stale ICE candidates from previous round
      const myGeneration = ++webRTCGenRef.current;
      iceCandidatesRef.current = [];

      try {
        setPhase("camera");

        const rawStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: CAMERA_CONFIG.width,
            height: CAMERA_CONFIG.height,
            frameRate: CAMERA_CONFIG.frameRate,
            aspectRatio: CAMERA_CONFIG.aspectRatio,
          },
          audio: false,
        });

        rawStreamRef.current = rawStream;

        if (!mountedRef.current) {
          rawStream.getTracks().forEach((t) => t.stop());
          return;
        }

        const applied = await applyHardwareZoomOut(rawStream);
        setZoomApplied(applied);

        if (videoElRef.current) {
          videoElRef.current.srcObject = rawStream;
          await videoElRef.current.play().catch(() => {});
        }

        setCameraReady(true);
        setPhase("publishing");

        const pc = new RTCPeerConnection({
          iceServers: ICE_SERVERS,
          ...RTC_CONFIG,
        });
        pcRef.current = pc;

        rawStream.getVideoTracks().forEach((track) => {
          pc.addTrack(track, rawStream);
        });

        pc.onicecandidate = ({ candidate }) => {
          if (candidate && socket?.connected) {
            socket.emit("mobile_webrtc_ice_candidate", { candidate });
          }
        };

        pc.onicegatheringstatechange = () => {
          console.log("📱 ICE gathering:", pc.iceGatheringState);
        };

        pc.oniceconnectionstatechange = () => {
          const state = pc.iceConnectionState;
          console.log("📱 ICE connection:", state);
          if (state === "connected") {
            setPeerConnected(true);
            setConnectionQuality("good");
          } else if (state === "failed") {
            console.error("❌ ICE failed - attempting recovery");
            setConnectionQuality("poor");
            if (reconnectAttemptsRef.current < 3) {
              reconnectAttemptsRef.current++;
              pc.restartIce();
            }
          }
        };

        pc.onconnectionstatechange = () => {
          if (!mountedRef.current) return;
          const state = pc.connectionState;
          console.log("📱 Connection state:", state);

          if (state === "connected") {
            setPeerConnected(true);
            setTrackPublished(true);
            setPhase("live");
            if (frameTimerRef.current) {
              clearInterval(frameTimerRef.current);
              frameTimerRef.current = null;
              console.log("🛑 Frame relay stopped - WebRTC active");
            }
          }
          if (state === "failed") {
            setPeerConnected(false);
            setTrackPublished(false);
            webRTCStartedRef.current = false;
            console.error("❌ PC failed — restarting ICE");
            if (reconnectAttemptsRef.current < 3) {
              reconnectAttemptsRef.current++;
              pc.restartIce();
            }
          }
          if (state === "disconnected") {
            setPeerConnected(false);
            setTrackPublished(false);
            webRTCStartedRef.current = false;
          }
        };

        const offer = await pc.createOffer({
          offerToReceiveVideo: false,
          offerToReceiveAudio: false,
          iceRestart: false,
        });

        await pc.setLocalDescription(offer);

        // FIX 1: Tag offer with generation so server echoes it back in answer
        socket.emit("mobile_webrtc_offer", {
          offer: { ...pc.localDescription, _generation: myGeneration },
          identity: `mobile_${userId}`,
        });

        answerTimeoutRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          console.warn("⚠️ WebRTC answer timeout - retrying");
          webRTCStartedRef.current = false;
          if (reconnectAttemptsRef.current < 3) {
            reconnectAttemptsRef.current++;
            startWebRTC(socket);
          } else {
            setPhase("error");
            setError(
              "Desktop not responding. Please check the interview page.",
            );
          }
        }, WEBRTC_ANSWER_TIMEOUT);

        startFrameRelay(rawStream);

        console.log(`📱 WebRTC offer sent (generation ${myGeneration})`);
      } catch (err) {
        if (!mountedRef.current) return;
        console.error("❌ WebRTC start failed:", err);
        webRTCStartedRef.current = false;

        let errorMsg = "Unable to start camera stream. ";
        if (err.name === "NotAllowedError") {
          errorMsg = "Camera permission denied. Please allow camera access.";
        } else if (err.name === "NotFoundError") {
          errorMsg = "No front camera found on this device.";
        } else if (err.name === "NotReadableError") {
          errorMsg = "Camera is in use by another app.";
        } else if (err.message?.includes("timeout")) {
          errorMsg = "Connection timeout. Please try again.";
        } else {
          errorMsg += err.message;
        }

        setPhase("error");
        setError(errorMsg);
      }
    },
    [applyHardwareZoomOut, startFrameRelay, userId],
  );

  const connectSocket = useCallback(() => {
    if (!sessionId || !userId) return;

    setPhase("connecting");
    setError(null);
    webRTCStartedRef.current = false;
    iceCandidatesRef.current = [];

    const socket = io(SOCKET_URL, {
      query: {
        interviewId: sessionId,
        userId,
        type: "settings",
        platform: "mobile",
      },
      transports: ["websocket"],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: WEBSOCKET_TIMEOUT,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      if (!mountedRef.current) return;
      console.log("📱 Socket connected:", socket.id);
      setSocketConnected(true);
      reconnectAttemptsRef.current = 0;

      socket.off("secondary_camera_ready");

      const handleSecondaryReady = async () => {
        if (!webRTCStartedRef.current && mountedRef.current) {
          console.log("✅ secondary_camera_ready received");
          if (readyTimeoutRef.current) {
            clearTimeout(readyTimeoutRef.current);
            readyTimeoutRef.current = null;
          }
          if (answerTimeoutRef.current) clearTimeout(answerTimeoutRef.current);
          await startWebRTC(socket);
        }
      };

      socket.on("secondary_camera_ready", handleSecondaryReady);

      socket.emit("secondary_camera_connected", {
        interviewId: sessionId,
        userId,
        timestamp: Date.now(),
        streamType: "webrtc",
        capabilities: {
          webRTC: true,
          resolution: `${CAMERA_CONFIG.width.ideal}x${CAMERA_CONFIG.height.ideal}`,
        },
      });

      readyTimeoutRef.current = setTimeout(async () => {
        if (!webRTCStartedRef.current && mountedRef.current) {
          console.warn("⚠️ Ready timeout - starting WebRTC anyway");
          await startWebRTC(socket);
        }
      }, READY_TIMEOUT);
    });

    socket.on("mobile_webrtc_answer_from_server", async ({ answer }) => {
      if (!mountedRef.current) return;

      try {
        // FIX 1: Discard stale answers from previous timed-out negotiation rounds.
        // When the 45s timeout fires and startWebRTC() restarts (new generation),
        // the old answer may still arrive — calling setRemoteDescription on a
        // fresh PC (signalingState="stable") throws "Called in wrong state: stable".
        if (
          answer._generation !== undefined &&
          answer._generation !== webRTCGenRef.current
        ) {
          console.warn(
            `⚠️ Ignoring stale WebRTC answer (gen ${answer._generation}, current ${webRTCGenRef.current})`,
          );
          return;
        }

        if (answerTimeoutRef.current) {
          clearTimeout(answerTimeoutRef.current);
          answerTimeoutRef.current = null;
        }

        const pc = pcRef.current;
        if (!pc) {
          console.warn("⚠️ Received answer but no peer connection");
          return;
        }

        // FIX 1: Secondary guard — only accept answer when PC has a local offer set
        if (pc.signalingState !== "have-local-offer") {
          console.warn(
            `⚠️ Ignoring answer in wrong signaling state: ${pc.signalingState}`,
          );
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("📱 Remote description set");

        // Drain all ICE candidates buffered before setRemoteDescription
        const buffered = iceCandidatesRef.current.splice(0);
        for (const c of buffered) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (_) {}
        }
        console.log(`📱 Drained ${buffered.length} buffered ICE candidates`);
      } catch (err) {
        console.error("❌ Failed to set remote description:", err.message);
      }
    });

    socket.on("mobile_webrtc_ice_from_desktop", async ({ candidate }) => {
      if (!candidate) return;
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        iceCandidatesRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("⚠️ Failed to add ICE candidate:", err.message);
      }
    });

    socket.on("disconnect", (reason) => {
      if (!mountedRef.current) return;
      console.warn("📱 Socket disconnected:", reason);
      setSocketConnected(false);
      setPeerConnected(false);
      setTrackPublished(false);
      webRTCStartedRef.current = false;
      if (reason !== "io client disconnect") {
        setPhase("error");
        setError("Connection lost. Reconnecting...");
      }
    });

    socket.on("connect_error", (err) => {
      if (!mountedRef.current) return;
      console.error("❌ Socket error:", err.message);
      reconnectAttemptsRef.current++;
      if (reconnectAttemptsRef.current > 5) {
        setPhase("error");
        setError("Cannot reach server. Please check your internet connection.");
      }
    });
  }, [sessionId, userId, startWebRTC]);

  useEffect(() => {
    if (sessionId && userId) {
      connectSocket();
    }
    return () => {
      if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
      if (answerTimeoutRef.current) clearTimeout(answerTimeoutRef.current);
    };
  }, [sessionId, userId, connectSocket]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    await teardown();
    setSocketConnected(false);
    setCameraReady(false);
    setPeerConnected(false);
    setTrackPublished(false);
    setZoomApplied(false);
    setConnectionQuality("unknown");
    setError(null);
    setTimeout(() => {
      if (mountedRef.current) {
        setRetrying(false);
        connectSocket();
      }
    }, 1000);
  }, [teardown, connectSocket]);

  if (!sessionId || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-5">
            <svg
              className="w-7 h-7 text-red-500"
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
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Invalid Link
          </h2>
          <p className="text-gray-400 text-sm">
            Scan the QR code from your desktop interview page.
          </p>
        </div>
      </div>
    );
  }

  const phaseConfig = {
    connecting: {
      label: "Connecting…",
      accent: "text-amber-500",
      bar: "bg-amber-400",
    },
    camera: {
      label: "Starting camera…",
      accent: "text-violet-500",
      bar: "bg-violet-500",
    },
    publishing: {
      label: "Establishing connection…",
      accent: "text-violet-500",
      bar: "bg-violet-500",
    },
    live: {
      label:
        connectionQuality === "good"
          ? "Streaming Live"
          : "Connected (Low Quality)",
      accent: "text-emerald-600",
      bar: "bg-emerald-500",
    },
    error: {
      label: "Connection Error",
      accent: "text-red-500",
      bar: "bg-red-400",
    },
  };

  const cfg = phaseConfig[phase] ?? phaseConfig.connecting;
  const isLive = phase === "live";
  const isError = phase === "error";
  const isLoading = !isLive && !isError;

  return (
    <>
      <title>Secondary Camera | Talk2Hire</title>
      <meta name="robots" content="noindex, nofollow" />
      <meta name="theme-color" content="#7C3AED" />

      <div
        className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.06) 0%, transparent 65%), #f8fafc",
        }}
      >
        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="text-center mb-2">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-all duration-500 ${
                isLive
                  ? "bg-emerald-50 border border-emerald-200"
                  : isError
                    ? "bg-red-50 border border-red-200"
                    : "bg-violet-50 border border-violet-200"
              }`}
            >
              {isError ? (
                <svg
                  className="w-7 h-7 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <svg
                  className={`w-7 h-7 ${isLive ? "text-emerald-500" : "text-violet-500"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.902L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight mb-1">
              Secondary Camera
            </h1>
            <p
              className={`text-sm font-medium ${cfg.accent} transition-colors`}
            >
              {cfg.label}
            </p>
          </div>

          <div className="relative bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
            <div className="h-0.5 w-full bg-gray-100">
              <div
                className={`h-full ${cfg.bar} transition-all duration-700 ${isLive ? "w-full" : isError ? "w-1/4" : "w-2/3 animate-pulse"}`}
              />
            </div>
            <div className="relative" style={{ aspectRatio: "9/16" }}>
              <video
                ref={videoElRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover bg-gray-900"
                style={{ transform: "scaleX(-1)" }}
              />
              {!cameraReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/95 gap-3">
                  {isError ? (
                    <svg
                      className="w-10 h-10 text-red-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                  ) : (
                    <Spinner className="w-10 h-10 text-violet-400" />
                  )}
                  <p className="text-gray-400 text-xs">
                    {isError ? "Camera unavailable" : "Starting camera…"}
                  </p>
                </div>
              )}
              {isLive && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500 rounded-md shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span className="text-white text-[10px] font-bold tracking-widest">
                      {connectionQuality === "good" ? "LIVE" : "CONNECTED"}
                    </span>
                  </div>
                  {zoomApplied && (
                    <div className="px-2 py-1 bg-white/80 backdrop-blur-sm rounded-md border border-gray-200 shadow-sm">
                      <span className="text-gray-600 text-[10px] font-semibold tracking-wider">
                        WIDE
                      </span>
                    </div>
                  )}
                </div>
              )}
              {isLoading && cameraReady && (
                <div className="absolute top-3 left-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-500 rounded-md shadow-sm">
                    <Spinner className="w-2.5 h-2.5 text-white" />
                    <span className="text-white text-[10px] font-bold tracking-widest">
                      CONNECTING…
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {isError && error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm mb-3">{error}</p>
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-red-50 border border-red-200 text-red-500 text-sm font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 shadow-sm"
              >
                {retrying ? (
                  <>
                    <Spinner className="w-4 h-4 text-red-400" />
                    Retrying…
                  </>
                ) : (
                  "Try Again"
                )}
              </button>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-2xl px-4 py-1 shadow-sm">
            <StatusRow
              label="Server"
              value={socketConnected ? "Connected" : "Connecting…"}
              active={socketConnected}
              color="green"
            />
            <StatusRow
              label="Camera"
              value={cameraReady ? "Active" : "Waiting…"}
              active={cameraReady}
              color="orange"
            />
            <StatusRow
              label="Peer Connection"
              value={peerConnected ? "Established" : "Pending…"}
              active={peerConnected}
              color="yellow"
            />
            <StatusRow
              label="Stream"
              value={
                trackPublished ? "Publishing via WebRTC" : "Not publishing"
              }
              active={trackPublished}
              color="green"
            />
            <StatusRow
              label="Wide Angle"
              value={
                !cameraReady
                  ? "Pending…"
                  : zoomApplied
                    ? "Active (hardware)"
                    : "Not supported"
              }
              active={zoomApplied}
              color="yellow"
            />
          </div>

          <p className="text-center text-gray-300 text-xs pb-2">
            Keep this page open throughout the interview
          </p>
        </div>
      </div>
    </>
  );
};

export default MobileCameraPage;
