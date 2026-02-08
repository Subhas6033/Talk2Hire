import { useEffect, useCallback, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Button } from "../index";
import { Card } from "../Common/Card";
import { useInterview } from "../../Hooks/useInterviewHook";
import useVideoRecording from "../../Hooks/useVideoRecordingHook";

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

  const [waitingForQuestions, setWaitingForQuestions] = useState(false);
  const [evaluationStatus, setEvaluationStatus] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState(null);

  // ✅ ADD: Track if we've sent ready_for_question
  const readyForQuestionSentRef = useRef(false);

  // Video element setup (unchanged)
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

  // Stream health monitor (unchanged)
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
    <section className="p-4 md:p-6">
      <div className="max-w-350 mx-auto h-full">
        <div className="grid grid-cols-1 gap-4 md:gap-6 h-full">
          <div className="flex flex-col gap-4">
            <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                        interview.isPlaying
                          ? "bg-blue-600"
                          : interview.isListening
                            ? "bg-emerald-600"
                            : "bg-gray-700"
                      }`}
                    >
                      {interview.isPlaying ? (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" />
                        </svg>
                      ) : interview.isListening ? (
                        <svg
                          className="w-5 h-5 text-white"
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
                          className="w-5 h-5 text-white"
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
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Interview Assistant
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {interview.isPlaying
                        ? "Speaking"
                        : interview.isListening
                          ? "Listening"
                          : "Standby"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      interview.isPlaying
                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        interview.isPlaying
                          ? "bg-blue-600 animate-pulse"
                          : "bg-gray-400"
                      }`}
                    />
                    Audio
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      interview.isListening
                        ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        interview.isListening
                          ? "bg-emerald-600 animate-pulse"
                          : "bg-gray-400"
                      }`}
                    />
                    Mic
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isVideoRecording
                        ? "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        isVideoRecording
                          ? "bg-red-600 animate-pulse"
                          : "bg-gray-400"
                      }`}
                    />
                    {isVideoRecording ? "Recording" : "Video"}
                  </div>
                  {evaluationStatus && (
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        evaluationStatus === "complete"
                          ? "bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300"
                          : evaluationStatus === "error"
                            ? "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300"
                            : "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          evaluationStatus === "complete"
                            ? "bg-green-600"
                            : evaluationStatus === "error"
                              ? "bg-red-600"
                              : "bg-blue-600 animate-pulse"
                        }`}
                      />
                      {evaluationStatus === "complete"
                        ? "Evaluated"
                        : evaluationStatus === "error"
                          ? "Eval Error"
                          : "Evaluating"}
                    </div>
                  )}
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col p-6 bg-white dark:bg-gray-900">
                {evaluationStatus === "started" && (
                  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin w-5 h-5 border-3 border-blue-600 border-t-transparent rounded-full" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                          Evaluating Your Interview
                        </p>
                        <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                          Please wait while we analyze your responses...
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {interview.status === "connecting" && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-3 border-gray-200 dark:border-gray-700 border-t-blue-600 rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Connecting to server
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Please wait...
                    </p>
                  </div>
                )}

                {interview.status === "live" && interview.isInitializing && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-3 border-gray-200 dark:border-gray-700 border-t-indigo-600 rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Starting interview
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Setting up your session...
                    </p>
                  </div>
                )}

                {interview.status === "live" &&
                  !interview.currentQuestion &&
                  !interview.isInitializing && (
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 border-3 border-gray-200 dark:border-gray-700 border-t-purple-600 rounded-full animate-spin mb-4" />
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Loading question
                      </p>
                    </div>
                  )}

                {interview.status === "live" && interview.currentQuestion && (
                  <div className="flex-1 flex flex-col justify-center space-y-6">
                    {interview.idlePrompt && (
                      <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
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
                          <span className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                            Waiting for Response
                          </span>
                        </div>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          {interview.idlePrompt}
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            Q
                          </span>
                        </div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Question {interview.questionOrder}
                        </span>
                      </div>
                      <p className="text-lg md:text-xl text-gray-900 dark:text-gray-100 leading-relaxed">
                        {interview.currentQuestion}
                      </p>
                    </div>

                    {interview.isListening && (
                      <div className="flex items-center gap-2 justify-center pt-4">
                        <div className="flex gap-1">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className="w-1.5 h-1.5 bg-emerald-600 dark:bg-emerald-500 rounded-full animate-bounce"
                              style={{ animationDelay: `${i * 0.1}s` }}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          Listening to your response
                        </span>
                      </div>
                    )}

                    {interview.liveTranscript && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          {interview.liveTranscript}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {interview.status === "error" && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center mb-4">
                      <svg
                        className="w-6 h-6 text-red-600 dark:text-red-400"
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
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Connection error
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Please refresh and try again
                    </p>
                  </div>
                )}

                {interview.status === "disconnected" && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mb-4">
                      <svg
                        className="w-6 h-6 text-amber-600 dark:text-amber-400"
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
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Disconnected
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Reconnecting...
                    </p>
                  </div>
                )}
              </div>

              {!interview.isInitializing && interview.userText && (
                <div className="border-t border-gray-200 dark:border-gray-800 p-6 bg-gray-50 dark:bg-gray-900/50">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          A
                        </span>
                      </div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Your Answer
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pl-8">
                      {interview.userText}
                    </p>
                  </div>
                </div>
              )}

              {!interview.isInitializing && (
                <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-4 bg-white dark:bg-gray-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      Interview active • {interview.recordingDuration}
                    </div>
                    <Button
                      variant="secondary"
                      onClick={onCancel}
                      className="text-xs px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      End Interview
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Primary Camera */}
            {cameraStream && (
              <Card className="flex flex-col overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-gray-400"
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
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Primary Camera
                    </h3>
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-gray-900">
                  <div className="relative w-full aspect-4/3 bg-gray-900 rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />
                    <div className="absolute top-3 left-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-md">
                        <div
                          className={`w-2 h-2 rounded-full ${isVideoRecording ? "bg-red-500 animate-pulse" : "bg-gray-500"}`}
                        />
                        <span className="text-xs font-medium text-white">
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
          </div>
        </div>
      </div>
    </section>
  );
};

export default InterviewQuestions;
