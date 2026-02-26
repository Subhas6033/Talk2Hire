import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "../Hooks/useInterviewHook";
import useVideoRecording from "../Hooks/useVideoRecordingHook";
import useHolisticDetection from "../Hooks/useHolisticDetectionHook";
import useScreenRecording from "../Hooks/useScreenRecording";
import { Button } from "../Components/index";
import { Card } from "../Components/Common/Card";
import { useStreams } from "../Hooks/streamContext";
import streamStore from "../Hooks/streamSingleton";
import { RoomEvent, Track } from "livekit-client";

// Prevents double socket-init across renders (NOT used to prevent room creation —
// that is now handled by the module-level room singleton in useInterviewHook.js)
let _globalSocketInitialized = false;
let _globalClientReadyEmitted = false;

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

  // ── Token buffer ───────────────────────────────────────────────────────────
  const pendingLkTokenRef = useRef(null);
  const earlyHandlerRef = useRef(null);

  useEffect(() => {
    const socket = preInitializedSocket;
    if (!socket) return;
    const earlyHandler = (data) => {
      console.log("[BUFFER] livekit_token buffered early");
      pendingLkTokenRef.current = data;
    };
    earlyHandlerRef.current = earlyHandler;
    socket.once("livekit_token", earlyHandler);
    return () => {
      socket.off("livekit_token", earlyHandler);
      earlyHandlerRef.current = null;
    };
  }, []); // eslint-disable-line

  // ── Core hooks ─────────────────────────────────────────────────────────────
  const interview = useInterview(
    sessionData?.interviewId,
    sessionData?.userId,
    primaryCameraStream,
  );

  const {
    isRecording: isVideoRecording,
    startRecording: startVideoRecording,
    stopRecording: stopVideoRecording,
  } = useVideoRecording(
    sessionData?.interviewId,
    sessionData?.userId,
    primaryCameraStream,
    interview.socketRef,
    preWarmSessionIds.primaryCameraId,
  );

  const audioRecording = interview.audioRecording;
  const screenRecording = useScreenRecording(
    sessionData?.interviewId,
    sessionData?.userId,
    interview.socketRef,
    preWarmSessionIds.screenRecordingId,
  );

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef = useRef(null);
  const mobileVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const recordingsStartedRef = useRef(false);
  const isLeavingRef = useRef(false);
  const screenVideoActiveRef = useRef(false);
  const pendingMobileTrackRef = useRef(null);

  // ── State ──────────────────────────────────────────────────────────────────
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

  // ── Reset globals on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      _globalSocketInitialized = false;
      _globalClientReadyEmitted = false;
      if (isLeavingRef.current) {
        interview.resetLiveKitSingleton?.();
      }
    };
  }, []); // eslint-disable-line

  // ── Redirect if no session ─────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionData) {
      const t = setTimeout(() => {
        if (!stableRef.current?.sessionData)
          navigate("/interview", { replace: true });
      }, 3000);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line

  const cleanupAllRecordings = useCallback(async () => {
    const jobs = [];
    if (isVideoRecording) jobs.push(stopVideoRecording().catch(console.error));
    if (audioRecording?.isRecording) {
      try {
        audioRecording.stopRecording();
      } catch (_) {}
    }
    if (screenRecording.isRecording)
      jobs.push(screenRecording.stopRecording().catch(console.error));
    await Promise.allSettled(jobs);
  }, [isVideoRecording, audioRecording, screenRecording]); // eslint-disable-line

  // ── Primary camera ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current || !primaryCameraStream) return;
    videoRef.current.srcObject = primaryCameraStream;
    videoRef.current.muted = true;
    videoRef.current.play().catch((e) => {
      if (e.name !== "AbortError") console.error("[CAM] play error:", e);
    });
  }, []); // eslint-disable-line

  // ── Mobile track attachment ────────────────────────────────────────────────
  const doAttachMobileTrack = useCallback((track, el) => {
    try {
      try {
        track.detach(el);
      } catch (_) {}
      track.attach(el);
      setMobileTrackAttached(true);
      setMobileCameraConnected(true);
      console.log("[MOBILE] Track attached ✅");
    } catch (e) {
      console.error("[MOBILE] track.attach failed:", e.message);
    }
  }, []);

  const mobileVideoCallbackRef = useCallback(
    (el) => {
      mobileVideoRef.current = el;
      if (!el) return;
      if (pendingMobileTrackRef.current) {
        console.log("[MOBILE] Flushing pending track to newly mounted <video>");
        doAttachMobileTrack(pendingMobileTrackRef.current, el);
        pendingMobileTrackRef.current = null;
      }
    },
    [doAttachMobileTrack],
  );

  const attachMobileTrack = useCallback(
    (track) => {
      const el = mobileVideoRef.current;
      if (!el) {
        console.warn(
          "[MOBILE] <video> not in DOM yet — stashing in pendingMobileTrackRef",
        );
        pendingMobileTrackRef.current = track;
        setMobileCameraConnected(true);
        return;
      }
      doAttachMobileTrack(track, el);
    },
    [doAttachMobileTrack],
  );

  // ── Mobile camera polling + room binding ───────────────────────────────────
  useEffect(() => {
    let stopped = false;
    let pollTimer = null;
    let roomCleanup = null;
    let pollCount = 0;

    const bindRoom = (room) => {
      console.log("[POLL] Binding LiveKit room events");
      console.log(
        "  participants:",
        [...room.remoteParticipants.values()].map((p) => p.identity),
      );

      const onTrackSubscribed = (track, _pub, p) => {
        if (
          track.kind !== Track.Kind.Video ||
          !p.identity?.startsWith("mobile_")
        )
          return;
        console.log("[MOBILE] TrackSubscribed from:", p.identity);
        attachMobileTrack(track);
      };
      const onTrackUnsubscribed = (track, _pub, p) => {
        if (
          track.kind !== Track.Kind.Video ||
          !p.identity?.startsWith("mobile_")
        )
          return;
        try {
          track.detach();
        } catch (_) {}
        setMobileTrackAttached(false);
        pendingMobileTrackRef.current = null;
      };
      const onTrackPublished = (pub, p) => {
        if (pub.kind !== Track.Kind.Video || !p.identity?.startsWith("mobile_"))
          return;
        setMobileCameraConnected(true);
        if (!pub.isSubscribed) {
          try {
            pub.setSubscribed(true);
          } catch (_) {}
        }
      };
      const onParticipantConnected = (p) => {
        if (!p.identity?.startsWith("mobile_")) return;
        setMobileCameraConnected(true);
        p.trackPublications.forEach((pub) => {
          if (pub.kind !== Track.Kind.Video) return;
          if (pub.isSubscribed && pub.track) attachMobileTrack(pub.track);
          else {
            try {
              pub.setSubscribed(true);
            } catch (_) {}
          }
        });
      };
      const onParticipantDisconnected = (p) => {
        if (!p.identity?.startsWith("mobile_")) return;
        setMobileCameraConnected(false);
        setMobileTrackAttached(false);
        pendingMobileTrackRef.current = null;
      };

      room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.on(RoomEvent.TrackPublished, onTrackPublished);
      room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);

      room.remoteParticipants.forEach((p) => {
        if (!p.identity?.startsWith("mobile_")) return;
        console.log("[POLL] Found existing mobile participant:", p.identity);
        setMobileCameraConnected(true);
        p.trackPublications.forEach((pub) => {
          if (pub.kind !== Track.Kind.Video) return;
          console.log(
            "  pub subscribed:",
            pub.isSubscribed,
            "hasTrack:",
            !!pub.track,
          );
          if (pub.isSubscribed && pub.track) attachMobileTrack(pub.track);
          else {
            try {
              pub.setSubscribed(true);
            } catch (_) {}
          }
        });
      });

      return () => {
        room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
        room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
        room.off(RoomEvent.TrackPublished, onTrackPublished);
        room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
        room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      };
    };

    const tryBind = () => {
      const room = interview.livekitRoomRef?.current;
      if (!room) {
        pollCount++;
        if (pollCount % 10 === 0)
          console.log(`[POLL] Waiting for room... (${pollCount * 300}ms)`);
        return false;
      }
      clearInterval(pollTimer);
      roomCleanup = bindRoom(room);
      return true;
    };

    if (!tryBind()) {
      let elapsed = 0;
      pollTimer = setInterval(() => {
        if (stopped) {
          clearInterval(pollTimer);
          return;
        }
        elapsed += 300;
        if (elapsed >= 90_000) {
          clearInterval(pollTimer);
          return;
        }
        if (tryBind()) clearInterval(pollTimer);
      }, 300);
    }

    return () => {
      stopped = true;
      if (pollTimer) clearInterval(pollTimer);
      if (roomCleanup) roomCleanup();
    };
  }, []); // eslint-disable-line

  // ── Screen share ───────────────────────────────────────────────────────────
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
    return () => {
      track.removeEventListener("ended", onEnded);
    };
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

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN SOCKET INIT
  // ═══════════════════════════════════════════════════════════════════════════
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
          console.error("[SOCKET] Never connected");
          _globalSocketInitialized = false;
          navigate("/interview");
          return;
        }
        console.log("[SOCKET] Connected:", socket.id);
        interview.socketRef.current = socket;

        // STEP 1: Register permanent livekit_token handler FIRST
        const handleToken = (data) => {
          console.log("[SOCKET] livekit_token received ✅");
          interview.handleLiveKitToken(data).catch(console.error);
        };
        socket.on("livekit_token", handleToken);

        // STEP 2: Remove early buffer handler
        if (earlyHandlerRef.current) {
          socket.off("livekit_token", earlyHandlerRef.current);
          earlyHandlerRef.current = null;
        }

        // STEP 3: Drain buffer or request token
        if (pendingLkTokenRef.current) {
          console.log("[SOCKET] Draining buffered token");
          handleToken(pendingLkTokenRef.current);
          pendingLkTokenRef.current = null;
        } else {
          console.log("[SOCKET] Requesting livekit_token...");
          socket.emit("request_livekit_token", {
            interviewId: sessionData.interviewId,
            userId: sessionData.userId,
          });
        }

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
        socket.on("question", (d) => interview.handleQuestion(d));
        socket.on("next_question", (d) => interview.handleNextQuestion(d));
        socket.on("tts_audio", (d) => {
          if (d) interview.handleTtsAudio(d);
        });

        // FIX: Use socketRef.current instead of the closed-over `socket` variable.
        // If the socket disconnects and reconnects while TTS is playing, the old
        // `socket` reference becomes stale. Using socketRef.current always points
        // to the live socket, preventing playback_done from emitting into the void.
        socket.on("tts_end", () =>
          interview.handleTtsEnd(() => {
            const liveSocket = interview.socketRef.current;
            if (liveSocket?.connected) {
              liveSocket.emit("playback_done");
            } else {
              console.warn(
                "⚠️ playback_done: socket not connected, skipping emit",
              );
            }
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
          console.warn("[SOCKET] Disconnected:", reason);
          if (reason === "io server disconnect" && !isLeavingRef.current) {
            alert("Server disconnected.");
            navigate("/interview");
          }
        });
        socket.on("connect_error", (e) =>
          console.error("[SOCKET] connect_error:", e.message),
        );
        socket.on("error", () => interview.setStatus("error"));

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

        console.log("[SOCKET] Init complete");
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
      }
    };
  }, []); // eslint-disable-line

  // ── Start recordings ───────────────────────────────────────────────────────
  useEffect(() => {
    if (
      recordingsStartedRef.current ||
      !socketReady ||
      interview.status !== "live" ||
      interview.isInitializing ||
      !interview.serverReady ||
      !interview.hasStarted ||
      !primaryCameraStream ||
      isVideoRecording
    )
      return;
    recordingsStartedRef.current = true;
    (async () => {
      try {
        await audioRecording.startRecording(preWarmSessionIds.audioId);
        await startVideoRecording();
        const activeScreen =
          streamStore.screenShareStream ??
          streamsRef.current?.screenShareStream;
        if (activeScreen?.active)
          await screenRecording.startRecording(activeScreen);
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
    isVideoRecording,
  ]); // eslint-disable-line

  useEffect(() => {
    if (evaluationStatus === "complete" && evaluationResults)
      setTimeout(() => navigate("/dashboard"), 2000);
  }, [evaluationStatus, evaluationResults, navigate]);

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
    navigate("/dashboard");
  };

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full mx-auto" />
          <p className="text-white/50 text-sm">Loading interview session…</p>
        </div>
      </div>
    );
  }

  const Dot = ({ on, color = "gray" }) => {
    const c = {
      gray: "bg-gray-600",
      blue: "bg-blue-400",
      green: "bg-green-400",
      red: "bg-red-400",
      orange: "bg-orange-400",
      purple: "bg-purple-400",
      emerald: "bg-emerald-400",
    };
    return (
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${on ? c[color] + " animate-pulse" : "bg-gray-700"}`}
      />
    );
  };

  const StatusBadge = ({ label, on, color = "gray" }) => {
    const bg = {
      gray: "bg-gray-800 text-gray-500",
      blue: "bg-blue-900/40 text-blue-300",
      green: "bg-green-900/40 text-green-300",
      red: "bg-red-900/40 text-red-300",
      orange: "bg-orange-900/40 text-orange-300",
      purple: "bg-purple-900/40 text-purple-300",
      emerald: "bg-emerald-900/40 text-emerald-300",
    };
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${on ? bg[color] : bg.gray}`}
      >
        <Dot on={on} color={color} /> {label}
      </div>
    );
  };

  return (
    <section className="min-h-screen bg-[#0d1117] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Main panel */}
          <div className="lg:col-span-2">
            <Card className="flex flex-col border border-gray-700/60 bg-gray-800/80 shadow-2xl min-h-150">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/60 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${interview.isPlaying ? "bg-blue-600" : interview.isListening ? "bg-emerald-600" : "bg-gray-700"}`}
                  >
                    <span className="text-white text-sm font-bold">
                      {interview.isPlaying ? "AI" : "🎤"}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Talk2Hire</p>
                    <p className="text-xs text-gray-400">
                      {interview.isPlaying
                        ? "Speaking…"
                        : interview.isListening
                          ? "Listening…"
                          : interview.currentQuestion
                            ? "Ready"
                            : "Initialising…"}
                    </p>
                  </div>
                </div>
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
                </div>
              </div>

              {faceViolationWarning && (
                <div className="px-5 py-3 bg-red-900/20 border-b border-red-800/60">
                  <p className="text-sm font-semibold text-red-300">
                    ⚠️{" "}
                    {faceViolationWarning.type === "NO_FACE"
                      ? `No face detected — ${faceViolationWarning.max - faceViolationWarning.count} warning(s) remaining`
                      : "Multiple faces detected"}
                  </p>
                </div>
              )}
              {evaluationStatus === "started" && (
                <div className="px-5 py-3 bg-blue-900/20 border-b border-blue-800/60 flex items-center gap-3">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full shrink-0" />
                  <p className="text-sm font-semibold text-blue-300">
                    Evaluating your responses…
                  </p>
                </div>
              )}

              <div className="flex-1 p-6 flex flex-col justify-center space-y-5">
                {interview.currentQuestion ? (
                  <>
                    {interview.idlePrompt && (
                      <div className="p-3 bg-amber-900/20 border border-amber-800/60 rounded-xl">
                        <p className="text-sm text-amber-200">
                          {interview.idlePrompt}
                        </p>
                      </div>
                    )}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center text-xs font-bold text-white">
                          Q
                        </span>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          Question {interview.questionOrder ?? ""}
                        </span>
                      </div>
                      <p className="text-xl md:text-2xl text-white leading-relaxed font-medium">
                        {interview.currentQuestion}
                      </p>
                    </div>
                    {interview.isListening && (
                      <div className="flex items-center gap-2">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
                            style={{ animationDelay: `${i * 0.12}s` }}
                          />
                        ))}
                        <span className="text-sm text-emerald-400 font-semibold">
                          Listening…
                        </span>
                      </div>
                    )}
                    {interview.liveTranscript && (
                      <div className="p-3 bg-gray-700/40 rounded-xl border border-gray-600/40">
                        <p className="text-sm text-gray-300 italic">
                          {interview.liveTranscript}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-3 text-gray-500 text-sm">
                    <div className="animate-spin w-5 h-5 border-2 border-purple-600/40 border-t-purple-500 rounded-full" />
                    Waiting for first question…
                  </div>
                )}
              </div>

              {interview.userText && (
                <div className="border-t border-gray-700/60 p-5 bg-gray-800/60">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">
                      A
                    </span>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {interview.userText}
                    </p>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-700/60 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live • {interview.recordingDuration ?? "00:00"}
                </div>
                <Button
                  variant="secondary"
                  onClick={handleEndInterview}
                  className="text-xs px-4 py-1.5"
                >
                  End Interview
                </Button>
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div className="lg:col-span-1 space-y-3">
            {/* Primary camera */}
            <Card className="overflow-hidden border border-gray-700/60 bg-gray-800/80">
              <div className="px-3 py-2 border-b border-gray-700/60 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">
                  Primary Camera
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${isVideoRecording ? "bg-red-900/40 text-red-300" : "bg-gray-700 text-gray-500"}`}
                >
                  {isVideoRecording ? "● REC" : "STANDBY"}
                </span>
              </div>
              <div className="aspect-video bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
              </div>
            </Card>

            {/* Mobile camera */}
            <Card className="overflow-hidden border border-gray-700/60 bg-gray-800/80">
              <div className="px-3 py-2 border-b border-gray-700/60 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">
                  Mobile Camera
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${mobileTrackAttached ? "bg-orange-900/40 text-orange-300" : mobileCameraConnected ? "bg-green-900/40 text-green-300" : "bg-gray-700 text-gray-500"}`}
                >
                  {mobileTrackAttached
                    ? "● LIVE"
                    : mobileCameraConnected
                      ? "● JOINING"
                      : "WAITING"}
                </span>
              </div>
              <div className="relative aspect-video bg-black">
                <video
                  id="secondary-camera-video"
                  ref={mobileVideoCallbackRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                  style={{
                    transform: "scaleX(-1)",
                    opacity: mobileTrackAttached ? 1 : 0,
                    transition: "opacity 0.3s ease",
                  }}
                />
                {!mobileCameraConnected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/90 gap-2">
                    <div className="animate-spin w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full" />
                    <p className="text-white/60 text-xs">Waiting for mobile…</p>
                    <p className="text-gray-600 text-xs">
                      Scan the QR code on your phone
                    </p>
                  </div>
                )}
                {mobileCameraConnected && !mobileTrackAttached && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80 gap-2">
                    <div className="animate-spin w-8 h-8 border-2 border-green-500/30 border-t-green-400 rounded-full" />
                    <p className="text-white/70 text-xs">
                      Subscribing to video track…
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Screen share */}
            <Card className="overflow-hidden border border-gray-700/60 bg-gray-800/80">
              <div className="px-3 py-2 border-b border-gray-700/60 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">Screen</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${screenRecording.isRecording ? "bg-purple-900/40 text-purple-300" : "bg-gray-700 text-gray-500"}`}
                >
                  {screenRecording.isRecording ? "● REC" : "STANDBY"}
                </span>
              </div>
              <div className="relative aspect-video bg-black">
                <video
                  ref={screenVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
                {!screenVideoActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <span className="text-3xl opacity-20">🖥️</span>
                    <p className="text-gray-600 text-xs">
                      {screenShareStreamRef.current
                        ? "Connecting…"
                        : "No screen share"}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {isInterviewTerminated && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 text-center max-w-sm w-full shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-600/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-400 text-2xl">✕</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Interview Terminated
            </h3>
            <p className="text-gray-400 text-sm">
              Your session was ended due to a proctoring violation.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export default InterviewLive;
