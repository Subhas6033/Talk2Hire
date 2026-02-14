import { useEffect, useCallback, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Button } from "../index";
import { Card } from "../Common/Card";
import { useInterview } from "../../Hooks/useInterviewHook";
import useVideoRecording from "../../Hooks/useVideoRecordingHook";
import useHolisticDetection from "../../Hooks/useHolisticDetectionHook";
import useScreenRecording from "../../Hooks/useScreenRecording";
import useSecondaryCamera from "../../Hooks/useSecondaryCameraHook";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

function attachStream(videoEl, stream) {
  if (!videoEl || !stream) {
    console.warn("attachStream called with missing parameters:", {
      videoEl: !!videoEl,
      stream: !!stream,
    });
    return;
  }

  if (videoEl.srcObject === stream) {
    console.log("Stream already attached to this element");
    return;
  }

  console.log("Attaching stream to video element:", {
    streamId: stream.id,
    active: stream.active,
    tracks: stream.getTracks().length,
  });

  videoEl.srcObject = stream;
  videoEl.muted = true;
  videoEl.playsInline = true;

  videoEl.onloadedmetadata = () => {
    console.log("Video metadata loaded, attempting play");
    videoEl.play().catch((err) => {
      if (err.name !== "AbortError") {
        console.error("Video play error:", err);
      }
    });
  };
}

