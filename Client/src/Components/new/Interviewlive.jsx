import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "../../Hooks/useInterviewHook";
import useVideoRecording from "../../Hooks/useVideoRecordingHook";
import useHolisticDetection from "../../Hooks/useHolisticDetectionHook";
import useScreenRecording from "../../Hooks/useScreenRecording";
import { Button } from "../index";
import { Card } from "../Common/Card";
import { useStreams } from "../../Hooks/streamContext";

/**
 * InterviewLive — FIXED VERSION
 *
 * FIXES APPLIED:
 *
 * 1. SECONDARY CAMERA: Removed useSecondaryCamera hook entirely.
 *    Mobile frames arrive via "mobile_camera_frame" socket event and are
 *    drawn directly onto secondaryCanvasRef. No getUserMedia on desktop.
 *    The canvas stream is captured via captureStream() for recording.
 *
 * 2. TTS: autoStartInterview now receives the pre-acquired micStream so it
 *    never calls getUserMedia again. The hook's startMicStreaming accepts an
 *    optional existing stream parameter.
 *
 * 3. STT: "Socket not connected" was caused by video recording hooks calling
 *    socket.on("video_recording_ready") AFTER client_ready was emitted, racing
 *    with server responses. Fix: emit client_ready only after ALL handlers AND
 *    all recording registrations are done.
 *
 * 4. QUESTION GENERATION WAIT: Removed - setup can proceed independently.
 */
