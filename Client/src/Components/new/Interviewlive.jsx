import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "../../Hooks/useInterviewHook";
import useVideoRecording from "../../Hooks/useVideoRecordingHook";
import useHolisticDetection from "../../Hooks/useHolisticDetectionHook";
import useScreenRecording from "../../Hooks/useScreenRecording";
import useSecondaryCamera from "../../Hooks/useSecondaryCameraHook";
import { Button } from "../index";
import { Card } from "../Common/Card";
import { useStreams } from "../../Hooks/streamContext";

const InterviewLive = () => {
  const navigate = useNavigate();
  const streamsRef = useStreams();

  // Initial context check
  useEffect(() => {
    console.log("🔍 INITIAL CONTEXT CHECK:", {
      streamsRef: streamsRef.current,
      hasSessionData: !!streamsRef.current?.sessionData,
      hasMic: !!streamsRef.current?.micStream,
      hasCamera: !!streamsRef.current?.primaryCameraStream,
      hasScreen: !!streamsRef.current?.screenShareStream,
      hasSocket: !!streamsRef.current?.preInitializedSocket,
    });
  }, []);

  // Get streams and session from context ref
  const {
    sessionData,
    micStream,
    primaryCameraStream,
    screenShareStream,
    preInitializedSocket,
  } = streamsRef.current || {};

  // ✅ FIXED: Better redirect logic with proper delay
  useEffect(() => {
    const timer = setTimeout(() => {
      if (
        !sessionData ||
        !micStream ||
        !primaryCameraStream ||
        !screenShareStream
      ) {
        console.error("❌ Missing required streams:", {
          hasSessionData: !!sessionData,
          hasMicStream: !!micStream,
          hasPrimaryCamera: !!primaryCameraStream,
          hasScreenShare: !!screenShareStream,
        });
        alert("Invalid session. Please complete setup first.");
        navigate("/interview");
      }
    }, 1000); // Increased from 500ms to 1000ms

    return () => clearTimeout(timer);
  }, [
    sessionData,
    micStream,
    primaryCameraStream,
    screenShareStream,
    navigate,
  ]);

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

  const secondaryCamera = useSecondaryCamera(
    sessionData?.interviewId,
    sessionData?.userId,
    interview.socketRef,
  );

  const videoRef = useRef(null);
  const secondaryCanvasRef = useRef(null);
  const screenVideoRef = useRef(null);
  const recordingsStartedRef = useRef(false);

  const [evaluationStatus, setEvaluationStatus] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [faceViolationWarning, setFaceViolationWarning] = useState(null);
  const [isInterviewTerminated, setIsInterviewTerminated] = useState(false);
  const [mobileCameraConnected, setMobileCameraConnected] = useState(false);

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

  const cleanupAllRecordings = async () => {
    console.log("🧹 Cleaning up recordings");
    const promises = [];

    if (isVideoRecording) {
      promises.push(stopVideoRecording().catch((e) => console.error(e)));
    }
    if (audioRecording?.isRecording) {
      try {
        audioRecording.stopRecording();
      } catch (e) {
        console.error(e);
      }
    }
    if (screenRecording.isRecording) {
      promises.push(
        screenRecording.stopRecording().catch((e) => console.error(e)),
      );
    }
    if (secondaryCamera.isRecording) {
      promises.push(
        secondaryCamera.stopRecording().catch((e) => console.error(e)),
      );
    }

    await Promise.allSettled(promises);
    console.log("✅ Cleanup complete");
  };

  // ✅ Attach primary camera stream
  useEffect(() => {
    if (videoRef.current && primaryCameraStream) {
      console.log("📹 Attaching primary camera stream");
      videoRef.current.srcObject = primaryCameraStream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.play().catch((err) => {
        if (err.name !== "AbortError") {
          console.error("❌ Video play error:", err);
        }
      });
    }
  }, [primaryCameraStream]);

  // ✅ FIXED: Attach screen share stream with better error handling
  useEffect(() => {
    if (!screenVideoRef.current || !screenShareStream) {
      console.log("⏸️ Waiting for screen share stream or video ref");
      return;
    }

    console.log("🖥️ Attaching screen share stream");

    const videoElement = screenVideoRef.current;

    // Clear any previous stream
    if (videoElement.srcObject) {
      const oldStream = videoElement.srcObject;
      oldStream.getTracks().forEach((track) => track.stop());
    }

    videoElement.srcObject = screenShareStream;
    videoElement.muted = true;
    videoElement.playsInline = true;

    const playVideo = async () => {
      try {
        // Wait for metadata to load
        await new Promise((resolve, reject) => {
          if (videoElement.readyState >= 2) {
            resolve();
          } else {
            videoElement.onloadedmetadata = resolve;
            videoElement.onerror = reject;
            setTimeout(() => reject(new Error("Metadata timeout")), 5000);
          }
        });

        await videoElement.play();
        console.log("✅ Screen video playing");
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("❌ Screen video play error:", err);

          // Retry once after delay
          setTimeout(() => {
            videoElement.play().catch((e) => {
              console.error("❌ Screen video retry failed:", e);
            });
          }, 500);
        }
      }
    };

    playVideo();

    return () => {
      videoElement.onloadedmetadata = null;
      videoElement.onerror = null;
    };
  }, [screenShareStream]);

  // Debug: Monitor screen video element state
  useEffect(() => {
    if (!screenVideoRef.current) return;

    const video = screenVideoRef.current;

    const logStatus = () => {
      console.log("📺 Screen Video Status:", {
        hasStream: !!video.srcObject,
        streamActive: video.srcObject?.active,
        readyState: video.readyState,
        paused: video.paused,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      });
    };

    // Log immediately and on state changes
    logStatus();

    video.addEventListener("loadedmetadata", logStatus);
    video.addEventListener("canplay", logStatus);
    video.addEventListener("playing", logStatus);
    video.addEventListener("pause", logStatus);
    video.addEventListener("error", (e) => {
      console.error("❌ Screen video error:", e);
    });

    return () => {
      video.removeEventListener("loadedmetadata", logStatus);
      video.removeEventListener("canplay", logStatus);
      video.removeEventListener("playing", logStatus);
      video.removeEventListener("pause", logStatus);
    };
  }, []);

  // Debug screen share status
  useEffect(() => {
    if (screenShareStream) {
      console.log("📊 Screen Share Status:", {
        active: screenShareStream.active,
        tracks: screenShareStream.getTracks().length,
        trackStates: screenShareStream.getTracks().map((t) => ({
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
        })),
        videoRefAttached: !!screenVideoRef.current?.srcObject,
        videoRefPaused: screenVideoRef.current?.paused,
      });
    }
  }, [screenShareStream]);

  // Initialize canvas for mobile frames
  useEffect(() => {
    if (secondaryCanvasRef.current) {
      const canvas = secondaryCanvasRef.current;
      canvas.width = 640;
      canvas.height = 480;
    }
  }, []);

  // ✅ USE PRE-INITIALIZED SOCKET
  useEffect(() => {
    if (!sessionData || !preInitializedSocket) {
      console.warn("⚠️ No pre-initialized socket available");
      return;
    }

    const socket = preInitializedSocket;
    interview.socketRef.current = socket;

    console.log("✅ Using pre-initialized socket:", socket.id);
    console.log("🎬 NOW STARTING INTERVIEW (will send media + receive TTS)");

    const silenced = [
      "user_audio_chunk",
      "video_chunk",
      "audio_chunk",
      "holistic_detection_result",
      "interim_transcript",
    ];

    socket.onAny((ev, ...args) => {
      if (!silenced.includes(ev)) {
        console.log(`📡 Socket: "${ev}"`);
      }
    });

    // Socket is already connected from setup
    if (socket.connected) {
      console.log("✅ Socket already connected:", socket.id);

      // ✅ CRITICAL: Tell server to START INTERVIEW NOW
      console.log("🚀 Emitting 'client_ready' - Interview starting...");
      socket.emit("client_ready", {
        interviewId: sessionData.interviewId,
        userId: sessionData.userId,
        timestamp: Date.now(),
      });

      interview.setStatus("live");
      interview.setServerReady(true);
      interview.setIsInitializing(false);
    } else {
      console.log("🔄 Socket not connected, reconnecting...");
      socket.connect();

      socket.on("connect", () => {
        console.log("✅ Connected:", socket.id);

        // ✅ CRITICAL: Tell server to START INTERVIEW NOW
        console.log("🚀 Emitting 'client_ready' - Interview starting...");
        socket.emit("client_ready", {
          interviewId: sessionData.interviewId,
          userId: sessionData.userId,
          timestamp: Date.now(),
        });

        interview.setStatus("live");
      });

      socket.on("server_ready", () => {
        console.log("✅ Server ready");
        interview.setServerReady(true);
        interview.setIsInitializing(false);
      });
    }

    // ✅ NOW we can receive TTS and questions
    socket.on("question", (d) => {
      console.log("❓ Received question:", d.question);
      interview.handleQuestion(d);
    });

    socket.on("tts_audio", (chunk) => {
      if (chunk) {
        console.log("🔊 Received TTS audio chunk");
        interview.handleTtsAudio(chunk);
      }
    });

    socket.on("tts_end", () => {
      console.log("🔊 TTS playback ended");
      interview.handleTtsEnd();
    });

    socket.on("secondary_camera_ready", (data) => {
      console.log("✅ Secondary camera ready");
      setMobileCameraConnected(true);
    });

    socket.on("secondary_camera_status", (data) => {
      if (data.connected) {
        setMobileCameraConnected(true);
      }
    });

    socket.on("mobile_camera_frame", (data) => {
      if (!data?.frame || !secondaryCanvasRef.current) return;

      const canvas = secondaryCanvasRef.current;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        try {
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            if (
              canvas.width !== img.naturalWidth ||
              canvas.height !== img.naturalHeight
            ) {
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
            }
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        } catch (error) {
          console.error("Canvas error:", error);
        }
      };
      img.src = data.frame;
    });

    socket.on("interim_transcript", (data) => {
      console.log("📝 Interim transcript:", data.text);
      interview.setLiveTranscript(data.text);
    });

    socket.on("face_violation", (data) => {
      console.warn("⚠️ Face violation:", data);
      setFaceViolationWarning(data);
    });

    socket.on("face_violation_cleared", () => {
      console.log("✅ Face violation cleared");
      setFaceViolationWarning(null);
    });

    socket.on("interview_terminated", async (data) => {
      console.error("❌ Interview terminated:", data);
      setIsInterviewTerminated(true);
      interview.setMicStreamingActive(false);
      alert(`Interview Terminated: ${data.message}`);
      await cleanupAllRecordings();
      socket.disconnect();
      navigate("/dashboard");
    });

    socket.on("audio_recording_ready", (d) =>
      console.log("✅ Audio ready:", d),
    );
    socket.on("audio_recording_error", (d) =>
      console.error("❌ Audio error:", d),
    );
    socket.on("video_recording_ready", (d) =>
      console.log("✅ Video ready:", d),
    );
    socket.on("video_recording_error", (d) =>
      console.error("❌ Video error:", d),
    );
    socket.on("media_merge_complete", (d) =>
      console.log("✅ Merge complete:", d.finalVideoUrl),
    );

    socket.on("evaluation_started", () => {
      console.log("📊 Evaluation started");
      setEvaluationStatus("started");
    });

    socket.on("evaluation_complete", (d) => {
      console.log("✅ Evaluation complete:", d);
      setEvaluationStatus("complete");
      setEvaluationResults(d.results);
      interview.setMicStreamingActive(false);
    });

    socket.on("evaluation_error", (d) => {
      console.error("❌ Evaluation error:", d);
      setEvaluationStatus("error");
      alert(`Evaluation failed: ${d.message}`);
    });

    socket.on("next_question", (d) => {
      console.log("➡️ Next question:", d.question);
      interview.handleNextQuestion(d);
    });

    socket.on("idle_prompt", (d) => {
      console.log("💤 Idle prompt:", d.text);
      interview.handleIdlePrompt(d);
    });

    socket.on("transcript_received", (d) => {
      console.log("✅ Transcript received:", d.text);
      interview.handleTranscriptReceived(d);
    });

    socket.on("listening_enabled", () => {
      console.log("🎤 Listening enabled");
      interview.enableListening();
    });

    socket.on("listening_disabled", () => {
      console.log("🎤 Listening disabled");
      interview.disableListening();
    });

    socket.on("interview_complete", async (d) => {
      console.log("✅ Interview complete:", d);
      interview.handleInterviewComplete(d);
      await cleanupAllRecordings();
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Connection error:", err.message);
      interview.setStatus("error");
      interview.setIsInitializing(false);
    });

    socket.on("disconnect", (reason) => {
      console.log("🔌 Disconnected:", reason);
      interview.setStatus("disconnected");
      interview.setMicStreamingActive(false);
    });

    socket.on("error", (error) => {
      console.error("❌ Socket error:", error);
      interview.setStatus("error");
    });

    // ✅ Initialize interview
    console.log("🎬 Initializing interview session");
    interview.initializeInterview({
      interviewId: sessionData.interviewId,
      userId: sessionData.userId,
      sessionId: sessionData.interviewId,
    });

    return () => {
      (async () => {
        console.log("🧹 Component unmounting - cleaning up");
        await cleanupAllRecordings();
        socket.offAny();
        socket.removeAllListeners();
        socket.disconnect();
      })();
    };
  }, [sessionData?.interviewId, sessionData?.userId, preInitializedSocket]);

  // ✅ START MEDIA STREAMING
  useEffect(() => {
    if (recordingsStartedRef.current) {
      console.log("⏭️ Recordings already started, skipping");
      return;
    }

    const shouldStart =
      interview.status === "live" &&
      !interview.isInitializing &&
      interview.serverReady &&
      interview.hasStarted &&
      primaryCameraStream &&
      micStream &&
      !isVideoRecording;

    if (!shouldStart) return;

    recordingsStartedRef.current = true;

    (async () => {
      try {
        console.log("🎬 Starting media streaming");

        await audioRecording.startRecording();
        console.log("✓ Audio streaming started");

        await startVideoRecording();
        console.log("✓ Primary camera streaming started");

        if (screenShareStream) {
          screenRecording.startRecording(screenShareStream);
          console.log("✓ Screen streaming started");
        }

        console.log("✅ All media streaming active");
      } catch (err) {
        console.error("❌ Failed to start media streaming:", err);
        recordingsStartedRef.current = false;
      }
    })();
  }, [
    interview.status,
    interview.isInitializing,
    interview.serverReady,
    interview.hasStarted,
    primaryCameraStream,
    micStream,
    screenShareStream,
    isVideoRecording,
  ]);

  // Auto-finish when evaluation complete
  useEffect(() => {
    if (evaluationStatus === "complete" && evaluationResults) {
      alert(
        `Interview completed!\n\nScore: ${evaluationResults.overallScore}%\nDecision: ${evaluationResults.hireDecision}\nLevel: ${evaluationResults.experienceLevel}`,
      );
      navigate("/dashboard");
    }
  }, [evaluationStatus, evaluationResults, navigate]);

  // Cleanup streams when component unmounts (NOT on navigation)
  useEffect(() => {
    return () => {
      console.log("🧹 Component unmounting - preserving streams in context");
    };
  }, []);

  // MIC logs for debugging
  useEffect(() => {
    const interval = setInterval(() => {
      if (interview.socketRef.current) {
        console.log("🎤 Microphone State:", {
          micStreamingActive: interview.micStreamingActive,
          isListening: interview.isListening,
          canListen: interview.canListen,
          socketConnected: interview.socketRef.current.connected,
          hasStarted: interview.hasStarted,
          serverReady: interview.serverReady,
        });
      }
    }, 5000); // Log every 5 seconds

    return () => clearInterval(interval);
  }, [interview]);

  const secondaryIsActive =
    secondaryCamera.isRecording || mobileCameraConnected;

  const Badge = ({ label, active, color }) => (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        active
          ? `bg-${color}-100 dark:bg-${color}-900/30 text-${color}-700 dark:text-${color}-300`
          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full ${active ? `bg-${color}-500 animate-pulse` : "bg-gray-500"}`}
      />
      {label}
    </div>
  );

  const handleEndInterview = async () => {
    if (confirm("Are you sure you want to end the interview?")) {
      await cleanupAllRecordings();
      navigate("/dashboard");
    }
  };

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full mx-auto mb-4" />
          <p className="text-white">Loading interview...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2">
            <Card className="flex flex-col overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-linear-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-lg ${
                      interview.isPlaying
                        ? "bg-linear-to-br from-blue-500 to-blue-600"
                        : interview.isListening
                          ? "bg-linear-to-br from-emerald-500 to-emerald-600"
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
                      AI Interview
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
                  <Badge label="Camera" active={isVideoRecording} color="red" />
                  <Badge
                    label="Mobile"
                    active={secondaryIsActive}
                    color="orange"
                  />
                  <Badge
                    label="Screen"
                    active={screenRecording.isRecording}
                    color="purple"
                  />
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
                        {faceViolationWarning.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 p-6 bg-white dark:bg-gray-800 min-h-96">
                {evaluationStatus === "started" && (
                  <div className="mb-4 p-4 bg-blue-50 dark:from-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
                      <div>
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-300">
                          Evaluating Your Interview
                        </p>
                        <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                          Please wait...
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {interview.status === "live" && interview.currentQuestion && (
                  <div className="flex flex-col justify-center space-y-6 h-full">
                    {interview.idlePrompt && (
                      <div className="p-4 bg-amber-50 dark:from-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          {interview.idlePrompt}
                        </p>
                      </div>
                    )}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                          <span className="text-sm font-bold text-white">
                            Q
                          </span>
                        </div>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase">
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
                          Listening...
                        </span>
                      </div>
                    )}
                    {interview.liveTranscript && (
                      <div className="p-4 bg-gray-50 dark:from-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                        <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                          {interview.liveTranscript}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!interview.isInitializing && interview.userText && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-emerald-50 dark:from-gray-800">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg">
                        <span className="text-sm font-bold text-white">A</span>
                      </div>
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase">
                        Your Answer
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 pl-11">
                      {interview.userText}
                    </p>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-medium">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    Interview active • {interview.recordingDuration}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={handleEndInterview}
                    className="text-sm px-5 py-2 font-semibold"
                  >
                    End Interview
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-4">
            {/* Primary Camera Card */}
            <Card className="overflow-hidden shadow-lg">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:from-gray-800">
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
                </div>
              </div>
              <div className="p-3">
                <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  <div className="absolute top-3 left-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg">
                      <div
                        className={`w-2 h-2 rounded-full ${isVideoRecording ? "bg-red-500 animate-pulse" : "bg-gray-500"}`}
                      />
                      <span className="text-xs font-bold text-white">
                        {isVideoRecording ? "REC" : "STANDBY"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Mobile Camera Card */}
            <Card className="overflow-hidden shadow-lg">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-orange-50 dark:from-orange-900/20">
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
                    className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                      secondaryIsActive
                        ? "text-orange-700 bg-orange-100"
                        : "text-gray-500 bg-gray-100"
                    }`}
                  >
                    {secondaryIsActive ? "CONNECTED" : "WAITING"}
                  </span>
                </div>
              </div>
              <div className="p-3">
                <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden">
                  <canvas
                    ref={secondaryCanvasRef}
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  {!mobileCameraConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                      <div className="animate-spin w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg">
                      <div
                        className={`w-2 h-2 rounded-full ${secondaryIsActive ? "bg-orange-500 animate-pulse" : "bg-gray-500"}`}
                      />
                      <span className="text-xs font-bold text-white">
                        {secondaryIsActive ? "LIVE" : "OFFLINE"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Screen Recording Card */}
            <Card className="overflow-hidden shadow-lg">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:from-gray-800">
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
                      Screen
                    </h3>
                  </div>
                  {screenRecording.isRecording && (
                    <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded-lg">
                      LIVE
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3">
                <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden">
                  <video
                    ref={screenVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-3 left-3">
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
              <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-6">
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
                Your interview has been terminated.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default InterviewLive;