const InterviewQuestions = ({
  interviewId,
  userId,
  cameraStream,
  secondaryCameraStream,
  onCancel,
  onFinish,
}) => {
  const interview = useInterview(interviewId, userId, cameraStream);

  const {
    isRecording: isVideoRecording,
    startRecording: startVideoRecording,
    stopRecording: stopVideoRecording,
  } = useVideoRecording(interviewId, userId, cameraStream, interview.socketRef);

  const audioRecording = interview.audioRecording;

  const screenRecording = useScreenRecording(
    interviewId,
    userId,
    interview.socketRef,
  );
  const secondaryCamera = useSecondaryCamera(
    interviewId,
    userId,
    interview.socketRef,
  );

  const videoRef = useRef(null);
  const secondaryVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const secondaryCanvasRef = useRef(null);
  const isCleaningUpRef = useRef(false);
  const readyForQuestionSentRef = useRef(false);
  const hasReceivedFrameRef = useRef(false);

  // REMOVED: mobileImageRef, mobileFrameQueueRef, mobileFrameProcessingRef
  // No longer needed with simplified frame handling

  const [screenShareAttempts, setScreenShareAttempts] = useState(0);

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

  const [evaluationStatus, setEvaluationStatus] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [faceViolationWarning, setFaceViolationWarning] = useState(null);
  const [isInterviewTerminated, setIsInterviewTerminated] = useState(false);
  const [mobileCameraConnected, setMobileCameraConnected] = useState(false);
  const [showScreenSharePrompt, setShowScreenSharePrompt] = useState(false);

  const cleanupAllRecordings = useCallback(async () => {
    console.log("Cleaning up all recordings");
    const promises = [];

    if (isVideoRecording) {
      promises.push(
        stopVideoRecording().catch((e) => console.error("stop video:", e)),
      );
    }
    if (audioRecording?.isRecording) {
      try {
        audioRecording.stopRecording();
      } catch (e) {
        console.error("stop audio:", e);
      }
    }
    if (screenRecording.isRecording) {
      promises.push(
        screenRecording
          .stopRecording()
          .catch((e) => console.error("stop screen:", e)),
      );
    }
    if (secondaryCamera.isRecording) {
      promises.push(
        secondaryCamera
          .stopRecording()
          .catch((e) => console.error("stop secondary:", e)),
      );
    }

    await Promise.allSettled(promises);
    console.log("All recordings cleaned up");
  }, [
    isVideoRecording,
    audioRecording,
    screenRecording,
    secondaryCamera,
    stopVideoRecording,
  ]);

  // Attach primary camera stream
  useEffect(() => {
    console.log("Primary camera effect triggered:", {
      hasVideoRef: !!videoRef.current,
      hasStream: !!cameraStream,
      streamActive: cameraStream?.active,
    });
    if (videoRef.current && cameraStream) {
      console.log("Attaching primary camera stream");
      attachStream(videoRef.current, cameraStream);
    }
  }, [cameraStream]);

  // Attach screen recording stream
  useEffect(() => {
    console.log("Screen recording effect triggered:", {
      hasVideoRef: !!screenVideoRef.current,
      hasStream: !!screenRecording.screenStream,
      streamActive: screenRecording.screenStream?.active,
    });
    if (screenVideoRef.current && screenRecording.screenStream) {
      console.log("Attaching screen recording stream");
      attachStream(screenVideoRef.current, screenRecording.screenStream);
    }
  }, [screenRecording.screenStream]);

  // SIMPLIFIED MOBILE CAMERA FRAME HANDLING
  // Replaced complex queue system with direct rendering
  useEffect(() => {
    if (!secondaryCanvasRef.current) return;

    const canvas = secondaryCanvasRef.current;
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d", { alpha: false });

    if (!ctx) {
      console.error("Failed to get canvas context");
      return;
    }

    console.log("Mobile camera canvas initialized: 640x480");

    const handleMobileFrame = (data) => {
      if (!hasReceivedFrameRef.current) {
        hasReceivedFrameRef.current = true;
        setMobileCameraConnected(true);
        console.log("✅ First mobile frame received - camera connected");
      }

      if (!data?.frame) {
        console.warn("Frame data missing");
        return;
      }

      if (!data.frame.startsWith("data:image/")) {
        console.warn("Invalid image data format");
        return;
      }

      // Create new image for each frame (no queue needed)
      const img = new Image();

      img.onload = () => {
        try {
          // Auto-resize canvas to match image dimensions
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            if (
              canvas.width !== img.naturalWidth ||
              canvas.height !== img.naturalHeight
            ) {
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
            }
          }

          // Draw frame to canvas
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Log every 30th frame
          if (!window.mobileFrameCount) window.mobileFrameCount = 0;
          window.mobileFrameCount++;
          if (window.mobileFrameCount % 30 === 0) {
            console.log(`✅ Rendered ${window.mobileFrameCount} mobile frames`);
          }
        } catch (error) {
          console.error("Canvas draw error:", error);
        }
      };

      img.onerror = (err) => {
        console.error("Failed to load mobile frame:", err);
      };

      // Set image source to trigger load
      img.src = data.frame;
    };

    // Register socket listener
    const socket = interview.socketRef.current;
    if (socket) {
      socket.on("mobile_camera_frame", handleMobileFrame);
      console.log("Mobile camera frame listener registered");
    }

    // Cleanup
    return () => {
      if (socket) {
        socket.off("mobile_camera_frame", handleMobileFrame);
        console.log("Mobile camera frame listener removed");
      }
    };
  }, [interview.socketRef]);

  // Main socket connection and event handler setup
  useEffect(() => {
    console.log("Creating socket connection");

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

    const silenced = [
      "user_audio_chunk",
      "security_frame",
      "video_chunk",
      "audio_chunk",
      "screen_chunk",
      "holistic_detection_result",
      "interim_transcript",
    ];

    socket.onAny((ev, ...args) => {
      if (!silenced.includes(ev)) {
        console.log(`Socket event: "${ev}"`, args.length ? args : "");
      }
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      interview.setStatus("live");
    });

    socket.on("server_ready", () => {
      console.log("Server ready signal received");
      interview.setServerReady(true);
      interview.setIsInitializing(false);

      setTimeout(() => {
        if (!readyForQuestionSentRef.current) {
          socket.emit("ready_for_question");
          readyForQuestionSentRef.current = true;
          console.log("ready_for_question event sent");
        }
      }, 200);
    });

    socket.on("secondary_camera_ready", (data) => {
      console.log("Mobile camera ready:", data);
      setMobileCameraConnected(true);
    });

    socket.on("secondary_camera_status", (data) => {
      if (data.connected) {
        setMobileCameraConnected(true);
      }
    });

    socket.on("interim_transcript", (data) =>
      interview.setLiveTranscript(data.text),
    );

    socket.on("face_violation", (data) => {
      console.warn("Face violation detected:", data);
      setFaceViolationWarning(data);
    });

    socket.on("face_violation_cleared", () => setFaceViolationWarning(null));

    socket.on("face_status_ok", () =>
      setFaceViolationWarning((prev) => (prev !== null ? null : prev)),
    );

    socket.on("interview_terminated", async (data) => {
      console.error("Interview terminated:", data);
      setIsInterviewTerminated(true);
      alert(`Interview Terminated: ${data.message}`);
      await cleanupAllRecordings();
      if (onFinish) onFinish();
      else if (onCancel) onCancel();
    });

    socket.on("audio_recording_ready", (d) =>
      console.log("Audio recording ready:", d),
    );
    socket.on("audio_chunk_uploaded", (d) => {
      if (d.chunkNumber % 10 === 0)
        console.log(`Audio chunk ${d.chunkNumber} uploaded (${d.progress}%)`);
    });
    socket.on("audio_chunk_error", (d) =>
      console.error("Audio chunk error:", d),
    );
    socket.on("audio_processing_complete", (d) =>
      console.log("Audio processing complete:", d),
    );
    socket.on("audio_processing_error", (d) =>
      console.error("Audio processing error:", d),
    );

    socket.on("video_recording_ready", (d) =>
      console.log("Video recording ready:", d),
    );
    socket.on("video_chunk_uploaded", (d) => {
      if (d.chunkNumber % 10 === 0)
        console.log(
          `${d.videoType} chunk ${d.chunkNumber} uploaded (${d.progress}%)`,
        );
    });
    socket.on("video_chunk_error", (d) =>
      console.error(`${d.videoType} chunk error:`, d.error),
    );
    socket.on("video_processing_complete", (d) =>
      console.log(`${d.videoType} processing complete:`, d),
    );
    socket.on("video_processing_error", (d) => {
      console.error(`${d.videoType} processing error:`, d);
      alert(`Video processing failed for ${d.videoType}: ${d.error}`);
    });

    socket.on("evaluation_started", () => setEvaluationStatus("started"));
    socket.on("evaluation_complete", (d) => {
      setEvaluationStatus("complete");
      setEvaluationResults(d.results);
    });
    socket.on("evaluation_error", (d) => {
      setEvaluationStatus("error");
      alert(`Evaluation failed: ${d.message}`);
    });

    socket.on("question", (d) => {
      console.log("Question received:", d);
      interview.handleQuestion(d);
    });
    socket.on("next_question", (d) => interview.handleNextQuestion(d));
    socket.on("idle_prompt", (d) => interview.handleIdlePrompt(d));
    socket.on("transcript_received", (d) =>
      interview.handleTranscriptReceived(d),
    );
    socket.on("final_answer", (d) => interview.handleFinalAnswer(d.text));
    socket.on("listening_enabled", () => interview.enableListening());
    socket.on("listening_disabled", () => interview.disableListening());
    socket.on("tts_audio", (chunk) => {
      if (chunk) interview.handleTtsAudio(chunk);
    });
    socket.on("tts_end", () => interview.handleTtsEnd());

    socket.on("interview_complete", async (d) => {
      console.log("Interview complete:", d);
      interview.handleInterviewComplete(d);
      await cleanupAllRecordings();
    });

    socket.on("connect_error", (err) => {
      console.error("Connection error:", err.message);
      interview.setStatus("error");
      interview.setIsInitializing(false);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      interview.setStatus("disconnected");
      interview.setMicStreamingActive(false);
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
      if (
        error.message &&
        !error.message.includes("Speech recognition") &&
        !error.message.includes("recognition error")
      ) {
        alert(`Interview error: ${error.message}. Please refresh.`);
      }
      interview.setStatus("error");
    });

    interview.initializeInterview({
      interviewId,
      userId,
      sessionId: interviewId,
    });
    socket.connect();

    return () => {
      isCleaningUpRef.current = true;
      (async () => {
        await cleanupAllRecordings();
        if (interview.micStreamRef.current) {
          interview.micStreamRef.current
            .getTracks()
            .forEach((track) => track.stop());
        }
        socket.disconnect();
      })();
    };
  }, [interviewId, userId]);

  // Start all recordings when interview goes live
  useEffect(() => {
    const shouldStart =
      interview.status === "live" &&
      !interview.isInitializing &&
      interview.serverReady &&
      interview.hasStarted &&
      cameraStream &&
      !isVideoRecording;

    if (!shouldStart) return;

    (async () => {
      try {
        console.log("Starting desktop recordings");
        await audioRecording.startRecording();
        console.log("Audio recording started");
        await startVideoRecording();
        console.log("Primary camera recording started");
        setShowScreenSharePrompt(true);
        console.log("Screen share prompt shown");
      } catch (err) {
        console.error("Failed to start recordings:", err);
      }
    })();
  }, [
    interview.status,
    interview.isInitializing,
    interview.serverReady,
    interview.hasStarted,
    cameraStream,
    isVideoRecording,
  ]);

  // Auto-finish when evaluation is complete
  useEffect(() => {
    if (evaluationStatus === "complete" && evaluationResults) {
      alert(
        `Interview completed!\n\nScore: ${evaluationResults.overallScore}%\nDecision: ${evaluationResults.hireDecision}\nLevel: ${evaluationResults.experienceLevel}`,
      );
      if (onFinish) onFinish();
    }
  }, [evaluationStatus, evaluationResults, onFinish]);

  const secondaryIsActive =
    secondaryCamera.isRecording || mobileCameraConnected;

  const Badge = ({ label, active, color }) => (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        active
          ? `bg-${color}-100 dark:bg-${color}-900/30 text-${color}-700 dark:text-${color}-300 shadow-sm`
          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full ${active ? `bg-${color}-500 animate-pulse` : "bg-gray-500"}`}
      />
      {label}
    </div>
  );

  return (
    <section className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
      {showScreenSharePrompt && !screenRecording.isRecording && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-purple-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 max-w-lg w-[calc(100%-2rem)]">
          <svg
            className="w-6 h-6 shrink-0"
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
          <span className="text-sm font-semibold flex-1">
            Screen sharing is required for this interview
          </span>
          <button
            onClick={async () => {
              try {
                await screenRecording.startRecording();
                setShowScreenSharePrompt(false);
              } catch (err) {
                console.error("Screen share denied:", err);
                setScreenShareAttempts((prev) => prev + 1);
                if (screenShareAttempts >= 2) {
                  const skip = confirm(
                    "Screen sharing failed. Continue interview without screen recording?\n\nNote: This may affect your interview evaluation.",
                  );
                  if (skip) setShowScreenSharePrompt(false);
                } else {
                  alert("Please allow screen sharing and try again.");
                }
              }
            }}
            className="bg-white text-purple-700 font-bold text-sm px-4 py-2 rounded-lg hover:bg-purple-50 transition-all shrink-0"
          >
            Share Screen
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2">
            <Card className="flex flex-col overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
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

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    label="Audio"
                    active={audioRecording?.isRecording}
                    color="blue"
                  />
                  <Badge
                    label="Mic"
                    active={interview.isListening}
                    color="emerald"
                  />
                  <Badge
                    label="Primary Cam"
                    active={isVideoRecording}
                    color="red"
                  />
                  <Badge
                    label="Mobile Cam"
                    active={secondaryIsActive}
                    color="orange"
                  />
                  <Badge
                    label="Screen"
                    active={screenRecording.isRecording}
                    color="purple"
                  />
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      isHolisticDetectionReady && hasFace
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 shadow-sm"
                        : !hasFace
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 shadow-sm"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${isHolisticDetectionReady && hasFace ? "bg-green-600" : !hasFace ? "bg-red-600 animate-pulse" : "bg-gray-400"}`}
                    />
                    Detection:{" "}
                    {isHolisticDetectionReady
                      ? hasFace
                        ? "Active"
                        : "None"
                      : "..."}
                  </div>
                </div>
              </div>

              {faceViolationWarning && !isInterviewTerminated && (
                <div className="px-6 py-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-6 h-6 text-red-600 animate-pulse"
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
                          ? "Warning: No Face Detected"
                          : "Warning: Multiple Faces Detected"}
                      </p>
                      <p className="text-xs text-red-800 dark:text-red-200 mt-1">
                        {faceViolationWarning.message} (
                        {faceViolationWarning.count}/{faceViolationWarning.max})
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
                            className="w-5 h-5 text-amber-600"
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
                              className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce"
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
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-emerald-500/50" />
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

          <div className="lg:col-span-1 space-y-4">
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
                        { l: "F", a: hasFace },
                        { l: "P", a: hasPose },
                        { l: "L", a: hasLeftHand },
                        { l: "R", a: hasRightHand },
                      ].map(({ l, a }) => (
                        <span
                          key={l}
                          className={`text-xs px-1.5 py-0.5 rounded ${a ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-3">
                <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  {!cameraStream && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                      <div className="animate-spin w-8 h-8 border-2 border-gray-600 border-t-indigo-500 rounded-full" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 z-10">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg">
                      <div
                        className={`w-2 h-2 rounded-full ${isVideoRecording ? "bg-red-500 animate-pulse" : "bg-gray-500"}`}
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
                      secondaryIsActive
                        ? "text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30"
                        : "text-gray-500 bg-gray-100 dark:bg-gray-700"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${secondaryIsActive ? "bg-orange-600 animate-pulse" : "bg-gray-400"}`}
                    />
                    {secondaryCamera.isRecording
                      ? "RECORDING"
                      : mobileCameraConnected
                        ? "CONNECTED"
                        : "WAITING"}
                  </span>
                </div>
              </div>
              <div className="p-3">
                <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg">
                  <canvas
                    ref={secondaryCanvasRef}
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  {!mobileCameraConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-linear-to-br from-orange-950/60 to-gray-900 gap-3">
                      <div className="animate-spin w-10 h-10 border-2 border-gray-600 border-t-orange-500 rounded-full" />
                      <p className="text-xs text-gray-400 font-semibold">
                        Waiting for mobile...
                      </p>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 z-10">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          secondaryCamera.isRecording
                            ? "bg-orange-500 animate-pulse"
                            : mobileCameraConnected
                              ? "bg-yellow-400 animate-pulse"
                              : "bg-gray-500"
                        }`}
                      />
                      <span className="text-xs font-bold text-white">
                        {secondaryCamera.isRecording
                          ? "REC"
                          : mobileCameraConnected
                            ? "LIVE"
                            : "OFFLINE"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

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
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />{" "}
                      LIVE
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3">
                <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg">
                  <video
                    ref={screenVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-contain ${screenRecording.screenStream ? "block" : "hidden"}`}
                  />
                  {!screenRecording.screenStream && (
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
                        {showScreenSharePrompt
                          ? "Click 'Share Screen' below"
                          : "Waiting to start..."}
                      </p>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 z-10">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg">
                      <div
                        className={`w-2 h-2 rounded-full ${screenRecording.isRecording ? "bg-purple-500 animate-pulse" : "bg-gray-500"}`}
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