const InterviewLive = () => {
  const navigate = useNavigate();
  const streamsRef = useStreams();

  // ── Stable snapshot of setup-phase streams ───────────────────────────────
  const stableRef = useRef(null);
  if (!stableRef.current && streamsRef.current?.sessionData) {
    stableRef.current = {
      sessionData: streamsRef.current.sessionData,
      micStream: streamsRef.current.micStream,
      primaryCameraStream: streamsRef.current.primaryCameraStream,
      screenShareStream: streamsRef.current.screenShareStream,
      preInitializedSocket: streamsRef.current.preInitializedSocket,
    };
  }

  const sessionData = stableRef.current?.sessionData ?? null;
  const micStream = stableRef.current?.micStream ?? null;
  const primaryCameraStream = stableRef.current?.primaryCameraStream ?? null;
  const screenShareStream = stableRef.current?.screenShareStream ?? null;
  const preInitializedSocket = stableRef.current?.preInitializedSocket ?? null;

  // ── Hooks ─────────────────────────────────────────────────────────────────
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
  );

  const audioRecording = interview.audioRecording;

  const screenRecording = useScreenRecording(
    sessionData?.interviewId,
    sessionData?.userId,
    interview.socketRef,
  );

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const videoRef = useRef(null);
  const secondaryCanvasRef = useRef(null); // Mobile frames drawn here
  const screenVideoRef = useRef(null);
  const socketInitializedRef = useRef(false);
  const recordingsStartedRef = useRef(false);

  // ── Secondary camera recording (canvas → MediaRecorder) ──────────────────
  const secondaryMediaRecorderRef = useRef(null);
  const secondaryChunkCountRef = useRef(0);
  const secondarySessionReadyRef = useRef(false);
  const [isSecondaryRecording, setIsSecondaryRecording] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [evaluationStatus, setEvaluationStatus] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [faceViolationWarning, setFaceViolationWarning] = useState(null);
  const [isInterviewTerminated, setIsInterviewTerminated] = useState(false);
  const [mobileCameraConnected, setMobileCameraConnected] = useState(false);

  const { isInitialized: isHolisticReady } = useHolisticDetection(
    videoRef,
    interview.socketRef,
    interview.status === "live" && !interview.isInitializing,
  );

  // ── Validation ────────────────────────────────────────────────────────────
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

  // ── Cleanup helper ────────────────────────────────────────────────────────
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

    // Stop secondary canvas recorder
    if (
      secondaryMediaRecorderRef.current &&
      secondaryMediaRecorderRef.current.state !== "inactive"
    ) {
      jobs.push(
        new Promise((resolve) => {
          secondaryMediaRecorderRef.current.onstop = () => resolve();
          secondaryMediaRecorderRef.current.stop();
        }).catch(console.error),
      );
    }

    await Promise.allSettled(jobs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Attach primary camera to <video> ─────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current || !primaryCameraStream) return;
    videoRef.current.srcObject = primaryCameraStream;
    videoRef.current.muted = true;
    videoRef.current.play().catch((e) => {
      if (e.name !== "AbortError") console.error(e);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Attach screen stream to preview <video> ───────────────────────────────
  useEffect(() => {
    if (!screenVideoRef.current || !screenShareStream) return;
    screenVideoRef.current.srcObject = screenShareStream;
    screenVideoRef.current.muted = true;
    screenVideoRef.current
      .play()
      .then(() => console.log("✅ Screen video playing successfully"))
      .catch((e) => {
        if (e.name !== "AbortError") console.error(e);
      });

    const handleMetadata = () => {
      console.log("📺 Screen video metadata loaded, attempting play...");
      screenVideoRef.current?.play().catch(() => {});
    };
    screenVideoRef.current.addEventListener("loadedmetadata", handleMetadata);
    return () =>
      screenVideoRef.current?.removeEventListener(
        "loadedmetadata",
        handleMetadata,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Init canvas dimensions ────────────────────────────────────────────────
  useEffect(() => {
    if (secondaryCanvasRef.current) {
      secondaryCanvasRef.current.width = 640;
      secondaryCanvasRef.current.height = 480;
    }
  }, []);

  // ── Start secondary canvas recording ─────────────────────────────────────
  /**
   * FIX: Secondary camera video is captured from the canvas that receives
   * mobile frames, via captureStream(). This avoids any getUserMedia call
   * on the desktop and works regardless of mobile connection timing.
   */
  const startSecondaryCanvasRecording = useCallback(async (socket) => {
    if (!secondaryCanvasRef.current) return;
    if (secondaryMediaRecorderRef.current) return; // already started

    const canvas = secondaryCanvasRef.current;

    // captureStream at 10fps matches the mobile frame rate
    const canvasStream = canvas.captureStream(10);

    const mimeTypesToTry = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "",
    ];

    let mediaRecorder;
    for (const mimeType of mimeTypesToTry) {
      try {
        const options = {};
        if (mimeType) options.mimeType = mimeType;
        mediaRecorder = new MediaRecorder(canvasStream, options);
        console.log(`✅ Secondary canvas recorder: ${mimeType || "default"}`);
        break;
      } catch (_) {
        continue;
      }
    }

    if (!mediaRecorder) {
      console.error("❌ Cannot create MediaRecorder for secondary canvas");
      return;
    }

    secondaryMediaRecorderRef.current = mediaRecorder;
    secondaryChunkCountRef.current = 0;

    mediaRecorder.ondataavailable = (event) => {
      if (!event.data || event.data.size === 0) return;

      secondaryChunkCountRef.current++;
      const currentChunk = secondaryChunkCountRef.current;

      const reader = new FileReader();
      reader.onloadend = () => {
        if (socket?.connected && secondarySessionReadyRef.current) {
          const base64Data = reader.result.split(",")[1];
          socket.emit("video_chunk", {
            videoType: "secondary_camera",
            chunkNumber: currentChunk,
            chunkData: base64Data,
            isLastChunk: false,
            timestamp: Date.now(),
          });
        }
      };
      reader.readAsDataURL(event.data);
    };

    mediaRecorder.onstart = () => {
      console.log("✅ Secondary canvas recording started");
      setIsSecondaryRecording(true);
    };

    mediaRecorder.onstop = () => {
      console.log(
        `🛑 Secondary canvas recording stopped. Chunks: ${secondaryChunkCountRef.current}`,
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

    // Request server session
    if (socket?.connected) {
      socket.emit("video_recording_start", {
        videoType: "secondary_camera",
        totalChunks: 0,
        metadata: { mimeType: "video/webm;codecs=vp9" },
      });

      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(
            "⚠️ Secondary camera server confirm timeout, starting anyway",
          );
          secondarySessionReadyRef.current = true;
          resolve();
        }, 5000);

        const handler = (data) => {
          if (data.videoType === "secondary_camera") {
            clearTimeout(timeout);
            socket.off("video_recording_ready", handler);
            secondarySessionReadyRef.current = true;
            console.log("✅ Secondary camera session confirmed");
            resolve();
          }
        };

        socket.on("video_recording_ready", handler);
      });
    } else {
      secondarySessionReadyRef.current = true;
    }

    mediaRecorder.start(20000); // 20s chunks
  }, []);

  // ── Socket init — runs ONCE ───────────────────────────────────────────────
  useEffect(() => {
    if (socketInitializedRef.current || !sessionData || !preInitializedSocket)
      return;
    socketInitializedRef.current = true;

    const socket = preInitializedSocket;
    interview.socketRef.current = socket;

    const init = async () => {
      try {
        // Wait for socket to be connected
        let retries = 0;
        while (!socket.connected && retries < 15) {
          await new Promise((r) => setTimeout(r, 300));
          retries++;
        }
        if (!socket.connected) {
          alert("Connection failed. Please try again.");
          navigate("/interview");
          return;
        }

        const silenced = new Set([
          "user_audio_chunk",
          "video_chunk",
          "audio_chunk",
          "holistic_detection_result",
          "interim_transcript",
        ]);
        socket.onAny((ev) => {
          if (!silenced.has(ev)) console.log(`📡 Socket: "${ev}"`);
        });

        // ── Register ALL socket.on() handlers FIRST ───────────────────────
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
        socket.on("listening_enabled", () => interview.enableListening());
        socket.on("listening_disabled", () => interview.disableListening());
        socket.on("interview_complete", async (d) => {
          interview.handleInterviewComplete(d);
          await cleanupAllRecordings();
        });

        // ── FIX: Secondary camera frames drawn directly to canvas ─────────
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

        socket.on("interview_terminated", async (d) => {
          setIsInterviewTerminated(true);
          interview.setMicStreamingActive(false);
          await cleanupAllRecordings();
          socket.disconnect();
          navigate("/dashboard");
        });

        socket.on("audio_recording_error", (d) =>
          console.error("❌ Audio error:", d),
        );
        socket.on("video_recording_error", (d) =>
          console.error("❌ Video error:", d),
        );
        socket.on("media_merge_complete", (d) =>
          console.log("✅ Merge:", d.finalVideoUrl),
        );

        socket.on("evaluation_started", () => setEvaluationStatus("started"));
        socket.on("evaluation_complete", (d) => {
          setEvaluationStatus("complete");
          setEvaluationResults(d.results);
          interview.setMicStreamingActive(false);
        });
        socket.on("evaluation_error", (d) => {
          setEvaluationStatus("error");
          console.error("❌ Evaluation error:", d.message);
        });

        socket.on("disconnect", (reason) => {
          if (reason === "io server disconnect") {
            alert("Server disconnected.");
            navigate("/interview");
          }
        });
        socket.on("reconnect", () => console.log("✅ Reconnected"));
        socket.on("reconnect_failed", () => {
          alert("Reconnection failed.");
          navigate("/interview");
        });
        socket.on("connect_error", (e) =>
          console.error("❌ Connect error:", e.message),
        );
        socket.on("error", () => interview.setStatus("error"));

        // ── State setup ───────────────────────────────────────────────────
        interview.setStatus("live");
        interview.setServerReady(true);
        interview.setIsInitializing(false);
        interview.initializeInterview({
          interviewId: sessionData.interviewId,
          userId: sessionData.userId,
        });

        console.log("🚀 Emitting 'client_ready' - Interview starting...");
        socket.emit("client_ready", {
          interviewId: sessionData.interviewId,
          userId: sessionData.userId,
          timestamp: Date.now(),
        });

        console.log("🎬 Initializing interview session");

        // ── FIX: Pass existing micStream to avoid second getUserMedia ─────
        await interview.autoStartInterview(micStream);
      } catch (err) {
        console.error("❌ Socket init failed:", err);
        navigate("/interview");
      }
    };

    init();

    return () => {
      (async () => {
        await cleanupAllRecordings();
        socket.offAny();
        socket.removeAllListeners();
        socket.disconnect();
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // runs once

  // ── Start all recordings once interview is live ───────────────────────────
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
        console.log("🎬 Starting media streaming");

        await audioRecording.startRecording();
        await startVideoRecording();

        if (screenShareStream) {
          await screenRecording.startRecording(screenShareStream);
        }

        // ── FIX: Always start canvas recording — works even before mobile connects
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

  // ── Navigate on evaluation complete ──────────────────────────────────────
  useEffect(() => {
    if (evaluationStatus === "complete" && evaluationResults) {
      setTimeout(() => navigate("/dashboard"), 2000);
    }
  }, [evaluationStatus, evaluationResults, navigate]);

  const handleEndInterview = async () => {
    if (!confirm("End the interview?")) return;
    await cleanupAllRecordings();
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
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold
      ${active ? `bg-${color}-900/30 text-${color}-300` : "bg-gray-800 text-gray-500"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${active ? `bg-${color}-400 animate-pulse` : "bg-gray-600"}`}
      />
      {label}
    </div>
  );

  return (
    <section className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* ── Main panel ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <Card className="flex flex-col overflow-hidden shadow-xl border border-gray-700 bg-gray-800 min-h-[600px]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center
                    ${interview.isPlaying ? "bg-blue-600" : interview.isListening ? "bg-emerald-600" : "bg-gray-700"}`}
                  >
                    {interview.isPlaying ? (
                      <span className="text-white text-sm font-bold">AI</span>
                    ) : (
                      <span className="text-white text-sm font-bold">🎤</span>
                    )}
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

              {/* Face violation */}
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

              {/* Question area */}
              <div className="flex-1 p-6 flex flex-col justify-center space-y-6">
                {interview.currentQuestion && (
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
                )}
              </div>

              {/* Answer */}
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

          {/* ── Camera sidebar ───────────────────────────────────────────── */}
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

            {/* Mobile camera — canvas receives frames directly from socket */}
            <Card className="overflow-hidden border border-gray-700 bg-gray-800">
              <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">
                  Mobile Camera
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded
                  ${mobileCameraConnected ? "text-orange-300 bg-orange-900/30" : "text-gray-500 bg-gray-700"}`}
                >
                  {mobileCameraConnected ? "● LIVE" : "WAITING"}
                </span>
              </div>
              <div className="relative aspect-video bg-black">
                {/* Canvas always mounted — frames painted when mobile connects */}
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

            {/* Screen recording */}
            <Card className="overflow-hidden border border-gray-700 bg-gray-800">
              <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">Screen</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded
                  ${screenRecording.isRecording ? "text-purple-300 bg-purple-900/30" : "text-gray-500 bg-gray-700"}`}
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
