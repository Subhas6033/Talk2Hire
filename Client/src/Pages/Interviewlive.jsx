import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "../Hooks/useInterviewHook";
// useVideoRecording REMOVED — useServerRecording handles all video via HTTP POST.
// socket-based video_chunk was a server no-op and blocked mic audio on the TCP socket.
import useHolisticDetection from "../Hooks/useHolisticDetectionHook";
import useScreenRecording from "../Hooks/useScreenRecording";
import useServerRecording from "../Hooks/useServerRecording";
import { useStreams } from "../Hooks/streamContext";
import streamStore from "../Hooks/streamSingleton";

// Module-level flags to survive React StrictMode double-invoke
let _globalSocketInitialized = false;
let _globalClientReadyEmitted = false;

// ── Minimal style block: ONLY keyframes + font import  ──
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&family=Lora:wght@400;500;600&display=swap');

  .font-sora { font-family: 'Sora', sans-serif; }
  .font-dm   { font-family: 'DM Mono', monospace; }
  .font-lora { font-family: 'Lora', serif; }

  @keyframes il-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(0.85); }
  }
  @keyframes il-wave {
    0%, 100% { height: 6px; }
    50%       { height: 18px; }
  }
  @keyframes il-fadeup {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes il-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes il-live {
    0%, 100% { box-shadow: 0 0 0 0 rgba(5,150,105,0.5); }
    50%       { box-shadow: 0 0 0 6px rgba(5,150,105,0); }
  }
  @keyframes il-overlay-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes il-slide-down {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .anim-fadeup    { animation: il-fadeup 0.4s ease both; }
  .anim-spin      { animation: il-spin 0.8s linear infinite; }
  .anim-overlay   { animation: il-overlay-in 0.4s ease both; }
  .anim-slidedown { animation: il-slide-down 0.3s ease both; }
  .anim-live-dot  { animation: il-live 1.5s ease-in-out infinite; }
  .anim-badge-dot { animation: il-pulse 1.4s ease-in-out infinite; }

  /* wave-bar uses animated height — can't do with Tailwind h-* */
  .wave-bar {
    width: 3px;
    height: 6px;
    border-radius: 99px;
    background: #059669;
    animation: il-wave 1s ease-in-out infinite;
  }
`;

// ── Tailwind badge color map ────────────────────────────────────────────────────
const BADGE = {
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  red: {
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  orange: {
    bg: "bg-orange-50",
    text: "text-orange-800",
    border: "border-orange-200",
    dot: "bg-orange-500",
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-800",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
  green: {
    bg: "bg-green-50",
    text: "text-green-800",
    border: "border-green-200",
    dot: "bg-green-500",
  },
  gray: {
    bg: "bg-stone-100",
    text: "text-stone-400",
    border: "border-stone-200",
    dot: "bg-stone-300",
  },
};

// ── Pure sub-components (no hooks — safe to define outside render) ─────────────

const StatusBadge = ({ label, on, color = "gray" }) => {
  const c = BADGE[on ? color : "gray"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-dm text-[10px] font-medium tracking-[0.04em] uppercase border transition-all duration-300 ${c.bg} ${c.text} ${c.border}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot} ${on ? "anim-badge-dot" : ""}`}
      />
      {label}
    </span>
  );
};

