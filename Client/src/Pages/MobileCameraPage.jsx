import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

// ~7fps — smooth enough for a secondary monitoring angle.
// Raise to 100ms for ~10fps, lower to 200ms for ~5fps to save bandwidth.
const FRAME_INTERVAL_MS = 150;
const JPEG_QUALITY = 0.6;
const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;

const MobileCameraPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("interviewId");
  const userId = searchParams.get("userId");

  const [isConnected, setIsConnected] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [frameCount, setFrameCount] = useState(0);

  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const frameTimerRef = useRef(null);
  const frameCountRef = useRef(0);
  const isCameraStartingRef = useRef(false);

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || !userId) {
      setError("Invalid link. Please scan the QR code again.");
      return;
    }

    const socket = io(SOCKET_URL, {
      query: { interviewId: sessionId, userId, type: "settings" },
      transports: ["websocket", "polling"],
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("📱 Socket connected:", socket.id);
      setIsConnected(true);
    });

    socket.on("reconnect", () => {
      console.log("📱 Socket reconnected");
      // Re-announce camera if it was already running
      if (cameraStreamRef.current?.active) {
        socket.emit("secondary_camera_connected", {
          interviewId: sessionId,
          userId,
          timestamp: Date.now(),
          streamType: "websocket_frames",
        });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("📱 Socket disconnected:", reason);
      setIsConnected(false);
      // Don't stop streaming — frames will just be dropped until reconnect
    });

    socket.on("connect_error", (err) => {
      console.error("📱 Socket error:", err.message);
      setError("Server connection failed. Check your internet and refresh.");
    });

    return () => {
      stopStreaming();
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      socket.disconnect();
    };
  }, [sessionId, userId]); // eslint-disable-line

  // ── Start camera once socket connects ─────────────────────────────────────
  useEffect(() => {
    if (isConnected && !cameraGranted && !isCameraStartingRef.current) {
      startCamera();
    }
  }, [isConnected]); // eslint-disable-line

  async function startCamera() {
    if (isCameraStartingRef.current) return;
    isCameraStartingRef.current = true;

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
        await videoRef.current.play().catch((e) => {
          if (e.name !== "AbortError") console.error("Video play:", e);
        });
      }

      // Tell server secondary camera is ready
      socketRef.current?.emit("secondary_camera_connected", {
        interviewId: sessionId,
        userId,
        timestamp: Date.now(),
        streamType: "websocket_frames",
      });

      startStreaming();
    } catch (err) {
      console.error("📱 Camera error:", err);
      isCameraStartingRef.current = false;
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

  function startStreaming() {
    if (frameTimerRef.current) return;
    setIsStreaming(true);
    frameTimerRef.current = setInterval(captureAndSendFrame, FRAME_INTERVAL_MS);
    console.log(
      "📱 Frame streaming started at",
      Math.round(1000 / FRAME_INTERVAL_MS),
      "fps",
    );
  }

  function stopStreaming() {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    setIsStreaming(false);
  }

  function captureAndSendFrame() {
    const socket = socketRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!socket?.connected || !video || !canvas) return;
    if (video.readyState < 2 || video.paused || video.ended) return;

    try {
      const ctx = canvas.getContext("2d");
      // Mirror horizontally so desktop sees natural orientation
      ctx.save();
      ctx.translate(CAPTURE_WIDTH, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
      ctx.restore();

      const frameDataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

      socket.emit("mobile_camera_frame", {
        frame: frameDataUrl,
        timestamp: Date.now(),
        interviewId: sessionId,
      });

      frameCountRef.current++;
      if (frameCountRef.current % 10 === 0) {
        setFrameCount(frameCountRef.current);
      }
    } catch (err) {
      console.error("📱 Frame capture error:", err);
    }
  }

  // ── Invalid link ───────────────────────────────────────────────────────────
  if (!sessionId || !userId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-4">
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Invalid Link</h2>
          <p className="text-gray-400 text-sm">
            Scan the QR code from your desktop interview page.
          </p>
        </div>
      </div>
    );
  }

  const statusLabel = !isConnected
    ? "Connecting to server..."
    : !cameraGranted
      ? "Starting camera..."
      : isStreaming
        ? "Streaming Live"
        : "Initializing...";

  const dotClass = isStreaming
    ? "bg-green-400 animate-pulse"
    : isConnected
      ? "bg-yellow-400 animate-pulse"
      : "bg-gray-500";

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      {/* Hidden capture canvas */}
      <canvas
        ref={canvasRef}
        width={CAPTURE_WIDTH}
        height={CAPTURE_HEIGHT}
        className="hidden"
      />

      <div className="w-full max-w-lg">
        {/* Header */}
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
                d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.902L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            Secondary Camera
          </h1>
          <p className="text-gray-400 text-sm">
            Keep this page open during your interview
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-500/10 border-2 border-red-500 rounded-xl p-4 text-center">
            <p className="text-red-300 text-sm font-medium mb-3">{error}</p>
            <button
              onClick={() => {
                setError(null);
                isCameraStartingRef.current = false;
                startCamera();
              }}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Card */}
        <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-gray-700">
          {/* Status bar */}
          <div className="bg-linear-to-r from-orange-600 to-red-600 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
              <span className="text-white font-semibold text-sm">
                {statusLabel}
              </span>
            </div>
            {isStreaming && (
              <span className="text-orange-200 text-xs font-mono">
                {frameCount} frames
              </span>
            )}
          </div>

          {/* Video */}
          <div className="relative bg-black" style={{ aspectRatio: "9/16" }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />

            {!isStreaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                <div className="animate-spin w-10 h-10 border-4 border-gray-600 border-t-orange-500 rounded-full mb-3" />
                <p className="text-white text-sm">{statusLabel}</p>
              </div>
            )}

            {isStreaming && (
              <div className="absolute top-3 right-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/90 backdrop-blur-sm rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-xs font-bold">LIVE</span>
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="px-5 py-4 border-t border-gray-700 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Server</span>
              <span
                className={isConnected ? "text-green-400" : "text-yellow-400"}
              >
                {isConnected ? "✅ Connected" : "⏳ Connecting..."}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Camera</span>
              <span
                className={cameraGranted ? "text-green-400" : "text-gray-400"}
              >
                {cameraGranted ? "✅ Active" : "⏳ Requesting..."}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Stream</span>
              <span
                className={isStreaming ? "text-green-400" : "text-gray-400"}
              >
                {isStreaming
                  ? `🟢 WebSocket · ~${Math.round(1000 / FRAME_INTERVAL_MS)}fps`
                  : "Waiting..."}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Network</span>
              <span className="text-blue-400">✅ Works on any network</span>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">
          Keep your screen on and this page open throughout the interview
        </p>
      </div>
    </div>
  );
};

export default MobileCameraPage;
