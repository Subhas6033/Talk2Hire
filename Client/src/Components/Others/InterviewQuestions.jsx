import { useEffect, useCallback, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Button } from "../index";
import { Card } from "../Common/Card";
import { useInterview } from "../../Hooks/useInterviewHook";
import useVideoRecording from "../../Hooks/useVideoRecordingHook";
import useHolisticDetection from "../../Hooks/useHolisticDetectionHook";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

const InterviewQuestions = ({
  interviewId,
  userId,
  cameraStream,
  onCancel,
  onFinish,
}) => {
  const interview = useInterview(interviewId, userId, cameraStream);

  const {
    isRecording: isVideoRecording,
    startRecording: startVideoRecording,
    stopRecording: stopVideoRecording,
    recordedChunks,
  } = useVideoRecording(interviewId, userId, cameraStream, interview.socketRef);

  const videoRef = useRef(null);
  const isCleaningUpRef = useRef(false);

  const {
    detectionData,
    isInitialized: isHolisticDetectionReady,
    hasFace,
    hasPose,
    hasLeftHand,
    hasRightHand,
  } = useHolisticDetection(
    videoRef.current,
    interview.socketRef.current,
    interview.status === "live" && !interview.isInitializing,
  );

  const [waitingForQuestions, setWaitingForQuestions] = useState(false);
  const [evaluationStatus, setEvaluationStatus] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [faceViolationWarning, setFaceViolationWarning] = useState(null);
  const [isInterviewTerminated, setIsInterviewTerminated] = useState(false);

  // ✅ ADD: Track if we've sent ready_for_question
  const readyForQuestionSentRef = useRef(false);

  // Video element setup
  useEffect(() => {
    console.log("📹 Video element setup START:", {
      hasVideoRef: !!videoRef.current,
      hasCameraStream: !!cameraStream,
      streamActive: cameraStream?.active,
    });

    if (!videoRef.current || !cameraStream) {
      console.log("⚠️ Missing video ref or camera stream, skipping setup");
      return;
    }

    const videoTrack = cameraStream.getVideoTracks()[0];

    if (!videoTrack) {
      console.error("❌ FATAL: No video track found in stream!");
      alert(
        "No video track available. Please refresh and allow camera access.",
      );
      return;
    }

    console.log("📹 Video track details:", {
      label: videoTrack.label,
      enabled: videoTrack.enabled,
      readyState: videoTrack.readyState,
    });

    if (videoTrack.readyState !== "live") {
      console.error(
        "❌ FATAL: Video track is not live! State:",
        videoTrack.readyState,
      );
      alert(
        `Video track is ${videoTrack.readyState}. Please refresh and try again.`,
      );
      return;
    }

    console.log("✅ Video track verified as LIVE");

    const setupVideo = () => {
      if (!videoRef.current || !cameraStream) {
        console.log("⚠️ Video ref or stream lost during setup");
        return;
      }

      console.log("📹 Attaching stream to video element");

      if (
        videoRef.current.srcObject &&
        videoRef.current.srcObject !== cameraStream
      ) {
        console.log("🧹 Clearing old stream");
        videoRef.current.srcObject = null;
      }

      videoRef.current.srcObject = cameraStream;
      videoRef.current.setAttribute("playsinline", "true");
      videoRef.current.setAttribute("autoplay", "true");
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;

      console.log("📹 Video element attributes set");

      videoRef.current.onloadedmetadata = () => {
        console.log("✅ Video metadata loaded");

        if (!videoRef.current) return;

        const playPromise = videoRef.current.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log("✅ Video playing successfully!");

              if (!videoRef.current) return;

              const state = {
                paused: videoRef.current.paused,
                readyState: videoRef.current.readyState,
                videoWidth: videoRef.current.videoWidth,
                videoHeight: videoRef.current.videoHeight,
                currentTime: videoRef.current.currentTime,
              };

              console.log("📹 Video playback state:", state);

              if (state.videoWidth <= 2 || state.videoHeight <= 2) {
                console.error("❌ INVALID VIDEO DIMENSIONS:", state);
                console.error("Stream may be inactive or corrupted!");

                setTimeout(() => {
                  console.log("🔄 Attempting to reload stream...");
                  if (videoRef.current && cameraStream) {
                    videoRef.current.srcObject = null;
                    setTimeout(() => {
                      if (videoRef.current && cameraStream) {
                        videoRef.current.srcObject = cameraStream;
                        videoRef.current.play();
                      }
                    }, 500);
                  }
                }, 1000);
              } else {
                console.log(
                  "✅ Video dimensions are valid:",
                  `${state.videoWidth}x${state.videoHeight}`,
                );
              }
            })
            .catch((err) => {
              console.error("❌ Video play() failed:", err);

              if (err.name === "NotAllowedError" || err.name === "AbortError") {
                console.log(
                  "🔊 Autoplay blocked - waiting for user interaction",
                );

                const playOnClick = () => {
                  console.log("👆 User interaction detected, playing video");
                  videoRef.current
                    ?.play()
                    .then(() =>
                      console.log("✅ Video playing after interaction"),
                    )
                    .catch((e) =>
                      console.error("❌ Still failed after click:", e),
                    );
                  document.removeEventListener("click", playOnClick);
                };

                document.addEventListener("click", playOnClick, { once: true });
                alert("Click anywhere to start video preview");
              } else {
                alert("Video playback error: " + err.message);
              }
            });
        }
      };

      videoRef.current.onerror = (err) => {
        console.error("❌ Video element error:", err);
      };
    };

    if (cameraStream.active && videoTrack.readyState === "live") {
      console.log("✅ Stream is active, setting up video immediately");
      setupVideo();
    } else {
      console.log("⏳ Waiting for stream to fully activate...");
      const activationTimer = setTimeout(() => {
        if (cameraStream.active && videoTrack.readyState === "live") {
          console.log("✅ Stream activated, setting up video");
          setupVideo();
        } else {
          console.error("❌ Stream failed to activate:", {
            streamActive: cameraStream.active,
            trackState: videoTrack.readyState,
          });
          alert("Camera stream failed to activate. Please refresh.");
        }
      }, 500);

      return () => clearTimeout(activationTimer);
    }

    return () => {
      console.log("🧹 Video setup cleanup - keeping stream active");
    };
  }, [cameraStream]);

  // Stream health monitor
  useEffect(() => {
    if (!cameraStream) {
      console.log("⚠️ No camera stream to monitor");
      return;
    }

    let checkCount = 0;
    let hasAlerted = false;

    console.log("🏥 Starting stream health monitor");

    const monitorInterval = setInterval(() => {
      checkCount++;

      const videoTrack = cameraStream.getVideoTracks()[0];
      const health = {
        check: checkCount,
        stream: {
          active: cameraStream.active,
          id: cameraStream.id,
        },
        track: videoTrack
          ? {
              label: videoTrack.label,
              readyState: videoTrack.readyState,
              enabled: videoTrack.enabled,
            }
          : null,
        videoElement: videoRef.current
          ? {
              paused: videoRef.current.paused,
              readyState: videoRef.current.readyState,
              videoWidth: videoRef.current.videoWidth,
              videoHeight: videoRef.current.videoHeight,
              srcObject: !!videoRef.current.srcObject,
            }
          : null,
      };

      if (checkCount % 3 === 0) {
        console.log(`🏥 Health check #${checkCount}:`, health);
      }

      if (!cameraStream.active && !hasAlerted) {
        console.error("❌ CRITICAL: Camera stream became inactive!");
        alert("Camera stream stopped. Please refresh.");
        hasAlerted = true;
        clearInterval(monitorInterval);
        return;
      }

      if (videoTrack && videoTrack.readyState === "ended" && !hasAlerted) {
        console.error("❌ CRITICAL: Video track ended!");
        alert("Camera track stopped. Please refresh.");
        hasAlerted = true;
        clearInterval(monitorInterval);
        return;
      }

      if (
        videoRef.current &&
        videoRef.current.videoWidth <= 2 &&
        videoRef.current.videoHeight <= 2 &&
        checkCount >= 2 &&
        !hasAlerted
      ) {
        console.error("❌ CRITICAL: Invalid video dimensions!");
        console.log("🔄 Attempting emergency stream restart...");

        if (videoRef.current && cameraStream) {
          videoRef.current.srcObject = null;

          setTimeout(() => {
            if (videoRef.current && cameraStream) {
              videoRef.current.srcObject = cameraStream;
              videoRef.current
                .play()
                .then(() => {
                  console.log("✅ Emergency restart successful");

                  setTimeout(() => {
                    if (videoRef.current) {
                      const newDims = {
                        width: videoRef.current.videoWidth,
                        height: videoRef.current.videoHeight,
                      };
                      console.log("📹 New dimensions:", newDims);

                      if (newDims.width <= 2 || newDims.height <= 2) {
                        console.error("❌ Restart failed");
                        alert("Video display failed. Please refresh.");
                        hasAlerted = true;
                      }
                    }
                  }, 1000);
                })
                .catch((err) => {
                  console.error("❌ Emergency restart failed:", err);
                  alert("Failed to fix video. Please refresh.");
                  hasAlerted = true;
                });
            }
          }, 500);
        }
      }

      if (checkCount >= 20) {
        console.log("✅ Stream health monitoring completed");
        clearInterval(monitorInterval);
      }
    }, 10000);

    return () => {
      console.log("🧹 Stopping stream health monitor");
      clearInterval(monitorInterval);
    };
  }, [cameraStream]);

  // Socket health monitor
  useEffect(() => {
    if (!interview.socketRef.current) return;

    const healthCheckInterval = setInterval(() => {
      if (interview.socketRef.current?.connected) {
        console.log("💚 Socket health: Connected");
      } else {
        console.warn("💔 Socket health: Disconnected");
      }
    }, 10000);

    return () => clearInterval(healthCheckInterval);
  }, [interview.socketRef]);

  // ✅ MAIN SOCKET INITIALIZATION
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
      if (
        eventName !== "user_audio_chunk" &&
        eventName !== "security_frame" &&
        eventName !== "video_chunk"
      ) {
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

    // ✅ CRITICAL: Wait for server_ready before sending ready_for_question
    socket.on("server_ready", () => {
      console.log("✅ Server ready signal received!");
      interview.setServerReady(true);
      interview.setIsInitializing(false);

      // ✅ NEW: Send ready_for_question ONLY after server_ready
      setTimeout(() => {
        if (!readyForQuestionSentRef.current) {
          console.log("📤 Sending ready_for_question to server...");
          socket.emit("ready_for_question");
          readyForQuestionSentRef.current = true;
        }
      }, 200);
    });

    socket.on("interim_transcript", (data) => {
      console.log("💬 Interim transcript:", data.text);
      interview.setLiveTranscript(data.text);
    });

    // Face Detection Socket Listeners
    socket.on("face_violation", (data) => {
      console.warn("⚠️ Face violation:", data);
      setFaceViolationWarning(data);
    });

    socket.on("face_violation_cleared", () => {
      console.log("✅ Face violation cleared");
      setFaceViolationWarning(null);
    });

    socket.on("face_status_ok", () => {
      console.log("✅ Face status OK");
      setFaceViolationWarning(null);
    });

    socket.on("interview_terminated", (data) => {
      console.error("❌ Interview terminated:", data);
      setIsInterviewTerminated(true);

      alert(`Interview Terminated: ${data.message}`);

      // Stop video recording
      if (isVideoRecording) {
        stopVideoRecording();
      }

      // Call onFinish or onCancel
      if (onFinish) {
        onFinish();
      } else if (onCancel) {
        onCancel();
      }
    });

    socket.on("video_chunk_uploaded", (data) => {
      if (data.chunkNumber % 10 === 0) {
        console.log(
          `✅ Server confirmed chunk ${data.chunkNumber} (${data.progress}%)`,
        );
      }
    });

    socket.on("video_chunk_error", (data) => {
      console.error(
        `❌ Server error with chunk ${data.chunkNumber}:`,
        data.error,
      );
    });

    socket.on("video_recording_stopped", (data) => {
      console.log("✅ Server acknowledged recording stop:", data);
    });

    socket.on("video_processing_complete", (data) => {
      console.log("✅ Video processing complete:", data);
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

    socket.on("video_processing_error", (data) => {
      console.error("❌ Video processing error:", data);
      alert(`Video processing failed for ${data.videoType}: ${data.error}`);
    });

    socket.on("question", (data) => {
      console.log("📨 Received 'question' event:", data);
      setWaitingForQuestions(false);
      interview.handleQuestion(data);
    });

    socket.on("next_question", (data) => {
      console.log("📨 Received 'next_question' event:", data);
      interview.handleNextQuestion(data);
    });

    socket.on("idle_prompt", (data) => {
      console.log("⏰ Received idle prompt:", data);
      interview.handleIdlePrompt(data);
    });

    socket.on("transcript_received", (data) => {
      console.log("📝 Transcript received from server:", data);
      interview.handleTranscriptReceived(data);
    });

    socket.on("final_answer", (data) => {
      console.log("✅ Final answer:", data);
      interview.handleFinalAnswer(data.text);
    });

    socket.on("listening_enabled", () => {
      console.log("✅ Server enabled listening");
      interview.enableListening();
    });

    socket.on("listening_disabled", () => {
      console.log("🛑 Server disabled listening");
      interview.disableListening();
    });

    socket.on("tts_audio", (chunk) => {
      if (!chunk) {
        console.log("⚠️ Received empty audio chunk");
        return;
      }
      interview.handleTtsAudio(chunk);
    });

    socket.on("interview_complete", async (data) => {
      console.log("🎉 Interview complete:", data);
      interview.handleInterviewComplete(data);

      if (isVideoRecording) {
        console.log("🎥 Stopping video recording...");
        try {
          await stopVideoRecording();
          console.log("✅ Video recording stopped");
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (err) {
          console.error("❌ Error stopping video:", err);
        }
      }

      console.log("⏳ Waiting for evaluation...");
    });

    socket.on("tts_end", () => {
      console.log("🔔 TTS stream ended");
      interview.handleTtsEnd();
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connect error:", err.message);
      interview.setStatus("error");
      interview.setIsInitializing(false);
    });

    socket.on("connect_timeout", () => {
      console.error("❌ Socket connection timeout after 20s");
      interview.setStatus("error");
      interview.setIsInitializing(false);
      alert("Connection timeout. Please check your internet and refresh.");
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
      console.log("🧹 Cleaning up socket and resources...");
      isCleaningUpRef.current = true;

      if (isVideoRecording) {
        stopVideoRecording();
      }

      if (interview.micStreamRef.current) {
        interview.micStreamRef.current
          .getTracks()
          .forEach((track) => track.stop());
      }

      if (cameraStream) {
        console.log(
          "✅ Camera stream still active - NOT stopping (owned by parent)",
        );
      }

      socket.disconnect();
      console.log("🔌 Cleanup complete");
    };
  }, [interviewId, userId]);

  // ✅ VIDEO RECORDING START LOGIC
  useEffect(() => {
    const shouldStartRecording =
      interview.status === "live" &&
      !interview.isInitializing &&
      interview.serverReady &&
      interview.hasStarted &&
      cameraStream &&
      !isVideoRecording;

    console.log("📹 Video recording decision check:", {
      status: interview.status,
      isInitializing: interview.isInitializing,
      serverReady: interview.serverReady,
      hasStarted: interview.hasStarted,
      hasStream: !!cameraStream,
      streamActive: cameraStream?.active,
      isRecording: isVideoRecording,
      shouldStart: shouldStartRecording,
      socketConnected: interview.socketRef.current?.connected,
    });

    if (shouldStartRecording) {
      console.log(
        "🎥 All conditions met - scheduling video recording start...",
      );

      const timer = setTimeout(() => {
        console.log("🎥 Starting video recording now...");
        console.log("📊 Final check before start:", {
          socketExists: !!interview.socketRef.current,
          socketConnected: interview.socketRef.current?.connected,
          streamExists: !!cameraStream,
          streamActive: cameraStream?.active,
        });

        startVideoRecording();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [
    interview.status,
    interview.isInitializing,
    interview.serverReady,
    interview.hasStarted,
    cameraStream,
    isVideoRecording,
    startVideoRecording,
    interview.socketRef,
  ]);

  // Auto-finish when evaluation completes
  useEffect(() => {
    if (evaluationStatus === "complete" && evaluationResults) {
      console.log("✅ Evaluation complete, showing results and finishing...");

      const message = `Interview completed! You answered ${interview.questionOrder} questions.
      
Overall Score: ${evaluationResults.overallScore}%
Decision: ${evaluationResults.hireDecision}
Experience Level: ${evaluationResults.experienceLevel}

Your videos have been processed and evaluation is complete.`;

      alert(message);

      if (onFinish) {
        onFinish();
      }
    }
  }, [evaluationStatus, evaluationResults, interview.questionOrder, onFinish]);

  // Emergency stream recovery
  useEffect(() => {
    if (!cameraStream) return;

    const checkInterval = setInterval(() => {
      const videoTrack = cameraStream.getVideoTracks()[0];

      if (!videoTrack) {
        console.error("❌ CRITICAL: Video track disappeared!");
        clearInterval(checkInterval);
        alert(
          "Camera track lost. Interview will be interrupted. Please refresh.",
        );
        return;
      }

      if (videoTrack.readyState === "ended") {
        console.error("❌ CRITICAL: Video track ended unexpectedly!");
        clearInterval(checkInterval);

        navigator.mediaDevices
          .getUserMedia({
            video: { facingMode: "user" },
          })
          .then((newStream) => {
            console.log("✅ Recovered camera stream");

            if (videoRef.current) {
              videoRef.current.srcObject = newStream;
              videoRef.current.play();
            }

            alert("Camera was restarted. Recording may have gaps.");
          })
          .catch((err) => {
            console.error("❌ Recovery failed:", err);
            alert("Camera stopped and could not be recovered. Please refresh.");
          });
      }
    }, 2000);

    return () => clearInterval(checkInterval);
  }, [cameraStream]);

  return (
    <section className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Column - Interview Card */}
          <div className="lg:col-span-2">
            <Card className="flex flex-col overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
                <div className="flex items-center gap-3">
                  <div className="relative">
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
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${interview.isPlaying ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${interview.isPlaying ? "bg-blue-600 animate-pulse" : "bg-gray-400"}`}
                    />
                    Audio
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${interview.isListening ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 shadow-sm" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${interview.isListening ? "bg-emerald-600 animate-pulse" : "bg-gray-400"}`}
                    />
                    Mic
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isVideoRecording ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 shadow-sm" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${isVideoRecording ? "bg-red-600 animate-pulse" : "bg-gray-400"}`}
                    />
                    Video
                  </div>
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

              {/* Face Violation Warning Banner */}
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
                    <div className="flex-1">
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

              {/* Main Content Area */}
              <div className="flex-1 p-6 bg-white dark:bg-gray-800 min-h-100">
                {evaluationStatus === "started" && (
                  <div className="mb-4 p-4 bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full" />
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
                      <div className="p-4 bg-linear-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl shadow-sm">
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
                      <div className="p-4 bg-linear-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm">
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

          {/* Right Column - Cameras */}
          <div className="lg:col-span-1 space-y-4">
            {/* Primary Camera */}
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

                    {/* Detection status indicators */}
                    {isHolisticDetectionReady && (
                      <div className="flex gap-1">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${hasFace ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
                        >
                          F
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${hasPose ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
                        >
                          P
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${hasLeftHand ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
                        >
                          L
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${hasRightHand ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
                        >
                          R
                        </span>
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

            {/* Secondary Camera (Mobile) - Placeholder */}
            <Card className="overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700">
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
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Security Camera
                  </h3>
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-gray-800">
                <div className="relative w-full aspect-video bg-linear-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden shadow-lg flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <svg
                      className="w-12 h-12 text-gray-600 mx-auto"
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
                    <p className="text-xs text-gray-500 font-semibold">
                      Waiting for mobile connection...
                    </p>
                  </div>
                  <div className="absolute top-3 left-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg shadow-xl">
                      <div className="w-2 h-2 rounded-full bg-gray-500" />
                      <span className="text-xs font-bold text-white">
                        OFFLINE
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Interview Terminated Overlay */}
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