const CamChip = ({ active, activeLabel, activeColor, idleLabel }) => {
  const c = BADGE[active ? activeColor : "gray"];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-dm text-[10px] font-medium tracking-[0.04em] uppercase border transition-all duration-300 ${c.bg} ${c.text} ${c.border}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot} ${active ? "anim-badge-dot" : ""}`}
      />
      {active ? activeLabel : idleLabel}
    </span>
  );
};

const SpeakingIndicator = () => (
  <div className="flex items-center gap-1" style={{ height: 24 }}>
    {[0, 1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className="wave-bar"
        style={{ animationDelay: `${i * 0.12}s` }}
      />
    ))}
    <span className="font-dm text-[10px] text-emerald-600 tracking-[0.05em] uppercase ml-2">
      AI Speaking
    </span>
  </div>
);

const ListeningIndicator = () => (
  <div className="flex items-center gap-2">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="rounded-full bg-emerald-500 wave-bar"
        style={{ width: 7, animationDelay: `${i * 0.15}s` }}
      />
    ))}
    <span className="font-sora text-xs text-emerald-600 font-semibold">
      Listening…
    </span>
  </div>
);

const Spinner = ({ size = 20, color = "#2563EB", track = "#BFDBFE" }) => (
  <div
    className="anim-spin rounded-full shrink-0"
    style={{
      width: size,
      height: size,
      border: `2px solid ${track}`,
      borderTopColor: color,
    }}
  />
);

const LiveDot = () => (
  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 anim-live-dot" />
);

// ── Card wrapper ──────────────────────────────────────────────────────────────
const Panel = ({ children, className = "" }) => (
  <div
    className={`bg-white border border-[#E8E4DE] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)] transition-shadow duration-200 hover:shadow-[0_8px_32px_rgba(0,0,0,0.10)] ${className}`}
  >
    {children}
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────
const InterviewLive = () => {
  const navigate = useNavigate();
  const streamsRef = useStreams();

  const stableRef = useRef(null);
  if (!stableRef.current) {
    const src = streamStore.sessionData ? streamStore : streamsRef.current;
    if (src?.sessionData) {
      stableRef.current = {
        sessionData: src.sessionData,
        micStream: src.micStream,
        primaryCameraStream: src.primaryCameraStream,
        preInitializedSocket: src.preInitializedSocket,
        preWarmSessionIds: { ...(src.preWarmSessionIds ?? {}) },
        preWarmComplete: { ...(src.preWarmComplete ?? {}) },
      };
    }
  }

  const sessionData = stableRef.current?.sessionData ?? null;
  const micStream = stableRef.current?.micStream ?? null;
  const primaryCameraStream = stableRef.current?.primaryCameraStream ?? null;
  const preInitializedSocket = stableRef.current?.preInitializedSocket ?? null;
  const preWarmSessionIds = stableRef.current?.preWarmSessionIds ?? {};
  const preWarmComplete = stableRef.current?.preWarmComplete ?? {};

  const screenShareStreamRef = useRef(null);
  const interview = useInterview(
    sessionData?.interviewId,
    sessionData?.userId,
    primaryCameraStream,
  );

  const audioRecording = interview.audioRecording;
  const screenRecording = useScreenRecording(
    sessionData?.interviewId,
    sessionData?.userId,
    interview.socketRef,
    preWarmSessionIds.screenRecordingId,
  );
  const serverRecording = useServerRecording(
    sessionData?.interviewId,
    primaryCameraStream,
    micStream,
    streamStore.screenShareStream ??
      streamsRef.current?.screenShareStream ??
      null,
  );
  // Derived from serverRecording — replaces the old useVideoRecording state.
  // Must be after useServerRecording() call above.
  const isVideoRecording = serverRecording.isRecording;

  const serverRecordingStoppedRef = useRef(false);

  const videoRef = useRef(null);
  const mobileVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const recordingsStartedRef = useRef(false);
  const isLeavingRef = useRef(false);
  const screenVideoActiveRef = useRef(false);
  const mobilePcRef = useRef(null);
  const pendingMobileStreamRef = useRef(null);
  // FIX 2: Persistent ref for the live mobile stream that survives React re-renders.
  // pendingMobileStreamRef gets nulled after startSecondary() consumes it, so the
  // re-attachment useEffect (which runs after every re-render) would find null and
  // silently skip re-attaching — leaving the video element blank. liveMobileStreamRef
  // is never nulled and always holds the last active stream for re-attachment.
  const liveMobileStreamRef = useRef(null);

  const [evaluationStatus, setEvaluationStatus] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [faceViolationWarning, setFaceViolationWarning] = useState(null);
  const [isInterviewTerminated, setIsInterviewTerminated] = useState(false);
  const [mobileCameraConnected, setMobileCameraConnected] = useState(
    () => preWarmComplete?.secondaryCamera ?? false,
  );
  const [mobileTrackAttached, setMobileTrackAttached] = useState(false);
  const [screenVideoActive, setScreenVideoActive] = useState(false);
  const [socketReady, setSocketReady] = useState(false);

  useHolisticDetection(
    videoRef,
    interview.socketRef,
    interview.status === "live" && !interview.isInitializing,
  );

  useEffect(() => {
    return () => {
      _globalSocketInitialized = false;
      _globalClientReadyEmitted = false;
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!sessionData) {
      const t = setTimeout(() => {
        if (!stableRef.current?.sessionData)
          navigate("/interview", { replace: true });
      }, 3000);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line

  const stopServerRecordingOnce = useCallback(async () => {
    if (serverRecordingStoppedRef.current || !sessionData?.interviewId) return;
    serverRecordingStoppedRef.current = true;
    try {
      await serverRecording.stop();
    } catch (err) {
      console.error("❌ stopServerRecordingOnce:", err.message);
    }
  }, [serverRecording, sessionData]);

  const cleanupAllRecordings = useCallback(async () => {
    const jobs = [];
    // stopVideoRecording() removed — serverRecording.stop() handles primary_camera
    if (audioRecording?.isRecording) {
      try {
        audioRecording.stopRecording();
      } catch (_) {}
    }
    if (screenRecording.isRecording)
      jobs.push(screenRecording.stopRecording().catch(console.error));
    jobs.push(stopServerRecordingOnce());
    await Promise.allSettled(jobs);
  }, [audioRecording, screenRecording, stopServerRecordingOnce]); // eslint-disable-line

  useEffect(() => {
    if (!videoRef.current || !primaryCameraStream) return;
    videoRef.current.srcObject = primaryCameraStream;
    videoRef.current.muted = true;
    videoRef.current.play().catch((e) => {
      if (e.name !== "AbortError") console.error("[CAM] play error:", e);
    });
  }, []); // eslint-disable-line

  const setupMobilePeerConnection = useCallback(
    (identity) => {
      // Always close any existing PC when a new offer arrives — this handles
      // mobile retries where the old PC may be connected but its track was
      // never rendered (e.g. ontrack fired before video ref was ready and the
      // poll cleaned up, or the first ICE round failed silently).
      // Reusing a connected PC skips ontrack entirely for the new offer's track.
      if (mobilePcRef.current) {
        try {
          mobilePcRef.current.close();
        } catch (_) {}
        mobilePcRef.current = null;
      }

      const MOBILE_ICE_SERVERS = [
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
        ...(import.meta.env?.VITE_TURN_URL
          ? [
              {
                urls: import.meta.env.VITE_TURN_URL,
                username: import.meta.env.VITE_TURN_USERNAME || "",
                credential: import.meta.env.VITE_TURN_CREDENTIAL || "",
              },
            ]
          : []),
      ];
      const pc = new RTCPeerConnection({ iceServers: MOBILE_ICE_SERVERS });
      mobilePcRef.current = pc;
      mobilePcRef._pendingIce = []; // fresh buffer for this PC

      pc.onicecandidate = ({ candidate }) => {
        if (candidate && interview.socketRef.current?.connected)
          interview.socketRef.current.emit(
            "mobile_webrtc_ice_candidate_desktop",
            { candidate, identity },
          );
      };

      pc.ontrack = (event) => {
        if (event.track.kind !== "video") return;
        const rs = new MediaStream([event.track]);

        // FIX 2: Store in BOTH refs.
        // pendingMobileStreamRef: consumed by startSecondary() then nulled.
        // liveMobileStreamRef: never nulled — used by re-attachment useEffect
        // so the video element can recover after any React reconciliation.
        pendingMobileStreamRef.current = rs;
        liveMobileStreamRef.current = rs;

        const attachStream = (el) => {
          el.srcObject = rs;
          el.muted = true;
          const tryPlay = () =>
            el.play().catch((e) => {
              if (e.name === "AbortError")
                setTimeout(() => el.play().catch(() => {}), 100);
            });
          if (el.readyState >= 1) tryPlay();
          else el.addEventListener("loadedmetadata", tryPlay, { once: true });
        };

        const el = mobileVideoRef.current;
        if (el) {
          attachStream(el);
          mobilePcRef._removeFallbackCanvas?.();
          setMobileTrackAttached(true);
          setMobileCameraConnected(true);
        } else {
          // FIX 2: Video ref not mounted yet (component still rendering) — poll
          // every 100ms for up to 5 seconds. Without this, ontrack fires once
          // and is never retried, so the video element stays blank.
          let pollCount = 0;
          const pollTimer = setInterval(() => {
            pollCount++;
            const el2 = mobileVideoRef.current;
            if (el2) {
              clearInterval(pollTimer);
              attachStream(el2);
              mobilePcRef._removeFallbackCanvas?.();
              setMobileTrackAttached(true);
              setMobileCameraConnected(true);
            } else if (pollCount > 50) {
              clearInterval(pollTimer);
              console.warn(
                "⚠️ [MOBILE-VIDEO] Video ref never appeared after 5s",
              );
            }
          }, 100);
        }

        event.track.onended = () => setMobileTrackAttached(false);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          // Tell the server WebRTC is truly live so it stops relaying JPEG frames
          interview.socketRef.current?.emit("mobile_webrtc_connected");
        }
        if (["disconnected", "failed", "closed"].includes(pc.connectionState))
          setMobileTrackAttached(false);
      };

      return pc;
    },
    [interview.socketRef],
  );

  const attachScreenVideo = useCallback(() => {
    const vid = screenVideoRef.current;
    if (!vid) return false;
    const stream =
      streamStore.screenShareStream ??
      streamsRef.current?.screenShareStream ??
      null;
    if (!stream?.active) return false;
    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState !== "live") return false;
    screenShareStreamRef.current = stream;
    if (vid.srcObject !== stream) {
      vid.srcObject = stream;
      vid.muted = true;
    }
    screenVideoActiveRef.current = true;
    setScreenVideoActive(true);
    const tryPlay = () => {
      if (!vid.isConnected) return;
      vid.play().catch((e) => {
        if (e.name === "AbortError") setTimeout(tryPlay, 50);
      });
    };
    vid.addEventListener("loadedmetadata", tryPlay, { once: true });
    if (vid.readyState >= 1) tryPlay();
    const onEnded = () => {
      vid.srcObject = null;
      screenVideoActiveRef.current = false;
      setScreenVideoActive(false);
    };
    track.addEventListener("ended", onEnded);
    return () => track.removeEventListener("ended", onEnded);
  }, []); // eslint-disable-line

  useEffect(() => {
    const c = attachScreenVideo();
    if (c) return c;
    let retries = 0,
      active = null;
    const t = setInterval(() => {
      retries++;
      active = attachScreenVideo();
      if (active || retries >= 100) clearInterval(t);
    }, 100);
    return () => {
      clearInterval(t);
      if (active) active();
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (_globalSocketInitialized || !sessionData || !preInitializedSocket)
      return;
    _globalSocketInitialized = true;
    const socket = preInitializedSocket;
    const init = async () => {
      try {
        let retries = 0;
        while (!socket.connected && retries < 50) {
          await new Promise((r) => setTimeout(r, 200));
          retries++;
        }
        if (!socket.connected) {
          _globalSocketInitialized = false;
          navigate("/interview");
          return;
        }
        interview.socketRef.current = socket;

        socket.on("mobile_webrtc_offer_relay", async ({ offer, identity }) => {
          const pc = setupMobilePeerConnection(identity);
          // Do NOT clear _pendingIce here — candidates may have already arrived
          // and been buffered before this offer handler ran.
          if (!mobilePcRef._pendingIce) mobilePcRef._pendingIce = [];
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            // Drain all ICE candidates buffered before or during setRemoteDescription
            const buffered = mobilePcRef._pendingIce.splice(0);
            for (const c of buffered) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(c));
              } catch (_) {}
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("mobile_webrtc_answer", {
              answer: pc.localDescription,
              identity,
            });
            setMobileCameraConnected(true);
          } catch (err) {
            console.error("[MOBILE-PC] offer handling failed:", err.message);
          }
        });
        socket.on("mobile_webrtc_ice_from_mobile", async ({ candidate }) => {
          const pc = mobilePcRef.current;
          if (!pc || !candidate) return;
          try {
            // Only add ICE candidate if remote description is already set;
            // otherwise buffer it — setRemoteDescription hasn't been called yet.
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
              if (!mobilePcRef._pendingIce) mobilePcRef._pendingIce = [];
              mobilePcRef._pendingIce.push(candidate);
            }
          } catch (_) {}
        });

        const silenced = new Set([
          "user_audio_chunk",
          "video_chunk",
          "audio_chunk",
          "holistic_detection_result",
          "interim_transcript",
        ]);
        socket.onAny((ev) => {
          if (!silenced.has(ev)) console.log(`[SOCKET] "${ev}"`);
        });

        socket.on("secondary_camera_ready", () =>
          setMobileCameraConnected(true),
        );
        socket.on("secondary_camera_status", (d) => {
          if (d?.connected) setMobileCameraConnected(true);
        });

        // Fallback: render JPEG frames from socket while WebRTC is negotiating.
        // Once WebRTC track is attached (mobileTrackAttached), these frames are
        // ignored so there is no double-rendering or flicker.
        let _frameCvs = null;
        let _frameCtx = null;
        let _frameConnectedSet = false;
        socket.on("mobile_camera_frame", ({ frame }) => {
          // Skip if WebRTC track already delivering video
          if (!frame || mobilePcRef.current?.connectionState === "connected")
            return;
          const el = mobileVideoRef.current;
          if (!el) return;

          // Lazy-init canvas overlay — z-index 2 sits above the video (z-index 1)
          if (!_frameCvs) {
            _frameCvs = document.createElement("canvas");
            _frameCvs.style.cssText =
              "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1);z-index:2;";
            el.parentElement?.appendChild(_frameCvs);
          }
          if (!_frameCtx) {
            _frameCtx = _frameCvs.getContext("2d", { alpha: false });
          }

          // createImageBitmap decodes off the main thread — no forced reflow,
          // no layout thrash. Much faster than Image.onload + drawImage.
          fetch(`data:image/jpeg;base64,${frame}`)
            .then((r) => r.blob())
            .then((blob) => createImageBitmap(blob))
            .then((bmp) => {
              if (!_frameCvs || !_frameCtx) {
                bmp.close();
                return;
              }
              if (_frameCvs.width !== bmp.width) _frameCvs.width = bmp.width;
              if (_frameCvs.height !== bmp.height)
                _frameCvs.height = bmp.height;
              _frameCtx.drawImage(bmp, 0, 0);
              bmp.close();
              _frameCvs.style.display = "block";
              if (!_frameConnectedSet) {
                _frameConnectedSet = true;
                setMobileCameraConnected(true);
              }
            })
            .catch(() => {});
        });

        // When WebRTC connects, remove the fallback canvas so the video shows through
        const _removeFallbackCanvas = () => {
          if (_frameCvs) {
            _frameCvs.remove();
            _frameCvs = null;
            _frameCtx = null;
            _frameConnectedSet = false;
          }
        };
        // Expose cleanup so ontrack can call it after attaching the stream
        mobilePcRef._removeFallbackCanvas = _removeFallbackCanvas;
        socket.on("question", (d) => interview.handleQuestion(d));
        socket.on("next_question", (d) => interview.handleNextQuestion(d));
        socket.on("tts_audio", (d) => {
          if (d) interview.handleTtsAudio(d);
        });
        socket.on("tts_end", () =>
          interview.handleTtsEnd(() => {
            const ls = interview.socketRef.current;
            if (ls?.connected) ls.emit("playback_done");
          }),
        );
        socket.on("idle_prompt", (d) => interview.handleIdlePrompt(d));
        socket.on("interim_transcript", (d) => interview.setLiveTranscript(d));
        socket.on("transcript_received", (d) =>
          interview.handleTranscriptReceived(d),
        );
        socket.on("listening_enabled", () => interview.enableListening());
        socket.on("listening_disabled", () => interview.disableListening());
        socket.on("interview_complete", async (d) => {
          interview.handleInterviewComplete(d);
          await cleanupAllRecordings();
        });
        socket.on("face_violation", (d) => setFaceViolationWarning(d));
        socket.on("face_violation_cleared", () =>
          setFaceViolationWarning(null),
        );
        socket.on("interview_terminated", async () => {
          setIsInterviewTerminated(true);
          interview.setMicStreamingActive(false);
          await cleanupAllRecordings();
          isLeavingRef.current = true;
          socket.disconnect();
          navigate("/dashboard");
        });
        socket.on("evaluation_started", () => setEvaluationStatus("started"));
        socket.on("evaluation_complete", (d) => {
          setEvaluationStatus("complete");
          setEvaluationResults(d.results);
          interview.setMicStreamingActive(false);
        });
        socket.on("evaluation_error", () => setEvaluationStatus("error"));
        socket.on("disconnect", (reason) => {
          _globalSocketInitialized = false;
          _globalClientReadyEmitted = false;
          if (reason === "io server disconnect" && !isLeavingRef.current) {
            alert("Server disconnected.");
            navigate("/interview");
          }
        });
        socket.on("connect_error", (e) =>
          console.error("[SOCKET] connect_error:", e.message),
        );
        socket.on("error", (e) => console.error("[SOCKET] error event:", e));

        interview.setStatus("live");
        interview.setServerReady(true);
        interview.setIsInitializing(false);
        interview.initializeInterview({
          interviewId: sessionData.interviewId,
          userId: sessionData.userId,
        });
        setSocketReady(true);
        socket.emit("request_secondary_camera_status", {
          interviewId: sessionData.interviewId,
        });
        interview.autoStartInterview(micStream).catch(console.error);

        if (!_globalClientReadyEmitted) {
          _globalClientReadyEmitted = true;
          socket.emit("client_ready", {
            interviewId: sessionData.interviewId,
            userId: sessionData.userId,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        console.error("[SOCKET] init() FAILED:", err.message);
        _globalSocketInitialized = false;
        navigate("/interview");
      }
    };
    init();
    return () => {
      if (isLeavingRef.current) {
        cleanupAllRecordings();
        socket?.offAny();
        socket?.removeAllListeners();
        socket?.disconnect();
        interview.cleanupWebRTC();
        if (mobilePcRef.current) {
          mobilePcRef.current.close();
          mobilePcRef.current = null;
        }
      }
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (
      recordingsStartedRef.current ||
      !socketReady ||
      interview.status !== "live" ||
      interview.isInitializing ||
      !interview.serverReady ||
      !interview.hasStarted ||
      !primaryCameraStream
      // isVideoRecording guard removed — serverRecording.isRecording drives the indicator
    )
      return;
    recordingsStartedRef.current = true;
    (async () => {
      try {
        await audioRecording.startRecording(preWarmSessionIds.audioId);
        // startVideoRecording() removed — serverRecording.start() covers primary_camera
        const activeScreen =
          streamStore.screenShareStream ??
          streamsRef.current?.screenShareStream ??
          null;
        if (activeScreen?.active)
          await screenRecording.startRecording(activeScreen);
        await serverRecording.start(activeScreen);
        if (pendingMobileStreamRef.current) {
          serverRecording
            .startSecondary(pendingMobileStreamRef.current)
            .catch((e) =>
              console.error("❌ startSecondary (deferred):", e.message),
            );
          pendingMobileStreamRef.current = null;
        }
      } catch (err) {
        console.error("[REC] Startup failed:", err.message);
        recordingsStartedRef.current = false;
      }
    })();
  }, [
    socketReady,
    interview.status,
    interview.isInitializing,
    interview.serverReady,
    interview.hasStarted,
    // isVideoRecording removed from deps — was causing unnecessary re-runs
  ]); // eslint-disable-line

  useEffect(() => {
    if (!recordingsStartedRef.current || !pendingMobileStreamRef.current)
      return;
    serverRecording
      .startSecondary(pendingMobileStreamRef.current)
      .catch(console.error);
    pendingMobileStreamRef.current = null;
  }, [mobileTrackAttached]); // eslint-disable-line

  // Guard: if the video element loses its srcObject after a React re-render
  // (reconciliation can reset DOM attributes), re-attach the live stream.
  // FIX 2: Use liveMobileStreamRef (never nulled) instead of pendingMobileStreamRef
  // (nulled after startSecondary consumes it) — otherwise this effect is a no-op
  // after the first recording start and the video goes blank on every re-render.
  useEffect(() => {
    if (!mobileTrackAttached) return;
    const el = mobileVideoRef.current;
    const stream = liveMobileStreamRef.current; // FIX 2: was pendingMobileStreamRef
    if (!el || !stream?.active) return;
    if (!el.srcObject || el.srcObject !== stream) {
      console.log("[MOBILE-VIDEO] Re-attaching stream after re-render");
      el.srcObject = stream;
      el.muted = true;
      const tryPlay = () =>
        el.play().catch((e) => {
          if (e.name === "AbortError")
            setTimeout(() => el.play().catch(() => {}), 100);
        });
      if (el.readyState >= 1) tryPlay();
      else el.addEventListener("loadedmetadata", tryPlay, { once: true });
    }
  }, [mobileTrackAttached]); // eslint-disable-line

  useEffect(() => {
    if (evaluationStatus === "complete" && evaluationResults)
      setTimeout(() => navigate("/dashboard"), 2000);
  }, [evaluationStatus, evaluationResults, navigate]);

  // Add this near the top of your InterviewLive component
  useEffect(() => {
    // Force audio context to start on any user interaction
    const startAudio = () => {
      if (interview.audioCtxRef?.current?.state === "suspended") {
        interview.audioCtxRef.current.resume().then(() => {
          console.log("✅ AudioContext resumed by user gesture");
        });
      }
    };

    document.addEventListener("click", startAudio);
    document.addEventListener("keydown", startAudio);
    document.addEventListener("touchstart", startAudio);

    return () => {
      document.removeEventListener("click", startAudio);
      document.removeEventListener("keydown", startAudio);
      document.removeEventListener("touchstart", startAudio);
    };
  }, [interview.audioCtxRef]);

  const handleEndInterview = async () => {
    if (!confirm("Are you sure you want to end the interview?")) return;
    isLeavingRef.current = true;
    await cleanupAllRecordings();
    const socket = interview.socketRef.current;
    if (socket) {
      socket.offAny();
      socket.removeAllListeners();
      socket.disconnect();
    }
    interview.cleanupWebRTC();
    if (mobilePcRef.current) {
      mobilePcRef.current.close();
      mobilePcRef.current = null;
    }
    navigate("/dashboard");
  };

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (!sessionData) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="font-sora min-h-screen bg-[#F7F5F2] flex items-center justify-center">
          <div className="text-center">
            <div className="anim-spin w-12 h-12 border-2 border-stone-200 border-t-blue-500 rounded-full mx-auto mb-4" />
            <p className="font-dm text-[11px] text-stone-400 tracking-[0.06em] uppercase">
              Loading session…
            </p>
          </div>
        </div>
      </>
    );
  }

  // ── Derived values for dynamic inline styles ────────────────────────────────
  const aiIconGradient = interview.isPlaying
    ? "linear-gradient(135deg,#2563EB,#1D4ED8)"
    : interview.isListening
      ? "linear-gradient(135deg,#059669,#065F46)"
      : undefined;

  const aiIconShadow = interview.isPlaying
    ? "0 4px 16px rgba(37,99,235,0.25)"
    : interview.isListening
      ? "0 4px 16px rgba(5,150,105,0.25)"
      : undefined;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Basic SEO */}
      <title>Live AI Interview | Talk2Hire</title>

      <meta
        name="description"
        content="Attend your secure AI-powered live interview on Talk2Hire. Real-time voice interaction, smart evaluation, proctoring, screen recording, and instant AI feedback."
      />

      {/* This page should not be indexed */}
      <meta name="robots" content="noindex, nofollow" />
      <link rel="canonical" href="https://talk2hire.com/interview/live" />
      <meta name="theme-color" content="#2563eb" />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Talk2Hire" />
      <meta property="og:title" content="Live AI Interview | Talk2Hire" />
      <meta
        property="og:description"
        content="Join your AI-powered live interview session with real-time monitoring, voice interaction, and automated evaluation."
      />
      <meta property="og:url" content="https://talk2hire.com/interview/live" />
      <meta
        property="og:image"
        content="https://talk2hire.com/talk2hirelogo.jpeg"
      />
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Live AI Interview | Talk2Hire" />
      <meta
        name="twitter:description"
        content="Secure AI-driven live interviews with smart evaluation and proctoring."
      />
      <meta
        name="twitter:image"
        content="https://talk2hire.com/talk2hirelogo.jpeg"
      />
      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Talk2Hire Live Interview",
          url: "https://talk2hire.com/interview/live",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          browserRequirements: "Requires modern browser with WebRTC support",
          isPartOf: {
            "@type": "SoftwareApplication",
            name: "Talk2Hire",
            applicationCategory: "BusinessApplication",
          },
          publisher: {
            "@type": "Organization",
            name: "QuantamHash Corporation",
            address: {
              "@type": "PostalAddress",
              streetAddress: "800 N King Street, Suite 304",
              addressLocality: "Wilmington",
              addressRegion: "DE",
              postalCode: "19801",
              addressCountry: "US",
            },
          },
          description:
            "AI-powered live interview session with real-time voice interaction, facial monitoring, mobile camera integration, screen recording, and automated evaluation.",
          featureList: [
            "Real-time AI interviewer",
            "Voice-based question answering",
            "Live transcript generation",
            "Facial detection monitoring",
            "Secondary mobile camera integration",
            "Screen recording",
            "Automated AI evaluation",
          ],
        })}
      </script>
      <style>{STYLES}</style>

      {/* ── Page root ── */}
      <div
        className="font-sora min-h-screen bg-[#F7F5F2] px-5 py-6"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 0% 0%, rgba(37,99,235,0.03) 0%, transparent 50%)," +
            "radial-gradient(ellipse at 100% 100%, rgba(124,58,237,0.03) 0%, transparent 50%)",
        }}
      >
        <div className="max-w-7xl mx-auto">
          {/* ── Top navbar ── */}
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#F0EDE8]">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg,#2563EB,#7C3AED)",
                }}
              >
                <span className="text-white text-sm font-bold">T</span>
              </div>
              <span className="font-sora font-bold text-[15px] text-[#1C1917]">
                Talk2Hire
              </span>
              <span className="font-dm text-[10px] text-stone-400 bg-[#F7F5F2] border border-[#E8E4DE] px-2 py-0.5 rounded-full tracking-[0.05em] uppercase">
                Live Session
              </span>
            </div>
            <div className="flex items-center gap-2">
              <LiveDot />
              <span className="font-dm text-[12px] text-stone-400 tracking-[0.05em]">
                {interview.recordingDuration ?? "00:00"}
              </span>
            </div>
          </div>

          {/* ── Two-column grid ── */}
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: "1fr 340px" }}
          >
            {/* ── Main panel ── */}
            <div>
              <Panel className="flex flex-col min-h-140">
                {/* Card header */}
                <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-3.5 border-b border-[#F0EDE8]">
                  {/* AI avatar */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${!aiIconGradient ? "bg-[#F7F5F2]" : ""}`}
                      style={{
                        background: aiIconGradient,
                        boxShadow: aiIconShadow,
                      }}
                    >
                      {interview.isPlaying ? (
                        <span className="font-dm text-[13px] font-bold text-white">
                          AI
                        </span>
                      ) : (
                        <span className="text-base">🎤</span>
                      )}
                    </div>
                    <div>
                      <p className="font-sora font-bold text-sm text-[#1C1917] m-0 leading-none mb-1">
                        AI Interviewer
                      </p>
                      <p className="font-dm text-[10px] text-stone-400 tracking-[0.04em] uppercase m-0 leading-none">
                        {interview.isPlaying
                          ? "Speaking"
                          : interview.isListening
                            ? "Listening"
                            : interview.currentQuestion
                              ? "Ready"
                              : "Initialising"}
                      </p>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge
                      label="Audio"
                      on={audioRecording?.isRecording}
                      color="blue"
                    />
                    <StatusBadge
                      label="Mic"
                      on={interview.isListening}
                      color="emerald"
                    />
                    <StatusBadge
                      label="Camera"
                      on={isVideoRecording}
                      color="red"
                    />
                    <StatusBadge
                      label="Mobile"
                      on={mobileTrackAttached}
                      color="orange"
                    />
                    <StatusBadge
                      label="Screen"
                      on={screenRecording.isRecording}
                      color="purple"
                    />
                    <StatusBadge
                      label="Recording"
                      on={serverRecording.isRecording}
                      color="green"
                    />
                  </div>
                </div>
                {/* Face violation banner */}
                {faceViolationWarning && (
                  <div className="anim-slidedown flex items-center gap-2 px-5 py-2.5 bg-red-50 border-b border-red-200">
                    <span className="text-sm">⚠️</span>
                    <p className="font-sora font-semibold text-[13px] text-red-800 m-0">
                      {faceViolationWarning.type === "NO_FACE"
                        ? `No face detected — ${faceViolationWarning.max - faceViolationWarning.count} warning(s) remaining`
                        : "Multiple faces detected"}
                    </p>
                  </div>
                )}
                {/* Evaluation banner */}
                {evaluationStatus === "started" && (
                  <div className="anim-slidedown flex items-center gap-2.5 px-5 py-2.5 bg-blue-50 border-b border-blue-200">
                    <Spinner size={16} />
                    <p className="font-sora font-semibold text-[13px] text-blue-700 m-0">
                      Evaluating your responses…
                    </p>
                  </div>
                )}
                {/* Question body */}
                <div className="flex-1 flex flex-col justify-center gap-5 px-7 py-8">
                  {interview.currentQuestion ? (
                    <div className="anim-fadeup flex flex-col gap-5">
                      {/* Idle prompt */}
                      {interview.idlePrompt && (
                        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                          <p className="font-lora italic text-[13px] text-amber-800 m-0 leading-relaxed">
                            {interview.idlePrompt}
                          </p>
                        </div>
                      )}

                      {/* Question */}
                      <div>
                        <div className="flex items-center gap-2.5 mb-3.5">
                          <div className="w-7 h-7 rounded-lg bg-[#1C1917] flex items-center justify-center shrink-0">
                            <span className="font-dm text-[11px] text-white font-medium">
                              Q
                            </span>
                          </div>
                          <span className="font-dm text-[10px] text-stone-400 tracking-[0.08em] uppercase">
                            Question {interview.questionOrder ?? ""}
                          </span>
                        </div>
                        <p className="font-lora text-[22px] leading-[1.55] text-[#1C1917] m-0 font-medium">
                          {interview.currentQuestion}
                        </p>
                      </div>

                      {/* Speaking / listening indicator */}
                      {interview.isPlaying && <SpeakingIndicator />}
                      {interview.isListening && !interview.isPlaying && (
                        <ListeningIndicator />
                      )}

                      {/* Live transcript */}
                      {interview.liveTranscript && (
                        <div className="px-4 py-3 bg-[#FAFAF9] border border-[#F0EDE8] rounded-xl">
                          <p className="font-lora italic text-[13px] text-stone-500 m-0 leading-relaxed">
                            {interview.liveTranscript}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Spinner size={18} color="#7C3AED" track="#DDD6FE" />
                      <span className="font-dm text-[12px] text-stone-400 tracking-[0.04em]">
                        Waiting for first question…
                      </span>
                    </div>
                  )}
                </div>
                {/* User answer */}
                {interview.userText && (
                  <div className="anim-fadeup border-t border-[#F0EDE8] bg-[#FAFAF9] px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          background: "linear-gradient(135deg,#059669,#065F46)",
                          boxShadow: "0 2px 8px rgba(5,150,105,0.2)",
                        }}
                      >
                        <span className="font-dm text-[11px] text-white font-medium">
                          A
                        </span>
                      </div>
                      <p className="font-sora text-[13px] text-stone-500 leading-[1.65] m-0">
                        {interview.userText}
                      </p>
                    </div>
                  </div>
                )}
                {/* Card footer */}
                <div className="flex items-center justify-between border-t border-[#F0EDE8] px-5 py-3">
                  <div className="flex items-center gap-2">
                    <LiveDot />
                    <span className="font-dm text-[12px] text-stone-400 tracking-[0.05em]">
                      Live · {interview.recordingDuration ?? "00:00"}
                    </span>
                  </div>
                  <button
                    onClick={handleEndInterview}
                    className="font-sora text-[12px] font-semibold px-4.5 py-1.75 rounded-full border border-[#E8E4DE] bg-white text-[#1C1917] cursor-pointer transition-all duration-200 hover:bg-red-50 hover:border-red-200 hover:text-red-700 tracking-[0.01em]"
                  >
                    End Interview
                  </button>
                </div>
              </Panel>
            </div>

            {/* ── Right sidebar: camera panels ── */}
            <div className="flex flex-col gap-3.5">
              {/* Primary Camera */}
              <Panel>
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#F0EDE8]">
                  <span className="font-dm text-[10px] tracking-[0.08em] uppercase text-stone-400 font-medium">
                    Primary
                  </span>
                  <CamChip
                    active={isVideoRecording}
                    activeLabel="● REC"
                    activeColor="red"
                    idleLabel="STANDBY"
                  />
                </div>
                <div className="relative aspect-video bg-[#111] overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                </div>
              </Panel>

              {/* Mobile Camera */}
              <Panel>
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#F0EDE8]">
                  <span className="font-dm text-[10px] tracking-[0.08em] uppercase text-stone-400 font-medium">
                    Mobile
                  </span>
                  <CamChip
                    active={mobileTrackAttached}
                    activeLabel="● LIVE"
                    activeColor="orange"
                    idleLabel={mobileCameraConnected ? "JOINING" : "WAITING"}
                  />
                </div>
                <div className="relative aspect-video bg-[#111] overflow-hidden">
                  <video
                    id="secondary-camera-video"
                    ref={mobileVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    style={{
                      transform: "scaleX(-1)",
                      opacity: mobileTrackAttached ? 1 : 0,
                      position: "relative",
                      zIndex: 1,
                    }}
                  />
                  {!mobileCameraConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/97">
                      <Spinner size={28} color="#EA580C" track="#FED7AA" />
                      <p className="font-dm text-[10px] text-stone-400 tracking-[0.05em] uppercase m-0">
                        Waiting for mobile
                      </p>
                      <p className="font-sora text-[11px] text-stone-300 m-0">
                        Scan the QR on your phone
                      </p>
                    </div>
                  )}
                  {mobileCameraConnected && !mobileTrackAttached && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/92">
                      <Spinner size={28} color="#16A34A" track="#BBF7D0" />
                      <p className="font-dm text-[10px] text-stone-400 tracking-[0.05em] uppercase m-0">
                        Connecting stream…
                      </p>
                    </div>
                  )}
                </div>
              </Panel>

              {/* Screen Share */}
              <Panel>
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#F0EDE8]">
                  <span className="font-dm text-[10px] tracking-[0.08em] uppercase text-stone-400 font-medium">
                    Screen
                  </span>
                  <CamChip
                    active={screenRecording.isRecording}
                    activeLabel="● REC"
                    activeColor="purple"
                    idleLabel="STANDBY"
                  />
                </div>
                <div className="relative aspect-video bg-[#111] overflow-hidden">
                  <video
                    ref={screenVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  {!screenVideoActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                      <span className="text-[28px] opacity-10">🖥️</span>
                      <p className="font-dm text-[10px] text-[#C8C3BD] tracking-[0.05em] uppercase m-0">
                        {screenShareStreamRef.current
                          ? "Connecting…"
                          : "No screen share"}
                      </p>
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>

      {/* ── Interview terminated overlay ── */}
      {isInterviewTerminated && (
        <div className="anim-overlay fixed inset-0 bg-[#F7F5F2]/90 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-white border border-[#E8E4DE] rounded-2xl p-10 text-center max-w-sm w-full shadow-[0_24px_64px_rgba(0,0,0,0.12)]">
            <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-5">
              <span className="text-red-600 text-2xl font-bold">✕</span>
            </div>
            <h3 className="font-sora font-bold text-xl text-[#1C1917] m-0 mb-2">
              Interview Terminated
            </h3>
            <p className="font-sora text-[13px] text-stone-400 m-0 leading-relaxed">
              Your session was ended due to a proctoring violation.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default InterviewLive;
