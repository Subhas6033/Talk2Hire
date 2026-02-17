import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "../../Hooks/useInterviewHook";
import useVideoRecording from "../../Hooks/useVideoRecordingHook";
import useHolisticDetection from "../../Hooks/useHolisticDetectionHook";
import useScreenRecording from "../../Hooks/useScreenRecording";
import { Button } from "../index";
import { Card } from "../Common/Card";
import { useStreams } from "../../Hooks/streamContext";

let _globalSocketInitialized = false;
let _globalClientReadyEmitted = false;

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const InterviewLive = () => {
  const navigate = useNavigate();
  const streamsRef = useStreams();

  const stableRef = useRef(null);
  if (!stableRef.current && streamsRef.current?.sessionData) {
    stableRef.current = {
      sessionData: streamsRef.current.sessionData,
      micStream: streamsRef.current.micStream,
      primaryCameraStream: streamsRef.current.primaryCameraStream,
      // screenShareStream intentionally omitted — read lazily in useEffect
      preInitializedSocket: streamsRef.current.preInitializedSocket,
      preWarmSessionIds: { ...streamsRef.current.preWarmSessionIds },
      preWarmComplete: { ...streamsRef.current.preWarmComplete },
    };
  }

  const sessionData = stableRef.current?.sessionData ?? null;
  const micStream = stableRef.current?.micStream ?? null;
  const primaryCameraStream = stableRef.current?.primaryCameraStream ?? null;
  const preInitializedSocket = stableRef.current?.preInitializedSocket ?? null;
  const preWarmSessionIds = stableRef.current?.preWarmSessionIds ?? {};
  const preWarmComplete = stableRef.current?.preWarmComplete ?? {};

  // Lazy ref — populated after mount so we always read the final stream value
  const screenShareStreamRef = useRef(null);

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

  const videoRef = useRef(null);
  const mobileVideoRef = useRef(null);
  const screenVideoRef = useRef(null);

  const recordingsStartedRef = useRef(false);
  const isLeavingRef = useRef(false);
  const screenAttachAttemptRef = useRef(0); // retry counter

  // WebRTC
  const peerConnectionRef = useRef(null);
  const mobileMediaRecorderRef = useRef(null);
  const mobileChunkCountRef = useRef(0);
  const mobileSessionReadyRef = useRef(false);
  const mobileStreamRef = useRef(null);

  const [isSecondaryRecording, setIsSecondaryRecording] = useState(false);
  const [evaluationStatus, setEvaluationStatus] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [faceViolationWarning, setFaceViolationWarning] = useState(null);
  const [isInterviewTerminated, setIsInterviewTerminated] = useState(false);
  const [webrtcState, setWebrtcState] = useState("waiting");

  const [mobileCameraConnected, setMobileCameraConnected] = useState(
    () => preWarmComplete?.secondaryCamera ?? false,
  );
  // Track whether screen video is actually playing so the placeholder hides
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
  }, []);

  useEffect(() => {
    if (!sessionData) {
      const t = setTimeout(() => {
        if (!stableRef.current?.sessionData)
          navigate("/interview", { replace: true });
      }, 3000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (mobileMediaRecorderRef.current?.state !== "inactive") {
      jobs.push(
        new Promise((resolve) => {
          mobileMediaRecorderRef.current.onstop = () => resolve();
          try {
            mobileMediaRecorderRef.current.stop();
          } catch (_) {
            resolve();
          }
        }).catch(console.error),
      );
    }
    await Promise.allSettled(jobs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideoRecording, audioRecording, screenRecording]);

  // ── Primary camera ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current || !primaryCameraStream) return;
    videoRef.current.srcObject = primaryCameraStream;
    videoRef.current.muted = true;
    videoRef.current.play().catch((e) => {
      if (e.name !== "AbortError") console.error("Primary video play:", e);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Screen share video ─────────────────────────────────────────────────────
  //
  // WHY SCREEN VIDEO WAS BLANK / LAGGING:
  //
  // THE MAIN BUG was NOT here — it was in useScreenRecording.findSupportedMimeType().
  // That function created test `new MediaRecorder(stream, opts)` instances for
  // every MIME candidate (up to 12). Each constructor takes ~20-50ms on the main
  // thread because Chrome allocates hardware encoder resources synchronously.
  // Total: up to 600ms of synchronous blocking right when the user lands on
  // InterviewLive — causing the preview to appear frozen/black and the whole
  // UI to jank. Fixed in useScreenRecording.js and useVideoRecording.js by
  // switching to isTypeSupported()-only detection.
  //
  // SECONDARY ISSUE fixed here:
  // - screenVideoActive overlay waited for async play() resolution before hiding.
  //   If play() was delayed (AbortError retries, main-thread blocking), the black
  //   overlay stayed visible — hiding the video element underneath even when the
  //   stream WAS correctly attached. Fix: mark active as soon as srcObject is set
  //   on a live track, not when the play() promise resolves.
  //
  // - AbortError from play() was retried correctly but screenVideoActive state
  //   wasn't set until play() succeeded. Now we set it optimistically on srcObject
  //   assignment and only revert on track.ended.
  //
  // ── Screen share video attachment ─────────────────────────────────────────

  const attachScreenVideo = useCallback(() => {
    const vid = screenVideoRef.current;
    if (!vid) return false;

    // ONLY read from streamsRef — screenShareStream is intentionally NOT in
    // stableRef (stableRef captures at mount; the screen stream may not be
    // populated yet at that instant).
    const stream = streamsRef.current?.screenShareStream ?? null;

    if (!stream || !stream.active) return false;

    const track = stream.getVideoTracks()[0];
    if (!track) return false;

    if (track.readyState !== "live") {
      // Track already ended (e.g. user stopped sharing, or the old
      // useScreenRecording bug stopped it in onstop). Clear the dead reference
      // so future retries don't keep trying the same dead stream.
      console.warn(
        "⚠️ Screen track readyState:",
        track.readyState,
        "— clearing stale stream ref",
      );
      if (streamsRef.current) streamsRef.current.screenShareStream = null;
      return false;
    }

    screenShareStreamRef.current = stream;

    if (vid.srcObject !== stream) {
      vid.srcObject = stream;
      vid.muted = true;
    }

    // Mark active immediately when srcObject is set on a live track.
    // Don't wait for play() resolution — the stream is available the moment
    // srcObject is assigned. play() failure just means paused, not unavailable.
    setScreenVideoActive(true);

    const tryPlay = () => {
      if (!vid.isConnected) return;
      vid.play().catch((e) => {
        if (e.name === "AbortError") {
          setTimeout(tryPlay, 50);
        } else if (e.name !== "NotAllowedError") {
          console.error("Screen video play error:", e);
        }
      });
    };

    vid.addEventListener("loadedmetadata", tryPlay, { once: true });
    vid.addEventListener("canplay", tryPlay, { once: true });
    if (vid.readyState >= 1) tryPlay();

    const onTrackEnded = () => {
      console.log("🛑 Screen share track ended");
      vid.srcObject = null;
      setScreenVideoActive(false);
      screenShareStreamRef.current = null;
      if (streamsRef.current) streamsRef.current.screenShareStream = null;
    };
    track.addEventListener("ended", onTrackEnded);

    return () => {
      vid.removeEventListener("loadedmetadata", tryPlay);
      vid.removeEventListener("canplay", tryPlay);
      track.removeEventListener("ended", onTrackEnded);
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    const cleanup = attachScreenVideo();
    if (cleanup) return cleanup;

    // Retry up to 5× at 100ms intervals — handles marginal timing on slow
    // machines where React schedules the effect before streamsRef propagates.
    let retries = 0;
    const retryTimer = setInterval(() => {
      retries++;
      const c = attachScreenVideo();
      if (c || retries >= 5) clearInterval(retryTimer);
    }, 100);

    return () => clearInterval(retryTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── WebRTC: desktop answers mobile's offer ────────────────────────────────
  const startWebRTCAnswer = useCallback(
    async (socket, offerData) => {
      console.log("🖥️ Creating WebRTC answer");
      setWebrtcState("connecting");

      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
        } catch (_) {}
        peerConnectionRef.current = null;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionRef.current = pc;

      pc.ontrack = (event) => {
        console.log("🖥️ Remote track arrived:", event.track.kind);
        const [remoteStream] = event.streams;
        mobileStreamRef.current = remoteStream;

        if (mobileVideoRef.current) {
          mobileVideoRef.current.srcObject = remoteStream;
          mobileVideoRef.current.muted = true;
          const tryPlay = () =>
            mobileVideoRef.current?.play().catch((e) => {
              if (e.name === "AbortError") setTimeout(tryPlay, 50);
              else console.error("Mobile video play:", e);
            });
          mobileVideoRef.current.addEventListener("loadedmetadata", tryPlay, {
            once: true,
          });
          tryPlay();
        }

        setMobileCameraConnected(true);
        setWebrtcState("connected");
        socket.emit("webrtc_connected", {
          interviewId: sessionData?.interviewId,
        });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc_ice_candidate", {
            candidate: event.candidate,
            interviewId: sessionData?.interviewId,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log("🖥️ WebRTC state:", state);
        if (state === "connected") {
          setWebrtcState("connected");
          setMobileCameraConnected(true);
        } else if (state === "failed") {
          setWebrtcState("failed");
        } else if (state === "disconnected") {
          setTimeout(() => {
            if (peerConnectionRef.current?.connectionState !== "connected")
              setWebrtcState("failed");
          }, 5000);
        }
      };

      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: offerData.type, sdp: offerData.sdp }),
      );
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("webrtc_answer", {
        sdp: answer.sdp,
        type: answer.type,
        interviewId: sessionData?.interviewId,
      });
      console.log("🖥️ WebRTC answer sent");
    },
    [sessionData],
  ); // eslint-disable-line

  // ── Start recording from WebRTC stream ────────────────────────────────────
  const startMobileStreamRecording = useCallback(
    async (socket) => {
      const stream = mobileStreamRef.current;
      if (!stream || mobileMediaRecorderRef.current) return;

      mobileChunkCountRef.current = 0;
      const mimeTypes = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "",
      ];
      let mediaRecorder;
      for (const mimeType of mimeTypes) {
        try {
          mediaRecorder = new MediaRecorder(
            stream,
            mimeType ? { mimeType } : {},
          );
          break;
        } catch (_) {
          continue;
        }
      }
      if (!mediaRecorder) {
        console.error("❌ No MediaRecorder for mobile stream");
        return;
      }

      mobileMediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0) return;
        mobileChunkCountRef.current++;
        const chunkNum = mobileChunkCountRef.current;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (socket?.connected && mobileSessionReadyRef.current) {
            socket.emit("video_chunk", {
              videoType: "secondary_camera",
              chunkNumber: chunkNum,
              chunkData: reader.result.split(",")[1],
              isLastChunk: false,
              timestamp: Date.now(),
            });
          }
        };
        reader.readAsDataURL(e.data);
      };
      mediaRecorder.onstart = () => {
        setIsSecondaryRecording(true);
      };
      mediaRecorder.onstop = () => {
        setIsSecondaryRecording(false);
        mobileSessionReadyRef.current = false;
        if (socket?.connected) {
          socket.emit("video_recording_stop", {
            videoType: "secondary_camera",
            totalChunks: mobileChunkCountRef.current,
          });
        }
      };

      if (
        preWarmComplete.secondaryCamera &&
        preWarmSessionIds.secondaryCameraId
      ) {
        mobileSessionReadyRef.current = true;
      } else if (socket?.connected) {
        socket.emit("video_recording_start", {
          videoType: "secondary_camera",
          totalChunks: 0,
          metadata: { mimeType: "video/webm;codecs=vp9" },
        });
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            mobileSessionReadyRef.current = true;
            resolve();
          }, 5000);
          const handler = (data) => {
            if (data.videoType === "secondary_camera") {
              clearTimeout(timeout);
              socket.off("video_recording_ready", handler);
              mobileSessionReadyRef.current = true;
              resolve();
            }
          };
          socket.on("video_recording_ready", handler);
        });
      } else {
        mobileSessionReadyRef.current = true;
      }

      mediaRecorder.start(20000);
      console.log("✅ Mobile stream recording started");
    },
    [preWarmComplete, preWarmSessionIds],
  );

  // ── Main socket init ───────────────────────────────────────────────────────
  useEffect(() => {
    if (_globalSocketInitialized || !sessionData || !preInitializedSocket)
      return;
    _globalSocketInitialized = true;

    const socket = preInitializedSocket;

    const init = async () => {
      try {
        let retries = 0;
        while (!socket.connected && retries < 30) {
          await new Promise((r) => setTimeout(r, 200));
          retries++;
        }
        if (!socket.connected) {
          console.error("❌ Socket never connected");
          _globalSocketInitialized = false;
          navigate("/interview");
          return;
        }

        // Assign socket ref and signal readiness BEFORE any await
        interview.socketRef.current = socket;
        setSocketReady(true);

        // WebRTC signaling — before any await
        socket.on("webrtc_offer", async (data) => {
          try {
            await startWebRTCAnswer(socket, data);
          } catch (err) {
            console.error("WebRTC answer failed:", err);
            setWebrtcState("failed");
          }
        });
        socket.on("webrtc_ice_candidate", async (data) => {
          if (!data.fromMobile) return;
          const pc = peerConnectionRef.current;
          if (!pc || !data.candidate) return;
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (err) {
            console.warn("ICE candidate error:", err.message);
          }
        });
        socket.on("webrtc_failed", () => setWebrtcState("failed"));
        socket.on("secondary_camera_ready", () =>
          setMobileCameraConnected(true),
        );
        socket.on("secondary_camera_status", (d) => {
          if (d.connected) setMobileCameraConnected(true);
        });

        // All other listeners
        const silenced = new Set([
          "user_audio_chunk",
          "video_chunk",
          "audio_chunk",
          "holistic_detection_result",
          "interim_transcript",
          "webrtc_ice_candidate",
        ]);
        socket.onAny((ev) => {
          if (!silenced.has(ev)) console.log(`📡 [socket] "${ev}"`);
        });

        socket.on("question", (d) => interview.handleQuestion(d));
        socket.on("next_question", (d) => interview.handleNextQuestion(d));
        socket.on("tts_audio", (d) => {
          if (d) interview.handleTtsAudio(d);
        });
        socket.on("tts_end", () => interview.handleTtsEnd());
        socket.on("idle_prompt", (d) => interview.handleIdlePrompt(d));
        socket.on("interim_transcript", (d) => interview.setLiveTranscript(d));
        socket.on("transcript_received", (d) =>
          interview.handleTranscriptReceived(d),
        );
        socket.on("listening_enabled", () => {
          interview.enableListening();
        });
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
          console.log("✅ Media merge:", d.finalVideoUrl),
        );
        socket.on("audio_recording_error", (d) =>
          console.error("❌ Audio error:", d),
        );
        socket.on("video_recording_error", (d) =>
          console.error("❌ Video error:", d),
        );
        socket.on("disconnect", (reason) => {
          if (reason === "io server disconnect" && !isLeavingRef.current) {
            alert("Server disconnected unexpectedly.");
            navigate("/interview");
          }
        });
        socket.on("connect_error", (e) =>
          console.error("❌ Connect error:", e.message),
        );
        socket.on("error", () => interview.setStatus("error"));

        interview.setStatus("live");
        interview.setServerReady(true);
        interview.setIsInitializing(false);
        interview.initializeInterview({
          interviewId: sessionData.interviewId,
          userId: sessionData.userId,
        });
        socket.emit("request_secondary_camera_status", {
          interviewId: sessionData.interviewId,
        });

        if (!_globalClientReadyEmitted) {
          _globalClientReadyEmitted = true;
          socket.emit("client_ready", {
            interviewId: sessionData.interviewId,
            userId: sessionData.userId,
            timestamp: Date.now(),
          });
        }

        await interview.autoStartInterview(micStream);
      } catch (err) {
        console.error("❌ Socket init failed:", err);
        _globalSocketInitialized = false;
        navigate("/interview");
      }
    };

    init();

    return () => {
      if (isLeavingRef.current) {
        cleanupAllRecordings();
        if (peerConnectionRef.current) {
          try {
            peerConnectionRef.current.close();
          } catch (_) {}
        }
        socket?.offAny();
        socket?.removeAllListeners();
        socket?.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start secondary recording when WebRTC connects ────────────────────────
  useEffect(() => {
    if (
      webrtcState !== "connected" ||
      !mobileStreamRef.current ||
      mobileMediaRecorderRef.current ||
      interview.status !== "live" ||
      !socketReady
    )
      return;
    startMobileStreamRecording(interview.socketRef.current).catch(
      console.error,
    );
  }, [webrtcState, interview.status, socketReady, startMobileStreamRecording]);

  // ── Start primary recordings ───────────────────────────────────────────────
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

        const activeScreenStream = screenShareStreamRef.current;
        if (activeScreenStream && activeScreenStream.active) {
          await screenRecording.startRecording(activeScreenStream);
          console.log("✓ Screen recording started");
        }
      } catch (err) {
        console.error("❌ Recording startup failed:", err);
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
  ]);

  useEffect(() => {
    if (evaluationStatus === "complete" && evaluationResults) {
      setTimeout(() => navigate("/dashboard"), 2000);
    }
  }, [evaluationStatus, evaluationResults, navigate]);

  const handleEndInterview = async () => {
    if (!confirm("End the interview?")) return;
    isLeavingRef.current = true;
    await cleanupAllRecordings();
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (_) {}
    }
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full mx-auto mb-4" />
          <p className="text-white text-sm">Loading interview session…</p>
        </div>
      </div>
    );
  }

  const StatusBadge = ({ label, active, color = "gray" }) => (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${active ? `bg-${color}-900/30 text-${color}-300` : "bg-gray-800 text-gray-500"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${active ? `bg-${color}-400 animate-pulse` : "bg-gray-600"}`}
      />
      {label}
    </div>
  );

  const mobileStatusLabel =
    webrtcState === "connected"
      ? "● LIVE · P2P"
      : webrtcState === "connecting"
        ? "CONNECTING"
        : webrtcState === "failed"
          ? "FAILED"
          : "WAITING";
  const mobileStatusClass =
    webrtcState === "connected"
      ? "text-orange-300 bg-orange-900/30"
      : webrtcState === "failed"
        ? "text-red-300 bg-red-900/30"
        : "text-gray-500 bg-gray-700";

  return (
    <section className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* ── Main interview panel ── */}
          <div className="lg:col-span-2">
            <Card className="flex flex-col overflow-hidden shadow-xl border border-gray-700 bg-gray-800 min-h-150">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${interview.isPlaying ? "bg-blue-600" : interview.isListening ? "bg-emerald-600" : "bg-gray-700"}`}
                  >
                    <span className="text-white text-sm font-bold">
                      {interview.isPlaying ? "AI" : "🎤"}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      AI Interview
                    </h2>
                    <p className="text-xs text-gray-400">
                      {interview.isPlaying
                        ? "Speaking…"
                        : interview.isListening
                          ? "Listening…"
                          : "Ready"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <StatusBadge
                    label="Audio"
                    active={audioRecording?.isRecording}
                    color="blue"
                  />
                  <StatusBadge
                    label="Mic"
                    active={interview.isListening}
                    color="emerald"
                  />
                  <StatusBadge
                    label="Camera"
                    active={isVideoRecording}
                    color="red"
                  />
                  <StatusBadge
                    label="Mobile"
                    active={isSecondaryRecording}
                    color="orange"
                  />
                  <StatusBadge
                    label="Screen"
                    active={screenRecording.isRecording}
                    color="purple"
                  />
                </div>
              </div>

              {faceViolationWarning && (
                <div className="px-5 py-3 bg-red-900/20 border-b border-red-800">
                  <p className="text-sm font-semibold text-red-300">
                    ⚠️{" "}
                    {faceViolationWarning.type === "NO_FACE"
                      ? "No face detected — please stay in frame"
                      : "Multiple faces detected"}
                  </p>
                </div>
              )}
              {evaluationStatus === "started" && (
                <div className="px-5 py-3 bg-blue-900/20 border-b border-blue-800 flex items-center gap-3">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                  <p className="text-sm font-semibold text-blue-300">
                    Evaluating your responses…
                  </p>
                </div>
              )}

              <div className="flex-1 p-6 flex flex-col justify-center space-y-6">
                {interview.currentQuestion ? (
                  <>
                    {interview.idlePrompt && (
                      <div className="p-3 bg-amber-900/20 border border-amber-800 rounded-xl">
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
                          Question {interview.questionOrder}
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
                            className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"
                            style={{ animationDelay: `${i * 0.1}s` }}
                          />
                        ))}
                        <span className="text-sm text-emerald-400 font-semibold">
                          Listening…
                        </span>
                      </div>
                    )}
                    {interview.liveTranscript && (
                      <div className="p-3 bg-gray-700/60 rounded-xl border border-gray-600">
                        <p className="text-sm text-gray-300 italic">
                          {interview.liveTranscript}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center text-gray-500 text-sm">
                    Waiting for first question…
                  </div>
                )}
              </div>

              {interview.userText && (
                <div className="border-t border-gray-700 p-5 bg-gray-800/80">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-xs font-bold text-white mt-0.5">
                      A
                    </span>
                    <p className="text-sm text-gray-300 flex-1">
                      {interview.userText}
                    </p>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-700 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live • {interview.recordingDuration}
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

          {/* ── Camera sidebar ── */}
          <div className="lg:col-span-1 space-y-3">
            {/* Primary camera */}
            <Card className="overflow-hidden border border-gray-700 bg-gray-800">
              <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">
                  Primary Camera
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${isVideoRecording ? "text-red-300 bg-red-900/30" : "text-gray-500 bg-gray-700"}`}
                >
                  {isVideoRecording ? "● REC" : "STANDBY"}
                </span>
              </div>
              <div className="relative aspect-video bg-black">
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

            {/* Mobile camera — WebRTC direct stream */}
            <Card className="overflow-hidden border border-gray-700 bg-gray-800">
              <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">
                  Mobile Camera
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${mobileStatusClass}`}
                >
                  {mobileStatusLabel}
                </span>
              </div>
              <div className="relative aspect-video bg-black">
                <video
                  ref={mobileVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
                {!mobileCameraConnected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10">
                    {webrtcState === "failed" ? (
                      <>
                        <span className="text-red-400 text-2xl mb-2">✕</span>
                        <p className="text-white text-xs opacity-60">
                          P2P connection failed
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="animate-spin w-8 h-8 border-2 border-orange-500/40 border-t-orange-500 rounded-full mb-2" />
                        <p className="text-white text-xs opacity-60">
                          {webrtcState === "connecting"
                            ? "Establishing P2P…"
                            : "Waiting for mobile…"}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Screen share */}
            <Card className="overflow-hidden border border-gray-700 bg-gray-800">
              <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">Screen</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${screenRecording.isRecording ? "text-purple-300 bg-purple-900/30" : "text-gray-500 bg-gray-700"}`}
                >
                  {screenRecording.isRecording ? "● REC" : "STANDBY"}
                </span>
              </div>
              <div className="relative aspect-video bg-black">
                {/*
                  Video element is always rendered so the ref is always attached.
                  srcObject is set by attachScreenVideo() with retry + AbortError
                  handling. screenVideoActive flips true the moment srcObject is
                  assigned to a live track — no waiting for async play() so the
                  placeholder never flickers back in after the stream attaches.
                */}
                <video
                  ref={screenVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
                {!screenVideoActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                    <span className="text-gray-600 text-2xl mb-2">🖥️</span>
                    <p className="text-gray-600 text-xs">
                      {screenShareStreamRef.current
                        ? "Connecting screen…"
                        : "Screen share not available"}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {isInterviewTerminated && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-2xl p-8 text-center max-w-sm mx-4 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl">✕</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Interview Terminated
              </h3>
              <p className="text-gray-400 text-sm">
                Your session has been ended.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default InterviewLive;
