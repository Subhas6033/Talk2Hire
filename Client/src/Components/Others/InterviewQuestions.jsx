import { useEffect, useCallback, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Button } from "../index";
import { Card } from "../Common/Card";
import { useInterview } from "../../Hooks/useInterviewHook";
import useVideoRecording from "../../Hooks/useVideoRecordingHook";
import useHolisticDetection from "../../Hooks/useHolisticDetectionHook";
import useAudioRecording from "../../Hooks/useAudioRecording";
import useScreenRecording from "../../Hooks/useScreenRecording";
import useSecondaryCamera from "../../Hooks/useSecondaryCameraHook";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

const InterviewQuestions = ({
  interviewId,
  userId,
  cameraStream,
  secondaryCameraStream, // null — mobile device streams independently via socket
  onCancel,
  onFinish,
}) => {
  const interview = useInterview(interviewId, userId, cameraStream);

  const {
    isRecording: isVideoRecording,
    startRecording: startVideoRecording,
    stopRecording: stopVideoRecording,
  } = useVideoRecording(interviewId, userId, cameraStream, interview.socketRef);

  const audioRecording = useAudioRecording(
    interview.socketRef,
    interviewId,
    userId,
  );

  const screenRecording = useScreenRecording(
    interviewId,
    userId,
    interview.socketRef,
  );

  // Secondary camera — streams independently from the mobile device via socket
  const secondaryCamera = useSecondaryCamera(
    interviewId,
    userId,
    interview.socketRef,
  );

  const videoRef = useRef(null);
  const secondaryVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const isCleaningUpRef = useRef(false);

  const {
    isInitialized: isHolisticDetectionReady,
    hasFace,
    hasPose,
    hasLeftHand,
    hasRightHand,
  } = useHolisticDetection(
    videoRef,
    interview.socketRef,
    interview.status === "live" && !interview.isInitializing,
  );

  const [waitingForQuestions, setWaitingForQuestions] = useState(false);
  const [evaluationStatus, setEvaluationStatus] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [faceViolationWarning, setFaceViolationWarning] = useState(null);
  const [isInterviewTerminated, setIsInterviewTerminated] = useState(false);
  // Track whether secondary camera (mobile) has connected
  const [mobileCameraConnected, setMobileCameraConnected] = useState(false);

  const readyForQuestionSentRef = useRef(false);

  // ── Memoized cleanup ──────────────────────────────────────────────────────
  const cleanupAllRecordings = useCallback(async () => {
    console.log("🧹 Cleaning up all recordings...");

    const cleanupPromises = [];

    if (isVideoRecording) {
      cleanupPromises.push(
        stopVideoRecording().catch((err) =>
          console.error("❌ Error stopping video:", err),
        ),
      );
    }

    if (audioRecording.isRecording) {
      try {
        audioRecording.stopRecording();
      } catch (err) {
        console.error("❌ Error stopping audio:", err);
      }
    }

    if (screenRecording.isRecording) {
      cleanupPromises.push(
        screenRecording
          .stopRecording()
          .catch((err) => console.error("❌ Error stopping screen:", err)),
      );
    }

    if (secondaryCamera.isRecording) {
      cleanupPromises.push(
        secondaryCamera
          .stopRecording()
          .catch((err) =>
            console.error("❌ Error stopping secondary cam:", err),
          ),
      );
    }

    await Promise.allSettled(cleanupPromises);
    console.log("✅ All recordings cleaned up");
  }, [
    isVideoRecording,
    audioRecording,
    screenRecording,
    secondaryCamera,
    stopVideoRecording,
  ]);

  // ── Secondary camera preview (from mobile stream if available locally) ───
  useEffect(() => {
    if (!secondaryVideoRef.current) return;

    // If mobile stream is somehow passed locally (future: WebRTC), set it up
    if (secondaryCameraStream) {
      const videoTrack = secondaryCameraStream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== "live") return;

      if (secondaryVideoRef.current.srcObject !== secondaryCameraStream) {
        secondaryVideoRef.current.srcObject = secondaryCameraStream;
        secondaryVideoRef.current.muted = true;
        secondaryVideoRef.current.playsInline = true;
        secondaryVideoRef.current.onloadedmetadata = () => {
          secondaryVideoRef.current?.play().catch(console.error);
        };
      }
    }

    // Also set from hook's stream if hook captures it
    if (secondaryCamera.secondaryCameraStream && !secondaryCameraStream) {
      if (
        secondaryVideoRef.current.srcObject !==
        secondaryCamera.secondaryCameraStream
      ) {
        secondaryVideoRef.current.srcObject =
          secondaryCamera.secondaryCameraStream;
        secondaryVideoRef.current.muted = true;
        secondaryVideoRef.current.playsInline = true;
        secondaryVideoRef.current.onloadedmetadata = () => {
          secondaryVideoRef.current?.play().catch(console.error);
        };
      }
    }

    return () => {
      if (secondaryVideoRef.current) {
        secondaryVideoRef.current.srcObject = null;
      }
    };
  }, [secondaryCameraStream, secondaryCamera.secondaryCameraStream]);

  // ── Screen recording preview ──────────────────────────────────────────────
  useEffect(() => {
    if (!screenVideoRef.current || !screenRecording.screenStream) return;

    const screenTrack = screenRecording.screenStream.getVideoTracks()[0];
    if (!screenTrack || screenTrack.readyState !== "live") return;

    if (screenVideoRef.current.srcObject !== screenRecording.screenStream) {
      screenVideoRef.current.srcObject = screenRecording.screenStream;
      screenVideoRef.current.muted = true;
      screenVideoRef.current.playsInline = true;
      screenVideoRef.current.onloadedmetadata = () => {
        screenVideoRef.current?.play().catch(console.error);
      };
    }

    return () => {
      if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    };
  }, [screenRecording.screenStream]);

  // ── Primary camera preview ────────────────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current || !cameraStream) return;

    const videoTrack = cameraStream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== "live") return;

    if (videoRef.current.srcObject !== cameraStream) {
      videoRef.current.srcObject = null;
      videoRef.current.srcObject = cameraStream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch((err) => {
          if (err.name === "NotAllowedError")
            alert("Click anywhere to start video preview");
        });
      };
    }
  }, [cameraStream]);

  // ── Main socket initialization ────────────────────────────────────────────
  useEffect(() => {
    console.log("🔌 Creating socket instance...");

    const socket = io(SOCKET_URL, {
      query: { interviewId, userId },
      transports: ["websocket", "polling"],
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      autoConnect: false,
    });

    interview.socketRef.current = socket;

    socket.onAny((eventName, ...args) => {
      const silenced = [
        "user_audio_chunk",
        "security_frame",
        "video_chunk",
        "audio_chunk",
        "screen_chunk",
        "holistic_detection_result",
        "interim_transcript",
      ];
      if (!silenced.includes(eventName)) {
        console.log(
          `📡 Socket event: "${eventName}"`,
          args.length > 0 ? args : "",
        );
      }
    });

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      interview.setStatus("live");
    });

    socket.on("server_ready", () => {
      console.log("✅ Server ready!");
      interview.setServerReady(true);
      interview.setIsInitializing(false);

      setTimeout(() => {
        if (!readyForQuestionSentRef.current) {
          console.log("📤 Sending ready_for_question...");
          socket.emit("ready_for_question");
          readyForQuestionSentRef.current = true;
        }
      }, 200);
    });

    // Track mobile camera connection status in the interview phase too
    socket.on("secondary_camera_ready", (data) => {
      console.log(
        "📱 Secondary camera confirmed connected in interview:",
        data,
      );
      setMobileCameraConnected(true);
    });

    socket.on("interim_transcript", (data) =>
      interview.setLiveTranscript(data.text),
    );

    socket.on("face_violation", (data) => {
      console.warn("⚠️ Face violation:", data);
      setFaceViolationWarning(data);
    });

    socket.on("face_violation_cleared", () => setFaceViolationWarning(null));
    socket.on("face_status_ok", () =>
      setFaceViolationWarning((prev) => (prev !== null ? null : prev)),
    );

    socket.on("interview_terminated", async (data) => {
      console.error("❌ Interview terminated:", data);
      setIsInterviewTerminated(true);
      alert(`Interview Terminated: ${data.message}`);
      await cleanupAllRecordings();
      if (onFinish) onFinish();
      else if (onCancel) onCancel();
    });

    socket.on("audio_recording_ready", (data) =>
      console.log("✅ Audio session ready:", data),
    );
    socket.on("audio_chunk_uploaded", (data) => {
      if (data.chunkNumber % 10 === 0)
        console.log(`✅ Audio chunk ${data.chunkNumber} (${data.progress}%)`);
    });
    socket.on("audio_chunk_error", (data) =>
      console.error("❌ Audio chunk error:", data),
    );
    socket.on("audio_processing_complete", (data) =>
      console.log("✅ Audio processing complete:", data),
    );
    socket.on("audio_processing_error", (data) =>
      console.error("❌ Audio processing error:", data),
    );

    socket.on("video_recording_ready", (data) =>
      console.log("✅ Video session ready:", data),
    );
    socket.on("video_chunk_uploaded", (data) => {
      if (data.chunkNumber % 10 === 0)
        console.log(
          `✅ ${data.videoType} chunk ${data.chunkNumber} (${data.progress}%)`,
        );
    });
    socket.on("video_chunk_error", (data) =>
      console.error(`❌ ${data.videoType} chunk error:`, data.error),
    );
    socket.on("video_processing_complete", (data) =>
      console.log(`✅ Video processing complete for ${data.videoType}:`, data),
    );
    socket.on("video_processing_error", (data) => {
      console.error(`❌ Video processing error for ${data.videoType}:`, data);
      alert(`Video processing failed for ${data.videoType}: ${data.error}`);
    });

    socket.on("evaluation_started", (data) => {
      console.log("🔄 Evaluation started:", data.message);
      setEvaluationStatus("started");
    });
    socket.on("evaluation_complete", (data) => {
      console.log("✅ Evaluation complete:", data.results);
      setEvaluationStatus("complete");
      setEvaluationResults(data.results);
    });
    socket.on("evaluation_error", (data) => {
      console.error("❌ Evaluation error:", data.message);
      setEvaluationStatus("error");
      alert(`Evaluation failed: ${data.message}`);
    });

    socket.on("question", (data) => {
      console.log("📨 Question received:", data);
      setWaitingForQuestions(false);
      interview.handleQuestion(data);
    });
    socket.on("next_question", (data) => interview.handleNextQuestion(data));
    socket.on("idle_prompt", (data) => interview.handleIdlePrompt(data));
    socket.on("transcript_received", (data) =>
      interview.handleTranscriptReceived(data),
    );
    socket.on("final_answer", (data) => interview.handleFinalAnswer(data.text));
    socket.on("listening_enabled", () => interview.enableListening());
    socket.on("listening_disabled", () => interview.disableListening());
    socket.on("tts_audio", (chunk) => {
      if (chunk) interview.handleTtsAudio(chunk);
    });
    socket.on("tts_end", () => interview.handleTtsEnd());

    socket.on("interview_complete", async (data) => {
      console.log("🎉 Interview complete:", data);
      interview.handleInterviewComplete(data);
      await cleanupAllRecordings();
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connect error:", err.message);
      interview.setStatus("error");
      interview.setIsInitializing(false);
    });
    socket.on("disconnect", (reason) => {
      console.log("⚠️ Socket disconnected:", reason);
      interview.setStatus("disconnected");
      interview.setMicStreamingActive(false);
    });
    socket.on("error", (error) => {
      console.error("❌ Socket error:", error);
      if (
        error.message &&
        !error.message.includes("Speech recognition") &&
        !error.message.includes("recognition error")
      ) {
        alert(
          `Interview error: ${error.message}. Please refresh and try again.`,
        );
      }
      interview.setStatus("error");
    });

    interview.initializeInterview({
      interviewId,
      userId,
      sessionId: interviewId,
    });

    console.log("🔌 Connecting socket...");
    socket.connect();

    return () => {
      console.log("🧹 Cleaning up socket...");
      isCleaningUpRef.current = true;

      (async () => {
        await cleanupAllRecordings();
        if (interview.micStreamRef.current) {
          interview.micStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        socket.disconnect();
        console.log("🔌 Cleanup complete");
      })();
    };
  }, [interviewId, userId]);

  // ── Start ALL recordings when interview is fully live ─────────────────────
  // Secondary camera recording is started by the mobile device itself via
  // useSecondaryCamera. Here we start primary video, audio, and screen.
  useEffect(() => {
    const shouldStart =
      interview.status === "live" &&
      !interview.isInitializing &&
      interview.serverReady &&
      interview.hasStarted &&
      cameraStream &&
      !isVideoRecording;

    if (!shouldStart) return;

    const startAll = async () => {
      try {
        console.log("🎬 Starting all desktop recordings...");

        // 1. Audio
        await interview.audioRecording.startRecording();
        console.log("✅ Audio recording started");

        // 2. Primary camera
        await startVideoRecording();
        console.log("✅ Primary camera recording started");

        // 3. Screen
        await screenRecording.startRecording();
        console.log("✅ Screen recording started");

        console.log("✅ All desktop recordings active");
        console.log(
          "📱 Secondary camera recording is managed by mobile device",
        );
      } catch (error) {
        console.error("❌ Failed to start recordings:", error);
      }
    };

    startAll();
  }, [
    interview.status,
    interview.isInitializing,
    interview.serverReady,
    interview.hasStarted,
    cameraStream,
    isVideoRecording,
  ]);

  // ── Auto-finish on evaluation complete ───────────────────────────────────
  useEffect(() => {
    if (evaluationStatus === "complete" && evaluationResults) {
      const message = `Interview completed! You answered ${interview.questionOrder} questions.\n\nOverall Score: ${evaluationResults.overallScore}%\nDecision: ${evaluationResults.hireDecision}\nExperience Level: ${evaluationResults.experienceLevel}`;
      alert(message);
      if (onFinish) onFinish();
    }
  }, [evaluationStatus, evaluationResults, interview.questionOrder, onFinish]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const RecordingDot = ({ active, color = "red" }) => (
    <div
      className={`w-2 h-2 rounded-full ${active ? `bg-${color}-500 animate-pulse` : "bg-gray-500"}`}
    />
  );

  const StatusBadge = ({ label, active, color }) => (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        active
          ? `bg-${color}-100 dark:bg-${color}-900/30 text-${color}-700 dark:text-${color}-300 shadow-sm`
          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
      }`}
    >
      <RecordingDot active={active} color={color} />
      {label}
    </div>
  );

  return (
    <section className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* ── Left Column: Interview Card ─────────────────────────────── */}
          <div className="lg:col-span-2">
            <Card className="flex flex-col overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-lg ${
                      interview.isPlaying
                        ? "bg-linear-to-br from-blue-500 to-blue-600 shadow-blue-500/50"
                        : interview.isListening
                          ? "bg-linear-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/50"
                          : "bg-linear-to-br from-gray-600 to-gray-700"
                    }`}
                  >
                    {interview.isPlaying ? (
                      <svg
                        className="w-6 h-6 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" />
                      </svg>
                    ) : interview.isListening ? (
                      <svg
                        className="w-6 h-6 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                      AI Interview Assistant
                    </h2>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                      {interview.isPlaying
                        ? "Speaking..."
                        : interview.isListening
                          ? "Listening..."
                          : "Ready"}
                    </p>
                  </div>
                </div>

                {/* Recording status badges */}
                <div className="flex items-center gap-2 flex-wrap">
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
                    label="Primary Cam"
                    active={isVideoRecording}
                    color="red"
                  />
                  <StatusBadge
                    label="Mobile Cam"
                    active={
                      secondaryCamera.isRecording || mobileCameraConnected
                    }
                    color="orange"
                  />
                  <StatusBadge
                    label="Screen"
                    active={screenRecording.isRecording}
                    color="purple"
                  />
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isHolisticDetectionReady && hasFace
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 shadow-sm"
                        : !hasFace
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 shadow-sm"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isHolisticDetectionReady && hasFace
                          ? "bg-green-600"
                          : !hasFace
                            ? "bg-red-600 animate-pulse"
                            : "bg-gray-400"
                      }`}
                    />
                    Detection:{" "}
                    {isHolisticDetectionReady ? (hasFace ? "✓" : "✗") : "..."}
                  </div>
                </div>
              </div>

              {/* Face Violation Warning */}
              {faceViolationWarning && !isInterviewTerminated && (
                <div className="px-6 py-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-6 h-6 text-red-600 dark:text-red-400 animate-pulse"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-red-900 dark:text-red-300">
                        {faceViolationWarning.type === "NO_FACE"
                          ? "⚠️ No Face Detected"
                          : "⚠️ Multiple Faces Detected"}
                      </p>
                      <p className="text-xs text-red-800 dark:text-red-200 mt-1">
                        {faceViolationWarning.message} (
                        {faceViolationWarning.count}/{faceViolationWarning.max})
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Main Content */}
              <div className="flex-1 p-6 bg-white dark:bg-gray-800 min-h-96">
                {evaluationStatus === "started" && (
                  <div className="mb-4 p-4 bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
                      <div>
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-300">
                          Evaluating Your Interview
                        </p>
                        <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                          Please wait while we analyze your responses...
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {interview.status === "live" && interview.currentQuestion && (
                  <div className="flex flex-col justify-center space-y-6 h-full">
                    {interview.idlePrompt && (
                      <div className="p-4 bg-linear-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                          <svg
                            className="w-5 h-5 text-amber-600 dark:text-amber-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-sm font-bold text-amber-900 dark:text-amber-300">
                            Waiting for Response
                          </span>
                        </div>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          {interview.idlePrompt}
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shrink-0">
                          <span className="text-sm font-bold text-white">
                            Q
                          </span>
                        </div>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                          Question {interview.questionOrder}
                        </span>
                      </div>
                      <p className="text-xl md:text-2xl text-gray-900 dark:text-gray-100 leading-relaxed font-medium">
                        {interview.currentQuestion}
                      </p>
                    </div>

                    {interview.isListening && (
                      <div className="flex items-center gap-2 justify-center pt-4">
                        <div className="flex gap-1">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className="w-2 h-2 bg-emerald-600 dark:bg-emerald-500 rounded-full animate-bounce"
                              style={{ animationDelay: `${i * 0.1}s` }}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          Listening to your response...
                        </span>
                      </div>
                    )}

                    {interview.liveTranscript && (
                      <div className="p-4 bg-linear-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-xl border border-gray-200 dark:border-gray-600">
                        <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">
                          {interview.liveTranscript}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {!interview.currentQuestion &&
                  interview.status === "live" &&
                  !interview.isInitializing && (
                    <div className="flex flex-col items-center justify-center h-full">
                      <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-purple-600 rounded-full animate-spin mb-4" />
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        Loading question...
                      </p>
                    </div>
                  )}
              </div>

              {!interview.isInitializing && interview.userText && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-linear-to-r from-emerald-50 to-teal-50 dark:from-gray-800 dark:to-gray-700">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
                        <span className="text-sm font-bold text-white">A</span>
                      </div>
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        Your Answer
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pl-11">
                      {interview.userText}
                    </p>
                  </div>
                </div>
              )}

              {!interview.isInitializing && (
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-medium">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />
                      Interview active • {interview.recordingDuration}
                    </div>
                    <Button
                      variant="secondary"
                      onClick={onCancel}
                      className="text-sm px-5 py-2 font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-all shadow-sm"
                    >
                      End Interview
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* ── Right Column: Three Video Feeds ────────────────────────── */}
          <div className="lg:col-span-1 space-y-4">
            {/* 1. Primary Camera */}
            {cameraStream && (
              <Card className="overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-indigo-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        Primary Camera
                      </h3>
                    </div>
                    {isHolisticDetectionReady && (
                      <div className="flex gap-1">
                        {[
                          { label: "F", active: hasFace },
                          { label: "P", active: hasPose },
                          { label: "L", active: hasLeftHand },
                          { label: "R", active: hasRightHand },
                        ].map(({ label, active }) => (
                          <span
                            key={label}
                            className={`text-xs px-1.5 py-0.5 rounded ${active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-3 bg-white dark:bg-gray-800">
                  <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />
                    <div className="absolute top-3 left-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg shadow-xl">
                        <div
                          className={`w-2 h-2 rounded-full ${isVideoRecording ? "bg-red-500 animate-pulse shadow-lg shadow-red-500/50" : "bg-gray-500"}`}
                        />
                        <span className="text-xs font-bold text-white">
                          {isVideoRecording ? "REC" : "STANDBY"}
                        </span>
                        <span className="text-xs font-mono text-white/80">
                          {interview.recordingDuration}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* 2. Secondary Camera (Mobile) */}
            <Card className="overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-orange-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      Mobile Camera
                    </h3>
                  </div>
                  <span
                    className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${
                      secondaryCamera.isRecording || mobileCameraConnected
                        ? "text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30"
                        : "text-gray-500 bg-gray-100 dark:bg-gray-700"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        secondaryCamera.isRecording || mobileCameraConnected
                          ? "bg-orange-600 animate-pulse"
                          : "bg-gray-400"
                      }`}
                    />
                    {secondaryCamera.isRecording
                      ? "LIVE"
                      : mobileCameraConnected
                        ? "CONNECTED"
                        : "WAITING"}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800">
                <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg">
                  {/* Show preview only if we have a stream (e.g. via WebRTC in future) */}
                  {secondaryCameraStream ||
                  secondaryCamera.secondaryCameraStream ? (
                    <video
                      ref={secondaryVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />
                  ) : (
                    /* Placeholder when mobile is recording independently */
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-linear-to-br from-orange-950/60 to-gray-900 gap-3">
                      {mobileCameraConnected || secondaryCamera.isRecording ? (
                        <>
                          <div className="w-14 h-14 rounded-full bg-orange-500/20 border-2 border-orange-500 flex items-center justify-center">
                            <svg
                              className="w-7 h-7 text-orange-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                          <p className="text-xs text-orange-300 font-semibold text-center px-4">
                            📱 Recording on mobile device
                          </p>
                          <p className="text-xs text-gray-500 text-center px-4">
                            Preview not available — stream is on your phone
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="animate-spin w-10 h-10 border-2 border-gray-600 border-t-orange-500 rounded-full" />
                          <p className="text-xs text-gray-500 font-semibold">
                            Waiting for mobile...
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  <div className="absolute top-3 left-3 z-10">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg shadow-xl">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          secondaryCamera.isRecording
                            ? "bg-orange-500 animate-pulse shadow-lg shadow-orange-500/50"
                            : mobileCameraConnected
                              ? "bg-yellow-400 animate-pulse"
                              : "bg-gray-500"
                        }`}
                      />
                      <span className="text-xs font-bold text-white">
                        {secondaryCamera.isRecording
                          ? "REC"
                          : mobileCameraConnected
                            ? "STANDBY"
                            : "OFFLINE"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* 3. Screen Recording */}
            <Card className="overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-purple-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      Screen Recording
                    </h3>
                  </div>
                  {screenRecording.isRecording && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                      LIVE
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800">
                <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg">
                  {screenRecording.screenStream ? (
                    <video
                      ref={screenVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-linear-to-br from-purple-950 to-gray-900 gap-3">
                      <svg
                        className="w-10 h-10 text-gray-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      <p className="text-xs text-gray-500 font-semibold">
                        {screenRecording.isRecording
                          ? "Starting preview..."
                          : "Waiting to start..."}
                      </p>
                    </div>
                  )}

                  <div className="absolute top-3 left-3 z-10">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg shadow-xl">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          screenRecording.isRecording
                            ? "bg-purple-500 animate-pulse shadow-lg shadow-purple-500/50"
                            : "bg-gray-500"
                        }`}
                      />
                      <span className="text-xs font-bold text-white">
                        {screenRecording.isRecording ? "REC" : "STANDBY"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Interview Terminated Modal */}
        {isInterviewTerminated && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl">
              <div className="w-20 h-20 rounded-full bg-linear-to-br from-red-500 to-red-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-red-500/50">
                <svg
                  className="w-10 h-10 text-white"
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
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                Interview Terminated
              </h3>
              <p className="text-base text-gray-600 dark:text-gray-400">
                Your interview has been terminated due to a policy violation.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default InterviewQuestions;
