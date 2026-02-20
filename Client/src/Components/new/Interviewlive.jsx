import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "../../Hooks/useInterviewHook";
import useVideoRecording from "../../Hooks/useVideoRecordingHook";
import useHolisticDetection from "../../Hooks/useHolisticDetectionHook";
import useScreenRecording from "../../Hooks/useScreenRecording";
import { Button } from "../index";
import { Card } from "../Common/Card";
import { useStreams } from "../../Hooks/streamContext";
import streamStore from "../../Hooks/streamSingleton";
import { RoomEvent, Track } from "livekit-client";

// Module-level flags prevent double-init across React StrictMode double-mounts
let _globalSocketInitialized = false;
let _globalClientReadyEmitted = false;

const InterviewLive = () => {
  const navigate = useNavigate();
  const streamsRef = useStreams();

  // ── Snapshot stable session data once on very first render ────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // TOKEN BUFFER
  // The server emits livekit_token immediately after the socket connects.
  // Because our main init effect runs asynchronously, the token event can
  // arrive before socket.on("livekit_token", …) is registered.
  // We pre-attach a one-shot listener on the raw socket that buffers the
  // payload; the init effect drains it as soon as it is ready.
  // ─────────────────────────────────────────────────────────────────────────
  const pendingLkTokenRef = useRef(null);
  useEffect(() => {
    const socket = preInitializedSocket;
    if (!socket) return;
    const earlyHandler = (data) => {
      console.log("📦 livekit_token buffered (arrived before init)");
      pendingLkTokenRef.current = data;
    };
    socket.once("livekit_token", earlyHandler);
    return () => socket.off("livekit_token", earlyHandler);
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

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const videoRef = useRef(null); // primary camera
  const mobileVideoRef = useRef(null); // mobile LiveKit remote track
  const screenVideoRef = useRef(null); // screen share preview

  // ── Control refs ───────────────────────────────────────────────────────────
  const recordingsStartedRef = useRef(false);
  const isLeavingRef = useRef(false);
  const screenVideoActiveRef = useRef(false);
  const mobileTrackScanDoneRef = useRef(false); // prevent duplicate retroactive scan

  // ── UI state ───────────────────────────────────────────────────────────────
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

  // ── Face detection ─────────────────────────────────────────────────────────
  useHolisticDetection(
    videoRef,
    interview.socketRef,
    interview.status === "live" && !interview.isInitializing,
  );

  // ── Reset module flags on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      _globalSocketInitialized = false;
      _globalClientReadyEmitted = false;
    };
  }, []);

  // ── Redirect if session missing ────────────────────────────────────────────
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

  // ── Primary camera preview ─────────────────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current || !primaryCameraStream) return;
    videoRef.current.srcObject = primaryCameraStream;
    videoRef.current.muted = true;
    videoRef.current.play().catch((e) => {
      if (e.name !== "AbortError") console.error("Primary cam:", e);
    });
  }, []); // eslint-disable-line

  // ═══════════════════════════════════════════════════════════════════════════
  // MOBILE CAMERA — LiveKit remote track
  //
  // WHY IT SHOWED "JOINING" FOREVER:
  //
  // 1. `interview.livekitRoomRef.current` is null when the component mounts.
  //    The room only connects after handleLiveKitToken() is called, which is
  //    called from the socket listener registered in the main init effect.
  //
  // 2. The token event arrives quickly — sometimes BEFORE the socket listener
  //    is registered (hence the buffer above).  Even with the buffer, the room
  //    connect is async and happens ~50-200 ms later.
  //
  // 3. A useEffect([]) dependency on a ref VALUE does not re-run.  So the
  //    old code ran once at mount, found room=null, registered no listeners,
  //    and never tried again.
  //
  // FIX: Poll for the room every 300 ms.  The moment it appears, bind all
  // LiveKit room events AND do a retroactive scan for participants/tracks that
  // already exist (mobile may have joined before we were listening).
  // ═══════════════════════════════════════════════════════════════════════════
  const attachMobileTrack = useCallback((track) => {
    const el = mobileVideoRef.current;
    if (!el) {
      // Element may not be in DOM yet (e.g. React hasn't committed yet).
      // Retry on next animation frame.
      requestAnimationFrame(() => {
        const el2 = mobileVideoRef.current;
        if (!el2) {
          console.error("❌ mobileVideoRef still null");
          return;
        }
        try {
          track.attach(el2);
          setMobileTrackAttached(true);
          setMobileCameraConnected(true);
          console.log("📱 Mobile track attached (rAF retry) ✅");
        } catch (e) {
          console.error("❌ attach (retry):", e);
        }
      });
      return;
    }
    try {
      track.attach(el);
      setMobileTrackAttached(true);
      setMobileCameraConnected(true);
      console.log("📱 Mobile LiveKit track attached ✅");
    } catch (e) {
      console.error("❌ attach:", e);
    }
  }, []);

  // FIX 4: Reset mobileTrackScanDoneRef if no track was actually attached so
  // the next poll attempt can re-scan (handles the case where the participant
  // was found but their track wasn't subscribed yet at scan time).
  const scanForExistingMobileTracks = useCallback(
    (room) => {
      if (mobileTrackScanDoneRef.current) return;
      mobileTrackScanDoneRef.current = true;

      let attached = false;
      room.remoteParticipants.forEach((p) => {
        if (!p.identity?.startsWith("mobile_")) return;
        console.log("📱 Retroactive scan — found:", p.identity);
        setMobileCameraConnected(true);
        p.trackPublications.forEach((pub) => {
          if (pub.kind === Track.Kind.Video && pub.isSubscribed && pub.track) {
            console.log("📱 Attaching existing track:", pub.trackSid);
            attachMobileTrack(pub.track);
            attached = true;
          } else if (pub.kind === Track.Kind.Video) {
            console.log(
              "📱 Track found but not yet subscribed — waiting for TrackSubscribed:",
              pub.trackSid,
            );
          }
        });
      });

      // FIX 4: if we found participants but couldn't attach (not subscribed
      // yet), reset the flag so TrackSubscribed or a future scan can retry.
      if (!attached) {
        mobileTrackScanDoneRef.current = false;
      }
    },
    [attachMobileTrack],
  );

  useEffect(() => {
    let stopped = false;
    let pollTimer = null;
    let roomCleanup = null;

    const bindRoom = (room) => {
      // Step 1: Register listeners BEFORE scanning
      const onTrackSubscribed = (track, _pub, p) => {
        console.log(`📡 TrackSubscribed: ${p.identity} kind=${track.kind}`);
        if (
          track.kind !== Track.Kind.Video ||
          !p.identity?.startsWith("mobile_")
        )
          return;
        const el = mobileVideoRef.current;
        if (!el) {
          console.error("❌ mobileVideoRef is null at TrackSubscribed");
          return;
        }
        track.attach(el);
        setMobileTrackAttached(true);
        setMobileCameraConnected(true);
        console.log("✅ Mobile track attached via TrackSubscribed");
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
      };

      // FIX: handle tracks that are published but not yet subscribed
      const onTrackPublished = (pub, p) => {
        console.log(
          `📢 TrackPublished: ${p.identity} kind=${pub.kind} subscribed=${pub.isSubscribed}`,
        );
        if (pub.kind !== Track.Kind.Video || !p.identity?.startsWith("mobile_"))
          return;
        setMobileCameraConnected(true);
        // Force subscription if not already subscribed
        if (!pub.isSubscribed) {
          console.log("🔔 Track not subscribed — forcing subscription");
          pub.setSubscribed(true);
        }
      };

      const onParticipantConnected = (p) => {
        console.log(`👤 ParticipantConnected: ${p.identity}`);
        if (!p.identity?.startsWith("mobile_")) return;
        setMobileCameraConnected(true);
        p.trackPublications.forEach((pub) => {
          console.log(
            `  pub: kind=${pub.kind} subscribed=${pub.isSubscribed} hasTrack=${!!pub.track}`,
          );
          if (pub.kind !== Track.Kind.Video) return;
          if (pub.isSubscribed && pub.track) {
            const el = mobileVideoRef.current;
            if (el) {
              pub.track.attach(el);
              setMobileTrackAttached(true);
              console.log("✅ Mobile track attached via ParticipantConnected");
            }
          } else {
            // Force subscription
            console.log("🔔 Forcing subscription on ParticipantConnected");
            pub.setSubscribed(true);
          }
        });
      };

      const onParticipantDisconnected = (p) => {
        if (!p.identity?.startsWith("mobile_")) return;
        setMobileCameraConnected(false);
        setMobileTrackAttached(false);
      };

      room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.on(RoomEvent.TrackPublished, onTrackPublished); // ← NEW
      room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);

      // Step 2: Scan for participants already in the room
      room.remoteParticipants.forEach((p) => {
        if (!p.identity?.startsWith("mobile_")) return;
        console.log(`📱 Existing participant found: ${p.identity}`);
        setMobileCameraConnected(true);
        p.trackPublications.forEach((pub) => {
          console.log(
            `  track: kind=${pub.kind} subscribed=${pub.isSubscribed} hasTrack=${!!pub.track}`,
          );
          if (pub.kind !== Track.Kind.Video) return;
          if (pub.isSubscribed && pub.track) {
            const el = mobileVideoRef.current;
            if (el) {
              pub.track.attach(el);
              setMobileTrackAttached(true);
              console.log("✅ Mobile track attached via retroactive scan");
            }
          } else {
            // Force subscription for already-published but unsubscribed tracks
            console.log("🔔 Forcing subscription in retroactive scan");
            pub.setSubscribed(true);
          }
        });
      });

      return () => {
        room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
        room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
        room.off(RoomEvent.TrackPublished, onTrackPublished); // ← NEW
        room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
        room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      };
    };

    const tryBind = () => {
      const room = interview.livekitRoomRef?.current;
      if (!room) return false;
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
        if (tryBind() || elapsed >= 90_000) clearInterval(pollTimer);
      }, 300);
    }

    return () => {
      stopped = true;
      if (pollTimer) clearInterval(pollTimer);
      if (roomCleanup) roomCleanup();
    };
  }, []); // eslint-disable-line

  // ── Screen share preview ───────────────────────────────────────────────────
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
        else if (e.name !== "NotAllowedError") console.error("Screen play:", e);
      });
    };
    vid.addEventListener("loadedmetadata", tryPlay, { once: true });
    vid.addEventListener("canplay", tryPlay, { once: true });
    if (vid.readyState >= 1) tryPlay();

    const onEnded = () => {
      vid.srcObject = null;
      screenVideoActiveRef.current = false;
      setScreenVideoActive(false);
      screenShareStreamRef.current = null;
    };
    track.addEventListener("ended", onEnded);
    return () => {
      vid.removeEventListener("loadedmetadata", tryPlay);
      vid.removeEventListener("canplay", tryPlay);
      track.removeEventListener("ended", onEnded);
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    const cleanup = attachScreenVideo();
    if (cleanup) return cleanup;
    let retries = 0;
    let active = null;
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
  //
  // KEY ORDER (each step is sequential / explained):
  //
  //   1. Register livekit_token listener FIRST (drain buffer if it already
  //      arrived early) so room.connect() starts ASAP.
  //   2. Register all other socket listeners.
  //   3. Mark Redux state as "live".
  //   4. Poll secondary camera status.
  //   5. Call autoStartInterview — this waits internally for the room before
  //      publishing the mic, so Deepgram gets LiveKit audio not socket PCM.
  //   6. Emit client_ready — this triggers the server to start TTS/Deepgram.
  //      By now the room is connecting in the background, so it's likely ready
  //      before the first question finishes playing.
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (_globalSocketInitialized || !sessionData || !preInitializedSocket)
      return;
    _globalSocketInitialized = true;

    const socket = preInitializedSocket;

    const init = async () => {
      try {
        // Wait for socket connection (pre-initialised by InterviewSetup)
        let retries = 0;
        while (!socket.connected && retries < 50) {
          await new Promise((r) => setTimeout(r, 200));
          retries++;
        }
        if (!socket.connected) {
          console.error("❌ Pre-init socket never connected");
          _globalSocketInitialized = false;
          navigate("/interview");
          return;
        }

        interview.socketRef.current = socket;

        // ── 1. livekit_token — MUST come first ────────────────────────────
        const handleToken = (data) => {
          console.log("🔑 livekit_token → joining room");
          // Remove the early-buffer handler if it hasn't fired yet
          socket.off("livekit_token", earlyBufferHandler);
          interview.handleLiveKitToken(data).catch(console.error);
        };

        // eslint-disable-next-line no-use-before-define
        const earlyBufferHandler = () => {}; // placeholder; defined below
        socket.off("livekit_token"); // remove early-buffer handler registered at mount

        // Drain the buffer
        if (pendingLkTokenRef.current) {
          console.log("🔑 Draining buffered livekit_token");
          interview
            .handleLiveKitToken(pendingLkTokenRef.current)
            .catch(console.error);
          pendingLkTokenRef.current = null;
        }
        socket.on("livekit_token", handleToken);

        // ── 2. All other listeners ─────────────────────────────────────────
        const silenced = new Set([
          "user_audio_chunk",
          "video_chunk",
          "audio_chunk",
          "holistic_detection_result",
          "interim_transcript",
        ]);
        socket.onAny((ev) => {
          if (!silenced.has(ev)) console.log(`📡 "${ev}"`);
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
        socket.on("tts_end", () =>
          interview.handleTtsEnd(() => socket.emit("playback_done")),
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
        socket.on("media_merge_complete", (d) =>
          console.log("✅ Merge:", d.finalVideoUrl),
        );
        socket.on("audio_recording_error", (d) =>
          console.error("❌ Audio recording:", d),
        );
        socket.on("video_recording_error", (d) =>
          console.error("❌ Video recording:", d),
        );

        socket.on("disconnect", (reason) => {
          if (reason === "io server disconnect" && !isLeavingRef.current) {
            alert("Server disconnected unexpectedly.");
            navigate("/interview");
          }
        });

        socket.on("connect_error", (e) =>
          console.error("❌ connect_error:", e.message),
        );
        socket.on("error", () => interview.setStatus("error"));

        // ── 3. Mark interview live ─────────────────────────────────────────
        interview.setStatus("live");
        interview.setServerReady(true);
        interview.setIsInitializing(false);
        interview.initializeInterview({
          interviewId: sessionData.interviewId,
          userId: sessionData.userId,
        });
        setSocketReady(true);

        // ── 4. Poll secondary camera status ───────────────────────────────
        socket.emit("request_secondary_camera_status", {
          interviewId: sessionData.interviewId,
        });

        // ── 5. Start mic (waits for LiveKit room internally, up to 5s) ────
        interview.autoStartInterview(micStream).catch(console.error);

        // ── 6. Tell server we're ready — triggers first question + TTS ────
        if (!_globalClientReadyEmitted) {
          _globalClientReadyEmitted = true;
          socket.emit("client_ready", {
            interviewId: sessionData.interviewId,
            userId: sessionData.userId,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        console.error("❌ Socket init error:", err);
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

  // ── Start recordings once interview is live ────────────────────────────────
  useEffect(() => {
    if (recordingsStartedRef.current) return;
    if (
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
        if (activeScreen?.active) {
          await screenRecording.startRecording(activeScreen);
          console.log("✓ Screen recording started");
        }
      } catch (err) {
        console.error("❌ Recording startup:", err);
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

  // ── Navigate to dashboard after evaluation ────────────────────────────────
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

  // ── Loading guard ──────────────────────────────────────────────────────────
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

  // ── Tiny UI helpers ────────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="min-h-screen bg-[#0d1117] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* ── Main interview panel ───────────────────────────────────── */}
          <div className="lg:col-span-2">
            <Card className="flex flex-col border border-gray-700/60 bg-gray-800/80 shadow-2xl min-h-150">
              {/* Topbar */}
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
                    <p className="text-sm font-bold text-white">AI Interview</p>
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

              {/* Violation banner */}
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

              {/* Evaluation banner */}
              {evaluationStatus === "started" && (
                <div className="px-5 py-3 bg-blue-900/20 border-b border-blue-800/60 flex items-center gap-3">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full shrink-0" />
                  <p className="text-sm font-semibold text-blue-300">
                    Evaluating your responses…
                  </p>
                </div>
              )}

              {/* Question area */}
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

              {/* Answer */}
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

              {/* Footer */}
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

          {/* ── Right column ───────────────────────────────────────────── */}
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
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    mobileTrackAttached
                      ? "bg-orange-900/40 text-orange-300"
                      : mobileCameraConnected
                        ? "bg-green-900/40 text-green-300"
                        : "bg-gray-700 text-gray-500"
                  }`}
                >
                  {mobileTrackAttached
                    ? "● LIVE"
                    : mobileCameraConnected
                      ? "● JOINING"
                      : "WAITING"}
                </span>
              </div>
              <div className="relative aspect-video bg-black">
                {/*
                  IMPORTANT: <video> is ALWAYS in the DOM so mobileVideoRef
                  is never null when track.attach() calls it.
                  visibility:hidden avoids the black rectangle before attach.
                */}
                <video
                  ref={mobileVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{
                    transform: "scaleX(-1)",
                    opacity: mobileTrackAttached ? 1 : 0, // ← opacity not visibility
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
                      Joining LiveKit room…
                    </p>
                    <p className="text-gray-500 text-xs">
                      Subscribing to video track
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

      {/* Termination modal */}
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
