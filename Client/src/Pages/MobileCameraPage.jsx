import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import {
  Room,
  RoomEvent,
  Track,
  LocalVideoTrack,
  VideoPresets,
} from "livekit-client";

const SOCKET_URL = import.meta.env.VITE_WS_URL;
const ZOOM_LEVEL = 0.5; // <1 = wider/zoomed-out, >1 = zoomed in

// ─── Status Dot ───────────────────────────────────────────────────────────────
const Dot = ({ active, color = "green" }) => {
  const colors = {
    green: active ? "bg-emerald-400" : "bg-slate-600",
    orange: active ? "bg-orange-400" : "bg-slate-600",
    yellow: active ? "bg-amber-400" : "bg-slate-600",
    red: active ? "bg-red-400" : "bg-slate-600",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${colors[color]} ${active ? "animate-pulse" : ""}`}
    />
  );
};

// ─── Status Row ───────────────────────────────────────────────────────────────
const StatusRow = ({ label, value, active, color }) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
    <span className="text-slate-500 text-xs">{label}</span>
    <span className="flex items-center gap-2 text-xs font-medium text-slate-300">
      <Dot active={active} color={color} />
      {value}
    </span>
  </div>
);

// ─── Spinner ──────────────────────────────────────────────────────────────────
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

// ══════════════════════════════════════════════════════════════════════════════
// MobileCameraPage — LiveKit-based secondary camera with canvas zoom
// ══════════════════════════════════════════════════════════════════════════════
const MobileCameraPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("interviewId");
  const userId = searchParams.get("userId");

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState("connecting");
  const [error, setError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [roomConnected, setRoomConnected] = useState(false);
  const [trackPublished, setTrackPublished] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const socketRef = useRef(null);
  const roomRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const videoElRef = useRef(null);
  const mountedRef = useRef(true);

  // Canvas zoom refs
  const hiddenVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const rawStreamRef = useRef(null);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const teardown = useCallback(async () => {
    // Stop canvas draw loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Release hidden video
    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.srcObject = null;
      hiddenVideoRef.current = null;
    }
    canvasRef.current = null;

    // Stop raw camera tracks
    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((t) => t.stop());
      rawStreamRef.current = null;
    }

    // Stop LiveKit local track
    if (localVideoTrackRef.current) {
      try {
        localVideoTrackRef.current.stop();
      } catch (_) {}
      localVideoTrackRef.current = null;
    }

    // Disconnect LiveKit room
    if (roomRef.current) {
      try {
        await roomRef.current.disconnect();
      } catch (_) {}
      roomRef.current = null;
    }

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardown();
    };
  }, [teardown]);

  // ── Guard: invalid URL params ──────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || !userId) {
      setPhase("error");
      setError("Invalid link — please scan the QR code again.");
    }
  }, [sessionId, userId]);

  // ── Step 3: Create canvas-zoomed video track & publish ────────────────────
  const publishCamera = useCallback(async (room) => {
    if (!mountedRef.current) return;
    try {
      // 1. Grab raw camera stream
      const rawStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      rawStreamRef.current = rawStream;

      // 2. Feed into a hidden <video> element so we can draw frames
      const hiddenVideo = document.createElement("video");
      hiddenVideo.srcObject = rawStream;
      hiddenVideo.playsInline = true;
      hiddenVideo.muted = true;
      hiddenVideoRef.current = hiddenVideo;

      await new Promise((resolve, reject) => {
        hiddenVideo.onloadedmetadata = () => {
          hiddenVideo.play().then(resolve).catch(reject);
        };
        hiddenVideo.onerror = reject;
      });

      const vw = hiddenVideo.videoWidth;
      const vh = hiddenVideo.videoHeight;

      // 3. Setup canvas
      const canvas = document.createElement("canvas");
      canvas.width = vw;
      canvas.height = vh;
      canvasRef.current = canvas;
      const ctx = canvas.getContext("2d");

      // 4. Draw loop — applies zoom by cropping source rect
      //    ZOOM_LEVEL < 1: crop is larger than video (clamped to full) → wide/zoomed-out
      //    ZOOM_LEVEL > 1: crop is smaller than video → zoomed in
      const drawFrame = () => {
        if (!hiddenVideoRef.current || !canvasRef.current) return;

        const sw = Math.min(vw / ZOOM_LEVEL, vw);
        const sh = Math.min(vh / ZOOM_LEVEL, vh);
        const sx = (vw - sw) / 2;
        const sy = (vh - sh) / 2;

        ctx.drawImage(hiddenVideo, sx, sy, sw, sh, 0, 0, vw, vh);
        animationFrameRef.current = requestAnimationFrame(drawFrame);
      };
      drawFrame();

      // 5. Capture canvas as stream
      const canvasStream = canvas.captureStream(30);

      // 6. Attach canvas stream to the preview <video> element
      if (videoElRef.current) {
        videoElRef.current.srcObject = canvasStream;
        videoElRef.current.play().catch(() => {});
      }

      setCameraReady(true);

      // 7. Wrap canvas track in a LiveKit LocalVideoTrack and publish
      const canvasTrack = canvasStream.getVideoTracks()[0];
      const livekitTrack = new LocalVideoTrack(canvasTrack);
      localVideoTrackRef.current = livekitTrack;

      await room.localParticipant.publishTrack(livekitTrack);
      console.log("📷 Mobile camera (canvas zoom) published to LiveKit");
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("❌ Camera publish failed:", err);
      let msg = "Unable to access front camera. ";
      if (err.name === "NotAllowedError")
        msg += "Please grant camera permission and refresh.";
      else if (err.name === "NotFoundError")
        msg += "No front camera found on this device.";
      else if (err.name === "NotReadableError")
        msg += "Camera is in use by another app.";
      else msg += err.message;
      setPhase("error");
      setError(msg);
    }
  }, []);

  // ── Step 2: Join LiveKit room ──────────────────────────────────────────────
  const joinLiveKitRoom = useCallback(
    async (url, token) => {
      if (!mountedRef.current) return;
      try {
        setPhase("publishing");

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          autoSubscribe: true,
          reconnectPolicy: {
            nextRetryDelayInMs: (ctx) => {
              if (ctx.retryCount < 3) return 300;
              if (ctx.retryCount < 8) return 1000;
              return null;
            },
          },
        });
        roomRef.current = room;

        room.on(RoomEvent.Connected, () => {
          if (mountedRef.current) setRoomConnected(true);
        });
        room.on(RoomEvent.Disconnected, () => {
          if (mountedRef.current) {
            setRoomConnected(false);
            setTrackPublished(false);
          }
        });
        room.on(RoomEvent.Reconnecting, () => {
          if (mountedRef.current) setPhase("publishing");
        });
        room.on(RoomEvent.Reconnected, () => {
          if (mountedRef.current) setPhase("live");
        });
        room.on(RoomEvent.LocalTrackPublished, (pub) => {
          if (pub.kind === Track.Kind.Video && mountedRef.current) {
            setTrackPublished(true);
            setPhase("live");
          }
        });

        await room.connect(url, token);
        await publishCamera(room);
      } catch (err) {
        if (!mountedRef.current) return;
        console.error("❌ LiveKit room join failed:", err);
        setPhase("error");
        setError("Failed to join the video room: " + err.message);
      }
    },
    [publishCamera],
  );

  // ── Step 1: Connect Socket ─────────────────────────────────────────────────
  const connectSocket = useCallback(() => {
    if (!sessionId || !userId) return;
    setPhase("connecting");
    setError(null);

    const socket = io(SOCKET_URL, {
      query: { interviewId: sessionId, userId, type: "settings" },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20_000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (!mountedRef.current) return;
      setSocketConnected(true);

      socket.emit("secondary_camera_connected", {
        interviewId: sessionId,
        userId,
        timestamp: Date.now(),
        streamType: "livekit",
      });

      setPhase("camera");
    });

    socket.on("disconnect", (reason) => {
      if (!mountedRef.current) return;
      setSocketConnected(false);
      if (reason !== "io client disconnect") {
        setPhase("error");
        setError("Server disconnected unexpectedly. Trying to reconnect…");
      }
    });

    socket.on("connect_error", (err) => {
      if (!mountedRef.current) return;
      console.error("❌ Mobile socket connect_error:", err.message);
      setPhase("error");
      setError("Could not reach the server. Check your connection and retry.");
    });

    socket.on("livekit_token", async ({ token, url }) => {
      console.log("📱 Mobile LiveKit URL:", url);
      if (!mountedRef.current) return;
      await joinLiveKitRoom(url, token);
    });
  }, [sessionId, userId, joinLiveKitRoom]);

  // ── Kick off on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionId && userId) connectSocket();
  }, []); // eslint-disable-line

  // ── Retry ──────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(async () => {
    setRetrying(true);
    await teardown();
    setSocketConnected(false);
    setCameraReady(false);
    setRoomConnected(false);
    setTrackPublished(false);
    setError(null);
    setTimeout(() => {
      if (mountedRef.current) {
        setRetrying(false);
        connectSocket();
      }
    }, 600);
  }, [teardown, connectSocket]);

  // ── Invalid link screen ────────────────────────────────────────────────────
  if (!sessionId || !userId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
            <svg
              className="w-7 h-7 text-red-400"
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
          <h2 className="text-lg font-semibold text-white mb-2">
            Invalid Link
          </h2>
          <p className="text-slate-500 text-sm">
            Scan the QR code from your desktop interview page to get a valid
            link.
          </p>
        </div>
      </div>
    );
  }

  const phaseConfig = {
    connecting: {
      label: "Connecting…",
      accent: "text-amber-400",
      bar: "bg-amber-400",
    },
    camera: {
      label: "Starting camera…",
      accent: "text-violet-400",
      bar: "bg-violet-500",
    },
    publishing: {
      label: "Joining session…",
      accent: "text-violet-400",
      bar: "bg-violet-500",
    },
    live: {
      label: "Streaming Live",
      accent: "text-emerald-400",
      bar: "bg-emerald-500",
    },
    error: {
      label: "Connection Error",
      accent: "text-red-400",
      bar: "bg-red-500",
    },
  };

  const cfg = phaseConfig[phase] ?? phaseConfig.connecting;
  const isLive = phase === "live";
  const isError = phase === "error";
  const isLoading = !isLive && !isError;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.10) 0%, transparent 65%), #020617",
      }}
    >
      <div className="w-full max-w-sm flex flex-col gap-4">
        {/* Header */}
        <div className="text-center mb-2">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-all duration-500 ${
              isLive
                ? "bg-emerald-500/15 border border-emerald-500/30"
                : isError
                  ? "bg-red-500/15 border border-red-500/30"
                  : "bg-violet-500/15 border border-violet-500/30"
            }`}
          >
            {isError ? (
              <svg
                className="w-7 h-7 text-red-400"
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
                className={`w-7 h-7 ${isLive ? "text-emerald-400" : "text-violet-400"}`}
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
          <h1 className="text-xl font-bold text-white tracking-tight mb-1">
            Secondary Camera
          </h1>
          <p className={`text-sm font-medium ${cfg.accent} transition-colors`}>
            {cfg.label}
          </p>
        </div>

        {/* Video preview card */}
        <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl">
          <div className="h-0.5 w-full bg-slate-800">
            <div
              className={`h-full ${cfg.bar} transition-all duration-700 ${
                isLive ? "w-full" : isError ? "w-1/4" : "w-2/3 animate-pulse"
              }`}
            />
          </div>
          <div className="relative" style={{ aspectRatio: "9/16" }}>
            {/*
              Note: we set srcObject directly in publishCamera() via videoElRef,
              so no need for a separate srcObject prop here. The canvas stream
              is attached imperatively when the camera initializes.
            */}
            <video
              ref={videoElRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 gap-3">
                {isError ? (
                  <svg
                    className="w-10 h-10 text-red-500/60"
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
                  <Spinner className="w-10 h-10 text-violet-500/60" />
                )}
                <p className="text-slate-500 text-xs">
                  {isError ? "Camera unavailable" : "Starting camera…"}
                </p>
              </div>
            )}
            {isLive && (
              <div className="absolute top-3 left-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/90 backdrop-blur-sm rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-[10px] font-bold tracking-widest">
                    LIVE
                  </span>
                </div>
              </div>
            )}
            {isLoading && cameraReady && (
              <div className="absolute top-3 left-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-600/90 backdrop-blur-sm rounded-md">
                  <Spinner className="w-2.5 h-2.5 text-white" />
                  <span className="text-white text-[10px] font-bold tracking-widest">
                    JOINING
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error panel */}
        {isError && error && (
          <div className="px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-xl">
            <p className="text-red-300 text-sm mb-3">{error}</p>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-300 text-sm font-semibold rounded-xl transition-all duration-200 disabled:opacity-50"
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

        {/* Status panel */}
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl px-4 py-1 backdrop-blur-sm">
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
            label="Session"
            value={roomConnected ? "Joined" : "Pending…"}
            active={roomConnected}
            color="yellow"
          />
          <StatusRow
            label="Stream"
            value={trackPublished ? "Publishing via LiveKit" : "Not publishing"}
            active={trackPublished}
            color="green"
          />
        </div>

        <p className="text-center text-slate-700 text-xs pb-2">
          Keep this page open throughout the interview
        </p>
      </div>
    </div>
  );
};

export default MobileCameraPage;
