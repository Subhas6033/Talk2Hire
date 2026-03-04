import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

// ── FIX 1: Use a reliable public TURN service (or your own).
// STUN alone fails when either peer is behind symmetric NAT (common on VPS/Cloudflare).
// openrelay.metered.ca is fine for dev; for production add your own coturn server.
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
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
    // TLS TURN — works even when port 80 is blocked
    urls: "turns:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

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

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const rawStreamRef = useRef(null);
  const videoElRef = useRef(null);
  const mountedRef = useRef(true);
  const frameTimerRef = useRef(null);
  // ── FIX 2: Track whether WebRTC was already started so we never double-call
  const webRTCStartedRef = useRef(false);

  const teardown = useCallback(async () => {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (_) {}
      pcRef.current = null;
    }
    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((t) => t.stop());
      rawStreamRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    webRTCStartedRef.current = false;
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
    // FIX: Improved frame rate and quality for better video
    const canvas = document.createElement("canvas");
    canvas.width = 640; // Increased from 320
    canvas.height = 480; // Increased from 240
    const ctx = canvas.getContext("2d");
    const vid = document.createElement("video");
    vid.autoplay = true;
    vid.playsInline = true;
    vid.muted = true;
    vid.srcObject = stream;

    // Target 10 fps instead of 2 fps for smoother video
    frameTimerRef.current = setInterval(() => {
      if (vid.readyState < 2) return;
      ctx.drawImage(vid, 0, 0, 640, 480);
      // Increase JPEG quality from 0.5 to 0.65 for better clarity
      const frame = canvas.toDataURL("image/jpeg", 0.65).split(",")[1];
      socketRef.current?.emit("mobile_camera_frame", {
        frame,
        timestamp: Date.now(),
      });
    }, 100); // Changed from 500ms (2 fps) to 100ms (10 fps)
  }, []);

  const startWebRTC = useCallback(
    async (socket) => {
      if (!mountedRef.current) return;
      // ── FIX 2 (cont): Hard guard — never start twice on same socket
      if (webRTCStartedRef.current) {
        console.warn("⚠️ startWebRTC called again — ignoring duplicate");
        return;
      }
      webRTCStartedRef.current = true;

      try {
        setPhase("camera");

        const rawStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
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
          videoElRef.current.play().catch(() => {});
        }

        setCameraReady(true);
        setPhase("publishing");

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;

        rawStream.getVideoTracks().forEach((track) => {
          pc.addTrack(track, rawStream);
        });

        pc.onicecandidate = ({ candidate }) => {
          if (candidate && socket?.connected) {
            console.log("📱 Sending ICE candidate to server");
            socket.emit("mobile_webrtc_ice_candidate", { candidate });
          }
        };

        // ── FIX 3: Log ICE gathering state to help diagnose TURN failures
        pc.onicegatheringstatechange = () => {
          console.log("📱 ICE gathering state:", pc.iceGatheringState);
        };

        pc.oniceconnectionstatechange = () => {
          console.log("📱 ICE connection state:", pc.iceConnectionState);
          if (pc.iceConnectionState === "failed") {
            console.error("❌ ICE failed — TURN servers may be unreachable");
            // Attempt ICE restart
            pc.restartIce?.();
          }
        };

        pc.onconnectionstatechange = () => {
          if (!mountedRef.current) return;
          const state = pc.connectionState;
          console.log("📱 WebRTC connection state:", state);
          if (state === "connected") {
            setPeerConnected(true);
            setTrackPublished(true);
            setPhase("live");
          }
          if (state === "failed" || state === "disconnected") {
            setPeerConnected(false);
            setTrackPublished(false);
            // ── FIX 4: Auto-recover on transient disconnects
            if (state === "failed") {
              console.warn(
                "⚠️ Peer connection failed — will retry on next socket reconnect",
              );
              webRTCStartedRef.current = false;
            }
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log("📱 Sending WebRTC offer, identity=mobile_" + userId);

        socket.emit("mobile_webrtc_offer", {
          offer: pc.localDescription,
          identity: `mobile_${userId}`,
        });

        // ── FIX 5: Use socket.once with a generous timeout; don't leave dangling listeners
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            socket.off("mobile_webrtc_answer_from_server", handleAnswer);
            reject(
              new Error(
                "Timed out waiting for WebRTC answer from desktop (30s)",
              ),
            );
          }, 30_000);

          const handleAnswer = async ({ answer }) => {
            clearTimeout(timeout);
            if (!mountedRef.current) return resolve();
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
              console.log("📱 Remote description set — handshake done");
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          socket.once("mobile_webrtc_answer_from_server", handleAnswer);
        });

        // ICE candidates from desktop — attach after remote desc is set
        socket.on("mobile_webrtc_ice_from_desktop", async ({ candidate }) => {
          if (!pcRef.current || !candidate) return;
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (_) {}
        });

        startFrameRelay(rawStream);
      } catch (err) {
        if (!mountedRef.current) return;
        console.error("❌ Mobile WebRTC start failed:", err);
        webRTCStartedRef.current = false;
        let msg = "Unable to start camera stream. ";
        if (err.name === "NotAllowedError")
          msg =
            "Camera permission denied. Please allow camera access and retry.";
        else if (err.name === "NotFoundError")
          msg = "No front camera found on this device.";
        else if (err.name === "NotReadableError")
          msg = "Camera is in use by another app.";
        else if (err.message?.includes("Timed out"))
          msg =
            "Desktop not ready yet — make sure the interview page is open, then retry.";
        else msg += err.message;
        setPhase("error");
        setError(msg);
      }
    },
    [applyHardwareZoomOut, startFrameRelay, userId],
  );

  const connectSocket = useCallback(() => {
    if (!sessionId || !userId) return;
    setPhase("connecting");
    setError(null);
    webRTCStartedRef.current = false;

    // ── FIX 6: Cloudflare WebSocket proxying requires these specific options.
    // Cloudflare strips the "Upgrade" header for non-Enterprise unless the
    // subdomain has WebSockets enabled in the dashboard (Network → WebSockets).
    // The path must also match what your server listens on (default: /socket.io/).
    const socket = io(SOCKET_URL, {
      query: { interviewId: sessionId, userId, type: "settings" },
      transports: ["websocket"],
      upgrade: false, // don't fall back to polling; fail fast instead
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 8000,
      timeout: 25_000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (!mountedRef.current) return;
      console.log("📱 Socket connected:", socket.id);
      setSocketConnected(true);

      socket.emit("secondary_camera_connected", {
        interviewId: sessionId,
        userId,
        timestamp: Date.now(),
        streamType: "webrtc",
      });

      // ── FIX 7: Don't start WebRTC immediately on connect.
      // Wait for secondary_camera_ready which confirms the desktop socket is
      // joined to the room. Without this the server has no desktopSocketId to
      // relay the offer to, and the offer gets stored as pendingMobileOffer
      // but the server's handleInterviewSocket clears it WITHOUT forwarding it.
      // The 12s fallback covers the case where the desktop is already connected.
      let readyReceived = false;
      const readyTimeout = setTimeout(async () => {
        if (!readyReceived && !webRTCStartedRef.current && mountedRef.current) {
          console.warn(
            "⚠️ secondary_camera_ready timeout — starting WebRTC anyway",
          );
          await startWebRTC(socket);
        }
      }, 12_000);

      socket.once("secondary_camera_ready", async () => {
        clearTimeout(readyTimeout);
        readyReceived = true;
        console.log("✅ secondary_camera_ready received — starting WebRTC");
        if (!webRTCStartedRef.current && mountedRef.current) {
          await startWebRTC(socket);
        }
      });
    });

    socket.on("disconnect", (reason) => {
      if (!mountedRef.current) return;
      console.warn("📱 Socket disconnected:", reason);
      setSocketConnected(false);
      webRTCStartedRef.current = false;
      if (reason !== "io client disconnect") {
        setPhase("error");
        setError("Server disconnected. Trying to reconnect…");
      }
    });

    socket.on("connect_error", (err) => {
      if (!mountedRef.current) return;
      console.error("❌ Socket connect_error:", err.message);
      // ── FIX 8: Specific Cloudflare/proxy error hints
      const cfHint = err.message?.includes("websocket")
        ? " (Check: Cloudflare WebSockets must be ON in your dashboard under Network → WebSockets)"
        : "";
      setPhase("error");
      setError(
        `Could not reach the server.${cfHint} Check your connection and retry.`,
      );
    });
  }, [sessionId, userId, startWebRTC]);

  useEffect(() => {
    if (sessionId && userId) connectSocket();
  }, []); // eslint-disable-line

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    await teardown();
    setSocketConnected(false);
    setCameraReady(false);
    setPeerConnected(false);
    setTrackPublished(false);
    setZoomApplied(false);
    setError(null);
    setTimeout(() => {
      if (mountedRef.current) {
        setRetrying(false);
        connectSocket();
      }
    }, 600);
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
      label: "Establishing peer connection…",
      accent: "text-violet-500",
      bar: "bg-violet-500",
    },
    live: {
      label: "Streaming Live",
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
          {/* Title */}
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

          {/* Video Card */}
          <div className="relative bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
            <div className="h-0.5 w-full bg-gray-100">
              <div
                className={`h-full ${cfg.bar} transition-all duration-700 ${
                  isLive ? "w-full" : isError ? "w-1/4" : "w-2/3 animate-pulse"
                }`}
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
                      LIVE
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
                      P2P…
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error Box */}
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

          {/* Status Panel */}
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
