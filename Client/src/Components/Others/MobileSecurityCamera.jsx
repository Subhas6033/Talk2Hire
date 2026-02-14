import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import { Card } from "../Common/Card";
import { Button } from "../index";

const SOCKET_URL = import.meta.env.VITE_WS_URL;
const FRAME_SEND_INTERVAL = 1000;

const MobileSecurityCamera = () => {
  const [searchParams] = useSearchParams();
  const interviewId = searchParams.get("interviewId");
  const userId = searchParams.get("userId");

  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const connectionWaitIntervalRef = useRef(null); // ✅ ADDED

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const chunkCountRef = useRef(0);
  const frameSendIntervalRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [chunksSent, setChunksSent] = useState(0);
  const [framesSent, setFramesSent] = useState(0);

  const [debugInfo, setDebugInfo] = useState({
    streamObtained: false,
    metadataLoaded: false,
    playAttempted: false,
    playSucceeded: false,
    recordingStarted: false,
  });

  useEffect(() => {
    if (!interviewId || !userId) {
      setError("Invalid interview session. Please scan the QR code again.");
      return;
    }

    const socket = io(SOCKET_URL, {
      query: { interviewId, userId, type: "security_camera" },
      transports: ["websocket", "polling"],
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: false,
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Security camera connected to server, ID:", socket.id);
      setIsConnected(true);
      setError(null);

      if (videoReady) {
        emitConnectionEvent();
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("⚠️ Security camera disconnected, reason:", reason);
      setIsConnected(false);

      if (reason === "io server disconnect") {
        localStorage.removeItem(`security_${interviewId}`);
        localStorage.removeItem(`security_angle_verified_${interviewId}`);
      }
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err);
      setError(`Connection error: ${err.message}. Retrying...`);
      setIsConnected(false);
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      setError(null);

      if (videoReady) {
        emitConnectionEvent();
      }
    });

    socket.on("video_recording_ready", (response) => {
      console.log("✅ Server ready for video chunks:", response);
    });

    socket.on("video_chunk_uploaded", (data) => {
      if (data.chunkNumber % 5 === 0) {
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

    socket.connect();

    return () => {
      // ✅ ADDED: Clear interval on unmount
      if (connectionWaitIntervalRef.current) {
        clearInterval(connectionWaitIntervalRef.current);
        connectionWaitIntervalRef.current = null;
      }
      stopVideoRecording();
      stopFrameSending();
      socket.disconnect();
      localStorage.removeItem(`security_${interviewId}`);
      localStorage.removeItem(`security_angle_verified_${interviewId}`);
    };
  }, [interviewId, userId]);

  const emitConnectionEvent = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("secondary_camera_connected", {
        interviewId,
        userId,
        timestamp: Date.now(),
      });
    }
  };

  useEffect(() => {
    if (videoReady && isConnected) {
      localStorage.setItem(`security_${interviewId}`, "connected");
      localStorage.setItem(`security_angle_verified_${interviewId}`, "true");
      emitConnectionEvent();
    }
  }, [videoReady, isConnected, interviewId]);

  useEffect(() => {
    if (interviewId && userId && !isStreaming && !streamRef.current) {
      const timer = setTimeout(() => {
        startCamera();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [interviewId, userId, isStreaming]);

  const startCamera = async () => {
    if (streamRef.current || isStreaming) {
      console.log("⚠️ Camera already started, skipping...");
      return;
    }

    try {
      console.log("📱 Requesting camera access...");
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setDebugInfo((prev) => ({ ...prev, streamObtained: true }));

      if (!videoRef.current) {
        console.error("❌ Video ref is null!");
        setError("Video element not found");
        return;
      }

      videoRef.current.srcObject = stream;

      videoRef.current.onloadedmetadata = async () => {
        setDebugInfo((prev) => ({ ...prev, metadataLoaded: true }));
        setDebugInfo((prev) => ({ ...prev, playAttempted: true }));

        try {
          await videoRef.current.play();
          setDebugInfo((prev) => ({ ...prev, playSucceeded: true }));
          setError(null);
          setVideoReady(true);
          setIsStreaming(true);

          setTimeout(() => {
            startVideoRecording();
            startFrameSending();
          }, 1000);
        } catch (err) {
          console.error("❌ Video play FAILED:", err.name, err.message);

          if (err.name === "NotAllowedError") {
            setError("⚠️ TAP THE SCREEN to start video");

            const handleUserGesture = async () => {
              try {
                await videoRef.current.play();
                setDebugInfo((prev) => ({ ...prev, playSucceeded: true }));
                setError(null);
                setVideoReady(true);
                setIsStreaming(true);
                setTimeout(() => {
                  startVideoRecording();
                  startFrameSending();
                }, 1000);
              } catch (e) {
                console.error("❌ Play failed even after gesture:", e);
                setError("Failed to start video. Please refresh the page.");
              }
            };

            document.addEventListener("click", handleUserGesture, {
              once: true,
            });
            document.addEventListener("touchstart", handleUserGesture, {
              once: true,
            });
          } else {
            setError(`Video error: ${err.message}`);
          }
        }
      };

      videoRef.current.onplay = () => setVideoReady(true);
      videoRef.current.onplaying = () => setVideoReady(true);
      videoRef.current.onerror = (e) => {
        console.error("❌ Video element error:", e);
        setError("Video playback error");
        setVideoReady(false);
      };
    } catch (err) {
      console.error("❌ Camera access error:", err);
      let errorMessage = "Unable to access camera. ";
      if (err.name === "NotAllowedError") {
        errorMessage += "Please grant camera permissions.";
      } else if (err.name === "NotFoundError") {
        errorMessage += "No camera found.";
      } else if (err.name === "NotReadableError") {
        errorMessage += "Camera in use by another app.";
      } else {
        errorMessage += err.message;
      }
      setError(errorMessage);
      setIsStreaming(false);
      setVideoReady(false);
    }
  };

  const startFrameSending = () => {
    if (frameSendIntervalRef.current) {
      console.log("⚠️ Frame sending already active");
      return;
    }

    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;
    let isFramePending = false;

    frameSendIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !socketRef.current?.connected) return;
      if (isFramePending) return;

      try {
        const video = videoRef.current;
        const maxWidth = 640;
        const maxHeight = 480;
        const aspectRatio = video.videoWidth / video.videoHeight;

        if (aspectRatio > maxWidth / maxHeight) {
          canvas.width = maxWidth;
          canvas.height = maxWidth / aspectRatio;
        } else {
          canvas.height = maxHeight;
          canvas.width = maxHeight * aspectRatio;
        }

        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameData = canvas.toDataURL("image/jpeg", 0.5);

        isFramePending = true;

        socketRef.current.emit(
          "security_frame_request",
          {
            frame: frameData,
            timestamp: Date.now(),
          },
          () => {
            isFramePending = false;
          },
        );

        setFramesSent((prev) => prev + 1);
      } catch (error) {
        console.error("❌ Error capturing frame:", error);
        isFramePending = false;
      }
    }, FRAME_SEND_INTERVAL);
  };

  const stopFrameSending = () => {
    if (frameSendIntervalRef.current) {
      clearInterval(frameSendIntervalRef.current);
      frameSendIntervalRef.current = null;
    }
  };

  const startVideoRecording = () => {
    // ✅ FIXED: Clear any existing wait interval first
    if (connectionWaitIntervalRef.current) {
      clearInterval(connectionWaitIntervalRef.current);
      connectionWaitIntervalRef.current = null;
    }

    if (!streamRef.current) {
      console.error("❌ No stream available for recording");
      setError("No camera stream available");
      return;
    }

    if (mediaRecorderRef.current) {
      console.log("⚠️ MediaRecorder already exists");
      return;
    }

    if (!socketRef.current?.connected) {
      console.warn("⚠️ Socket not connected, waiting for connection...");

      const maxWaitTime = 10000;
      const startTime = Date.now();

      connectionWaitIntervalRef.current = setInterval(() => {
        if (socketRef.current?.connected) {
          clearInterval(connectionWaitIntervalRef.current);
          connectionWaitIntervalRef.current = null;
          console.log("✅ Socket connected, starting recording now");
          startVideoRecording();
        } else if (Date.now() - startTime > maxWaitTime) {
          clearInterval(connectionWaitIntervalRef.current);
          connectionWaitIntervalRef.current = null;
          console.error("❌ Socket connection timeout after 10s");
          setError("Failed to connect to server. Please refresh.");
        }
      }, 500);

      return;
    }

    try {
      console.log("🎥 Starting MediaRecorder for security camera...");

      const mimeTypes = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];

      let selectedMimeType = null;
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log(`✅ Using MIME type: ${mimeType}`);
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error("No supported video MIME type found");
      }

      console.log("📤 Requesting video session from server...");

      // ✅ IMPROVED: Set a flag to track if we're waiting for server response
      let serverResponseReceived = false;

      socketRef.current.emit("video_recording_start", {
        videoType: "secondary_camera",
        totalChunks: 0,
        metadata: {
          width: videoRef.current?.videoWidth || 1280,
          height: videoRef.current?.videoHeight || 720,
          codec: selectedMimeType,
        },
      });

      const readyListener = (response) => {
        if (response.videoType !== "secondary_camera") return;

        serverResponseReceived = true;
        console.log("✅ Server ready for security camera chunks:", response);

        const options = {
          mimeType: selectedMimeType,
          videoBitsPerSecond: 2500000,
        };

        const mediaRecorder = new MediaRecorder(streamRef.current, options);
        mediaRecorderRef.current = mediaRecorder;
        recordedChunksRef.current = [];
        chunkCountRef.current = 0;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunkCountRef.current++;
            recordedChunksRef.current.push(event.data);

            console.log(
              `📦 Security chunk ${chunkCountRef.current} captured (${event.data.size} bytes)`,
            );

            const reader = new FileReader();
            reader.onloadend = () => {
              if (socketRef.current?.connected) {
                const base64data = reader.result.split(",")[1];

                socketRef.current.emit("video_chunk", {
                  videoType: "secondary_camera",
                  chunkNumber: chunkCountRef.current,
                  chunkData: base64data,
                  isLastChunk: false,
                  timestamp: Date.now(),
                });

                setChunksSent(chunkCountRef.current);

                if (chunkCountRef.current % 5 === 0) {
                  console.log(
                    `📤 Security chunks sent: ${chunkCountRef.current}`,
                  );
                }
              }
            };
            reader.readAsDataURL(event.data);
          }
        };

        mediaRecorder.onerror = (error) => {
          console.error("❌ MediaRecorder error:", error);
          setError("Video recording failed: " + error.message);
        };

        mediaRecorder.onstop = () => {
          console.log(
            `🛑 MediaRecorder stopped. Total chunks: ${chunkCountRef.current}`,
          );
          setIsRecording(false);
          setDebugInfo((prev) => ({ ...prev, recordingStarted: false }));

          if (socketRef.current?.connected) {
            socketRef.current.emit("video_recording_stop", {
              videoType: "secondary_camera",
              totalChunks: chunkCountRef.current,
            });
          }
        };

        mediaRecorder.onstart = () => {
          console.log("▶️ MediaRecorder started");
          setIsRecording(true);
          setDebugInfo((prev) => ({ ...prev, recordingStarted: true }));
        };

        socketRef.current.off("disconnect");
        socketRef.current.off("reconnect");

        socketRef.current.on("disconnect", () => {
          console.warn("🔌 Socket disconnected — pausing recorder");
          if (mediaRecorder.state === "recording") {
            mediaRecorder.pause();
          }
        });

        socketRef.current.on("reconnect", () => {
          console.log("🔄 Socket reconnected — resuming recorder");
          if (mediaRecorder.state === "paused") {
            mediaRecorder.resume();
          }
        });

        mediaRecorder.start(2000);
        console.log("✅ MediaRecorder started (2s chunks)");

        socketRef.current.off("video_recording_ready", readyListener);
      };

      socketRef.current.on("video_recording_ready", readyListener);

      // ✅ IMPROVED: Reduce timeout and add better error handling
      setTimeout(() => {
        if (!serverResponseReceived && !mediaRecorderRef.current) {
          console.error("❌ Server didn't confirm video session within 5s");
          socketRef.current.off("video_recording_ready", readyListener);

          // ✅ ADDED: Try to start recording anyway if we have a stream
          console.log(
            "⚠️ Attempting to start recording without server confirmation",
          );

          const options = {
            mimeType: selectedMimeType,
            videoBitsPerSecond: 2500000,
          };

          try {
            const mediaRecorder = new MediaRecorder(streamRef.current, options);
            mediaRecorderRef.current = mediaRecorder;
            recordedChunksRef.current = [];
            chunkCountRef.current = 0;

            // Set up minimal handlers
            mediaRecorder.ondataavailable = (event) => {
              if (event.data && event.data.size > 0) {
                chunkCountRef.current++;
                console.log(
                  `📦 Chunk ${chunkCountRef.current} (fallback mode)`,
                );
              }
            };

            mediaRecorder.onstart = () => {
              console.log("▶️ MediaRecorder started (fallback mode)");
              setIsRecording(true);
              setDebugInfo((prev) => ({ ...prev, recordingStarted: true }));
            };

            mediaRecorder.start(2000);
            setError(null); // Clear any previous errors
          } catch (fallbackError) {
            console.error("❌ Fallback recording failed:", fallbackError);
            setError("Failed to start recording. Please refresh the page.");
          }
        }
      }, 5000); // Reduced from 10s to 5s
    } catch (error) {
      console.error("❌ Failed to start MediaRecorder:", error);
      setError("Failed to start video recording: " + error.message);
    }
  };

  const stopVideoRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error("❌ Error stopping MediaRecorder:", error);
      }
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    chunkCountRef.current = 0;
  };

  const stopCamera = () => {
    stopVideoRecording();
    stopFrameSending();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    localStorage.removeItem(`security_${interviewId}`);
    localStorage.removeItem(`security_angle_verified_${interviewId}`);

    if (socketRef.current?.connected) {
      socketRef.current.emit("secondary_camera_disconnected", {
        interviewId,
        userId,
        timestamp: Date.now(),
      });
    }

    setIsStreaming(false);
    setVideoReady(false);
    setIsRecording(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isStreaming) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isStreaming]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200">
          <h3 className="text-sm font-bold text-blue-900 mb-2">Debug Info</h3>
          <div className="text-xs text-blue-800 space-y-1 font-mono">
            <div>Stream: {debugInfo.streamObtained ? "✅" : "❌"}</div>
            <div>Metadata: {debugInfo.metadataLoaded ? "✅" : "❌"}</div>
            <div>Play Attempted: {debugInfo.playAttempted ? "✅" : "❌"}</div>
            <div>Play Succeeded: {debugInfo.playSucceeded ? "✅" : "❌"}</div>
            <div>Video Ready: {videoReady ? "✅" : "❌"}</div>
            <div>Is Streaming: {isStreaming ? "✅" : "❌"}</div>
            <div>Recording: {isRecording ? "✅" : "❌"}</div>
            <div>Socket Connected: {isConnected ? "✅" : "❌"}</div>
            <div>Chunks Sent: {chunksSent}</div>
            <div>Frames Sent: {framesSent}</div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
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
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Security Camera
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {videoReady && isRecording
                  ? "Recording active"
                  : videoReady
                    ? "Ready"
                    : "Initializing..."}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500 animate-pulse"}`}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Server: {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isRecording
                      ? "bg-red-500 animate-pulse"
                      : videoReady
                        ? "bg-green-500"
                        : "bg-gray-400"
                  }`}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Camera:{" "}
                  {isRecording
                    ? "Recording"
                    : videoReady
                      ? "Ready"
                      : "Inactive"}
                </span>
              </div>
              {chunksSent > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Chunks: {chunksSent}
                </span>
              )}
            </div>
          </div>
        </Card>

        {error && (
          <Card className="p-4 bg-red-50 dark:bg-red-950/30 border-2 border-red-500">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-red-600 shrink-0"
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
                <p className="text-sm font-bold text-red-900">{error}</p>
                {error.includes("TAP") && (
                  <p className="text-xs text-red-700 mt-1">
                    Your browser blocked autoplay. Please tap anywhere on the
                    screen.
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="relative aspect-video bg-gray-900">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />

            {videoReady && (
              <>
                <div className="absolute top-4 left-4">
                  <div className="flex items-center gap-2 px-3 py-2 bg-black/80 backdrop-blur-sm rounded-md">
                    <div
                      className={`w-3 h-3 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-gray-500"}`}
                    />
                    <span className="text-sm font-medium text-white">
                      {isRecording ? "RECORDING" : "STANDBY"}
                    </span>
                  </div>
                </div>

                <div className="absolute top-4 right-4">
                  <div
                    className={`flex items-center gap-2 px-3 py-2 backdrop-blur-sm rounded-md ${
                      isConnected ? "bg-green-600/90" : "bg-red-600/90"
                    }`}
                  >
                    <span className="text-xs font-medium text-white">
                      {isConnected ? "CONNECTED" : "DISCONNECTED"}
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-4 left-4 space-y-1">
                  <div className="px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-md">
                    <span className="text-xs font-mono text-white">
                      Chunks: {chunksSent}
                    </span>
                  </div>
                  <div className="px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-md">
                    <span className="text-xs font-mono text-white">
                      Frames: {framesSent}
                    </span>
                  </div>
                </div>
              </>
            )}

            {!videoReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center">
                  <div className="animate-spin w-12 h-12 border-4 border-gray-600 border-t-blue-500 rounded-full mx-auto mb-4" />
                  <p className="text-sm text-white">
                    {debugInfo.streamObtained
                      ? debugInfo.playAttempted
                        ? "Waiting for video play..."
                        : "Loading video..."
                      : "Accessing camera..."}
                  </p>
                  {error?.includes("TAP") && (
                    <p className="text-xs text-yellow-400 mt-2 animate-pulse">
                      👆 TAP SCREEN TO START
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {videoReady && (
          <>
            <Button onClick={stopCamera} variant="secondary" className="w-full">
              Stop Monitoring (Ends Interview)
            </Button>

            <Card className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-500">
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-green-600 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-green-900">
                    ✅ Security Camera {isRecording ? "Recording" : "Ready"}!
                  </p>
                  <p className="text-xs text-green-800 mt-1">
                    Return to your laptop. Keep this page open. Sending{" "}
                    {framesSent} frames for display.
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}

        <Card className="p-4 bg-amber-50 border border-amber-200">
          <div className="flex gap-2">
            <svg
              className="w-5 h-5 text-amber-600 shrink-0"
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
            <p className="text-xs text-amber-800">
              <strong>WARNING:</strong> Do not close this page or lock your
              phone during the interview.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MobileSecurityCamera;
