import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "../../Hooks/useInterviewHook";
import useVideoRecording from "../../Hooks/useVideoRecordingHook";
import useHolisticDetection from "../../Hooks/useHolisticDetectionHook";
import useScreenRecording from "../../Hooks/useScreenRecording";
import { Button } from "../index";
import { Card } from "../Common/Card";
import { useStreams } from "../../Hooks/streamContext";

// Module-level guards — survive React StrictMode double-invoke
let _globalSocketInitialized = false;
let _globalClientReadyEmitted = false;

const InterviewLive = () => {
  const navigate = useNavigate();
  const streamsRef = useStreams();

  // Stable snapshot — read ONCE from context
  const stableRef = useRef(null);
  if (!stableRef.current && streamsRef.current?.sessionData) {
    stableRef.current = {
      sessionData: streamsRef.current.sessionData,
      micStream: streamsRef.current.micStream,
      primaryCameraStream: streamsRef.current.primaryCameraStream,
      screenShareStream: streamsRef.current.screenShareStream,
      preInitializedSocket: streamsRef.current.preInitializedSocket,
      // KEY FIX: Capture pre-warm IDs so recording hooks can skip re-registration
      preWarmSessionIds: { ...streamsRef.current.preWarmSessionIds },
      preWarmComplete: { ...streamsRef.current.preWarmComplete },
    };
  }

  const sessionData = stableRef.current?.sessionData ?? null;
  const micStream = stableRef.current?.micStream ?? null;
  const primaryCameraStream = stableRef.current?.primaryCameraStream ?? null;
  const screenShareStream = stableRef.current?.screenShareStream ?? null;
  const preInitializedSocket = stableRef.current?.preInitializedSocket ?? null;
  const preWarmSessionIds = stableRef.current?.preWarmSessionIds ?? {};
  const preWarmComplete = stableRef.current?.preWarmComplete ?? {};

  // Core hooks
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
    preWarmSessionIds.primaryCameraId, // KEY FIX: pass pre-warm ID
  );

  const audioRecording = interview.audioRecording;

  const screenRecording = useScreenRecording(
    sessionData?.interviewId,
    sessionData?.userId,
    interview.socketRef,
    preWarmSessionIds.screenRecordingId, // KEY FIX: pass pre-warm ID
  );

  // DOM refs
  const videoRef = useRef(null);
  const secondaryCanvasRef = useRef(null);
  const screenVideoRef = useRef(null);

  // Local one-time guards
  const recordingsStartedRef = useRef(false);
  const isLeavingRef = useRef(false);

  // Secondary canvas recorder
  const secondaryMediaRecorderRef = useRef(null);
  const secondaryChunkCountRef = useRef(0);
  const secondarySessionReadyRef = useRef(false);
  const [isSecondaryRecording, setIsSecondaryRecording] = useState(false);

  // UI state
  const [evaluationStatus, setEvaluationStatus] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [faceViolationWarning, setFaceViolationWarning] = useState(null);
  const [isInterviewTerminated, setIsInterviewTerminated] = useState(false);
  const [mobileCameraConnected, setMobileCameraConnected] = useState(false);

  useHolisticDetection(
    videoRef,
    interview.socketRef,
    interview.status === "live" && !interview.isInitializing,
  );

  // Reset module globals on unmount so re-mounting works
  useEffect(() => {
    return () => {
      _globalSocketInitialized = false;
      _globalClientReadyEmitted = false;
    };
  }, []);

  // Redirect if no session
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

  // Stop all recordings
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

    if (
      secondaryMediaRecorderRef.current &&
      secondaryMediaRecorderRef.current.state !== "inactive"
    ) {
      jobs.push(
        new Promise((resolve) => {
          secondaryMediaRecorderRef.current.onstop = () => resolve();
          try {
            secondaryMediaRecorderRef.current.stop();
          } catch (_) {
            resolve();
          }
        }).catch(console.error),
      );
    }

    await Promise.allSettled(jobs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideoRecording, audioRecording, screenRecording]);

  // Attach primary camera
  useEffect(() => {
    if (!videoRef.current || !primaryCameraStream) return;
    videoRef.current.srcObject = primaryCameraStream;
    videoRef.current.muted = true;
    videoRef.current.play().catch((e) => {
      if (e.name !== "AbortError") console.error("Primary video play:", e);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach screen stream — KEY FIX: the stream is already active from setup,
  // just assign srcObject directly. No need to call requestScreenShare() again.
  useEffect(() => {
    const vid = screenVideoRef.current;
    if (!vid || !screenShareStream) return;
    vid.srcObject = screenShareStream;
    vid.muted = true;
    const tryPlay = () =>
      vid.play().catch((e) => {
        if (e.name !== "AbortError") console.error("Screen video play:", e);
      });
    vid.addEventListener("loadedmetadata", tryPlay);
    tryPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Init canvas
  useEffect(() => {
    if (secondaryCanvasRef.current) {
      secondaryCanvasRef.current.width = 640;
      secondaryCanvasRef.current.height = 480;
    }
  }, []);

  // ── Secondary canvas recorder ────────────────────────────────────────────
  // KEY FIX: If the server session was pre-warmed, skip video_recording_start
  // entirely and just mark the session as ready, then start the MediaRecorder.
  // This eliminates the duplicate-registration conflict on secondary camera.
  const startSecondaryCanvasRecording = useCallback(
    async (socket) => {
      if (!secondaryCanvasRef.current || secondaryMediaRecorderRef.current)
        return;

      const canvas = secondaryCanvasRef.current;
      const canvasStream = canvas.captureStream(10);

      const mimeTypes = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "",
      ];
      let mediaRecorder;
      for (const mimeType of mimeTypes) {
        try {
          const opts = {};
          if (mimeType) opts.mimeType = mimeType;
          mediaRecorder = new MediaRecorder(canvasStream, opts);
          console.log(`✅ Secondary canvas recorder: ${mimeType || "default"}`);
          break;
        } catch (_) {
          continue;
        }
      }

      if (!mediaRecorder) {
        console.error("❌ No MediaRecorder for secondary canvas");
        return;
      }

      secondaryMediaRecorderRef.current = mediaRecorder;
      secondaryChunkCountRef.current = 0;

      mediaRecorder.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0) return;
        secondaryChunkCountRef.current++;
        const chunkNum = secondaryChunkCountRef.current;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (socket?.connected && secondarySessionReadyRef.current) {
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
        console.log("✅ Secondary canvas recording started");
        setIsSecondaryRecording(true);
      };

      mediaRecorder.onstop = () => {
        console.log(
          `🛑 Secondary canvas stopped. Chunks: ${secondaryChunkCountRef.current}`,
        );
        setIsSecondaryRecording(false);
        secondarySessionReadyRef.current = false;
        if (socket?.connected) {
          socket.emit("video_recording_stop", {
            videoType: "secondary_camera",
            totalChunks: secondaryChunkCountRef.current,
          });
        }
      };

      // KEY FIX: Pre-warmed path — session already exists on the server.
      // Just mark ready and start recording immediately. Zero extra round-trips.
      if (
        preWarmComplete.secondaryCamera &&
        preWarmSessionIds.secondaryCameraId
      ) {
        console.log(
          "♻️ Secondary camera session pre-warmed, skipping re-registration",
        );
        secondarySessionReadyRef.current = true;
      } else if (socket?.connected) {
        // Fallback: request new session (e.g. mobile was not connected during setup)
        console.log("📤 Requesting secondary camera session (no pre-warm)...");
        socket.emit("video_recording_start", {
          videoType: "secondary_camera",
          totalChunks: 0,
          metadata: { mimeType: "video/webm;codecs=vp9" },
        });

        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(
              "⚠️ Secondary camera confirm timeout, starting anyway",
            );
            secondarySessionReadyRef.current = true;
            resolve();
          }, 5000);
          const handler = (data) => {
            if (data.videoType === "secondary_camera") {
              clearTimeout(timeout);
              socket.off("video_recording_ready", handler);
              secondarySessionReadyRef.current = true;
              console.log("✅ Secondary canvas session confirmed");
              resolve();
            }
          };
          socket.on("video_recording_ready", handler);
        });
      } else {
        secondarySessionReadyRef.current = true;
      }

      mediaRecorder.start(20000);
    },
    [preWarmComplete, preWarmSessionIds],
  );

  // ==========================================================================
  // MAIN SOCKET INIT — exactly once
  // ==========================================================================
  useEffect(() => {
    if (_globalSocketInitialized || !sessionData || !preInitializedSocket)
      return;
    _globalSocketInitialized = true;

    const socket = preInitializedSocket;
    interview.socketRef.current = socket;

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

        console.log(`✅ Socket ready: ${socket.id}`);

        const silenced = new Set([
          "user_audio_chunk",
          "video_chunk",
          "audio_chunk",
          "holistic_detection_result",
          "interim_transcript",
        ]);
        socket.onAny((ev) => {
          if (!silenced.has(ev)) console.log(`📡 [socket] "${ev}"`);
        });

        // Register ALL listeners BEFORE emitting client_ready
        socket.on("question", (d) => interview.handleQuestion(d));
        socket.on("next_question", (d) => interview.handleNextQuestion(d));
        socket.on("tts_audio", (d) => {
          if (d) {
            console.log(
              `🔊 TTS chunk received (${typeof d === "object" ? d.audio?.length || 0 : d.length} b64 chars)`,
            );
            interview.handleTtsAudio(d);
          }
        });
        socket.on("tts_end", () => interview.handleTtsEnd());
        socket.on("idle_prompt", (d) => interview.handleIdlePrompt(d));
        socket.on("interim_transcript", (d) => interview.setLiveTranscript(d));
        socket.on("transcript_received", (d) =>
          interview.handleTranscriptReceived(d),
        );
        socket.on("listening_enabled", () => {
          console.log("✅ listening_enabled received");
          interview.enableListening();
        });
        socket.on("listening_disabled", () => interview.disableListening());

        socket.on("interview_complete", async (d) => {
          interview.handleInterviewComplete(d);
          await cleanupAllRecordings();
        });

        socket.on("secondary_camera_ready", () => {
          console.log("✅ Mobile camera connected");
          setMobileCameraConnected(true);
        });
        socket.on("secondary_camera_status", (d) => {
          if (d.connected) setMobileCameraConnected(true);
        });
        socket.on("mobile_camera_frame", (data) => {
          if (!data?.frame || !secondaryCanvasRef.current) return;
          const canvas = secondaryCanvasRef.current;
          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) return;
          const img = new Image();
          img.onload = () => {
            if (img.naturalWidth > 0) {
              if (canvas.width !== img.naturalWidth)
                canvas.width = img.naturalWidth;
              if (canvas.height !== img.naturalHeight)
                canvas.height = img.naturalHeight;
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = data.frame;
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
          console.log("✅ Media merge complete:", d.finalVideoUrl),
        );
        socket.on("audio_recording_error", (d) =>
          console.error("❌ Audio error:", d),
        );
        socket.on("video_recording_error", (d) =>
          console.error("❌ Video error:", d),
        );

        socket.on("disconnect", (reason) => {
          console.log("🔌 Socket disconnect:", reason);
          if (reason === "io server disconnect" && !isLeavingRef.current) {
            alert("Server disconnected unexpectedly.");
            navigate("/interview");
          }
        });
        socket.on("connect_error", (e) =>
          console.error("❌ Connect error:", e.message),
        );
        socket.on("error", () => interview.setStatus("error"));

        // Set state
        interview.setStatus("live");
        interview.setServerReady(true);
        interview.setIsInitializing(false);
        interview.initializeInterview({
          interviewId: sessionData.interviewId,
          userId: sessionData.userId,
        });

        // Emit client_ready EXACTLY ONCE
        if (!_globalClientReadyEmitted) {
          _globalClientReadyEmitted = true;
          console.log("🚀 Emitting client_ready (once)");
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
        socket?.offAny();
        socket?.removeAllListeners();
        socket?.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start recordings when interview goes live ─────────────────────────────
  // KEY FIX: useVideoRecording and useScreenRecording now receive their
  // pre-warm session IDs and will skip video_recording_start internally,
  // so we can begin chunking immediately with zero server round-trips.
  useEffect(() => {
    if (recordingsStartedRef.current) return;
    if (
      interview.status !== "live" ||
      interview.isInitializing ||
      !interview.serverReady ||
      !interview.hasStarted ||
      !primaryCameraStream ||
      isVideoRecording
    )
      return;

    recordingsStartedRef.current = true;
    const socket = interview.socketRef.current;

    (async () => {
      try {
        console.log("🎬 Starting all media streams");

        // KEY FIX: Pass pre-warm audioId to avoid re-registering the audio session
        await audioRecording.startRecording(preWarmSessionIds.audioId);
        console.log("✓ Audio streaming started");

        await startVideoRecording();
        console.log("✓ Primary camera streaming started");

        if (screenShareStream) {
          // KEY FIX: Pass the already-active stream — useScreenRecording will
          // skip requestScreenShare() and use this stream directly.
          // The pre-warm ID is already stored in the hook via constructor arg.
          await screenRecording.startRecording(screenShareStream);
          console.log("✓ Screen streaming started");
        }

        await startSecondaryCanvasRecording(socket);
        console.log("✅ All media streaming active");
      } catch (err) {
        console.error("❌ Recording startup failed:", err);
        recordingsStartedRef.current = false;
      }
    })();
  }, [
    interview.status,
    interview.isInitializing,
    interview.serverReady,
    interview.hasStarted,
    isVideoRecording,
  ]);

  // Navigate when evaluation completes
  useEffect(() => {
    if (evaluationStatus === "complete" && evaluationResults) {
      setTimeout(() => navigate("/dashboard"), 2000);
    }
  }, [evaluationStatus, evaluationResults, navigate]);

  // End interview
  const handleEndInterview = async () => {
    if (!confirm("End the interview?")) return;
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

  // Loading state
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
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold
      ${active ? `bg-${color}-900/30 text-${color}-300` : "bg-gray-800 text-gray-500"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          active ? `bg-${color}-400 animate-pulse` : "bg-gray-600"
        }`}
      />
      {label}
    </div>
  );

  return (
    <section className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Main interview panel */}
          <div className="lg:col-span-2">
            <Card className="flex flex-col overflow-hidden shadow-xl border border-gray-700 bg-gray-800 min-h-150">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      interview.isPlaying
                        ? "bg-blue-600"
                        : interview.isListening
                          ? "bg-emerald-600"
                          : "bg-gray-700"
                    }`}
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

              {/* Face violation banner */}
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

              {/* Evaluation spinner */}
              {evaluationStatus === "started" && (
                <div className="px-5 py-3 bg-blue-900/20 border-b border-blue-800 flex items-center gap-3">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                  <p className="text-sm font-semibold text-blue-300">
                    Evaluating your responses…
                  </p>
                </div>
              )}

              {/* Question / answer area */}
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

              {/* User answer */}
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

              {/* Footer */}
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

          {/* Camera sidebar */}
          <div className="lg:col-span-1 space-y-3">
            {/* Primary camera */}
            <Card className="overflow-hidden border border-gray-700 bg-gray-800">
              <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">
                  Primary Camera
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    isVideoRecording
                      ? "text-red-300 bg-red-900/30"
                      : "text-gray-500 bg-gray-700"
                  }`}
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

            {/* Mobile camera — canvas painted from socket frames */}
            <Card className="overflow-hidden border border-gray-700 bg-gray-800">
              <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">
                  Mobile Camera
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    mobileCameraConnected
                      ? "text-orange-300 bg-orange-900/30"
                      : "text-gray-500 bg-gray-700"
                  }`}
                >
                  {mobileCameraConnected ? "● LIVE" : "WAITING"}
                </span>
              </div>
              <div className="relative aspect-video bg-black">
                <canvas
                  ref={secondaryCanvasRef}
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
                {!mobileCameraConnected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                    <div className="animate-spin w-8 h-8 border-2 border-orange-500/40 border-t-orange-500 rounded-full mb-2" />
                    <p className="text-white text-xs opacity-60">
                      Waiting for mobile…
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Screen */}
            <Card className="overflow-hidden border border-gray-700 bg-gray-800">
              <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">Screen</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    screenRecording.isRecording
                      ? "text-purple-300 bg-purple-900/30"
                      : "text-gray-500 bg-gray-700"
                  }`}
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
              </div>
            </Card>
          </div>
        </div>

        {/* Termination overlay */}
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
