import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import useSecondaryCamera from "../Hooks/useSecondaryCameraHook";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

const MobileCameraPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("interviewId");
  const userId = searchParams.get("userId");

  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const frameIntervalRef = useRef(null);

  //  1 (CRITICAL): Use a REF to control the rAF loop, NOT state.
  // React state captured in a requestAnimationFrame closure is stale — it
  // freezes at the value from when the closure was created (false).
  // A ref is mutable and always reflects the current value.
  const isStreamingRef = useRef(false);

  //  2 (CRITICAL): Also guard startFrameStreaming with a ref so the
  // "already started" check works correctly (state would always read false).
  const streamingStartedRef = useRef(false);

  const secondaryCamera = useSecondaryCamera(sessionId, userId, socketRef);

  useEffect(() => {
    if (!sessionId || !userId) {
      setError("Invalid mobile camera link. Please scan the QR code again.");
      return;
    }

    console.log("Mobile secondary camera initializing:", { sessionId, userId });

    const socket = io(SOCKET_URL, {
      query: { interviewId: sessionId, userId },
      transports: ["websocket", "polling"],
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Mobile socket connected:", socket.id);
      setIsConnected(true);
    });

    socket.on("connect_error", (err) => {
      console.error("Mobile socket connection error:", err);
      setError(
        "Failed to connect to server. Please check your internet connection.",
      );
    });

    socket.on("disconnect", (reason) => {
      console.log("Mobile socket disconnected:", reason);
      setIsConnected(false);
      setIsStreaming(false);
      // Keep isStreamingRef true on temporary disconnect so loop stays alive
      // for reconnection. Loop already guards with socketRef.current?.connected.
    });

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      isStreamingRef.current = false;
      streamingStartedRef.current = false;
      socket.disconnect();
    };
  }, [sessionId, userId]);

  const startFrameStreaming = (stream) => {
    if (!canvasRef.current || !videoRef.current || !socketRef.current) {
      console.error("Cannot start streaming - missing required references");
      return;
    }

    //  2: Guard with REF not state (state is always stale false here)
    if (streamingStartedRef.current) {
      console.log("Streaming already active, skipping");
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = 640;
    canvas.height = 480;

    console.log("Starting frame streaming to desktop");

    //  1: Set REF true BEFORE starting the loop so the closure reads true
    isStreamingRef.current = true;
    streamingStartedRef.current = true;
    setIsStreaming(true); // UI display only

    let frameCount = 0;
    let lastFrameTime = 0;
    const FRAME_INTERVAL = 100; // 10 FPS

    const captureFrame = () => {
      //  1: Read from REF — always gets current value, never stale
      if (!isStreamingRef.current) {
        console.log("Streaming stopped (ref=false), ending rAF loop");
        return;
      }

      // Keep loop alive during temporary disconnects; frames will resume on reconnect
      if (!socketRef.current?.connected) {
        requestAnimationFrame(captureFrame);
        return;
      }

      const now = Date.now();
      if (now - lastFrameTime < FRAME_INTERVAL) {
        requestAnimationFrame(captureFrame);
        return;
      }

      lastFrameTime = now;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(
            (blob) => {
              if (
                blob &&
                socketRef.current?.connected &&
                isStreamingRef.current
              ) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  if (!isStreamingRef.current) return;
                  // ED: Changed event name from "mobile_camera_frame" to "security_frame_request"
                  socketRef.current.emit(
                    "security_frame_request",
                    {
                      frame: reader.result,
                      interviewId: sessionId,
                      userId,
                      timestamp: Date.now(),
                    },
                    () => {
                      // ACK callback - confirms server received the frame
                      frameCount++;
                      if (frameCount % 50 === 0) {
                        console.log(
                          `Sent ${frameCount} frames to desktop (ACK received)`,
                        );
                      }
                    },
                  );
                };
                reader.readAsDataURL(blob);
              }
            },
            "image/jpeg",
            0.7,
          );
        } catch (err) {
          console.error("Error capturing frame:", err);
        }
      }

      requestAnimationFrame(captureFrame);
    };

    requestAnimationFrame(captureFrame);
    console.log("Frame streaming active: 10 FPS at 640x480");
  };

  const stopFrameStreaming = () => {
    // Setting ref false stops the rAF loop cleanly on next tick
    isStreamingRef.current = false;
    streamingStartedRef.current = false;
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setIsStreaming(false);
    console.log("Stopped frame streaming");
  };

  useEffect(() => {
    if (!isConnected || cameraGranted) return;

    const requestCamera = async () => {
      try {
        console.log("Step 1: Requesting front camera access");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        console.log("Step 1 Complete: Camera access granted");
        setCameraGranted(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          console.log("Video element is now playing");
        }

        await new Promise((resolve) => setTimeout(resolve, 500));

        console.log("Step 2: Notifying server of mobile camera connection");
        socketRef.current.emit("secondary_camera_connected", {
          interviewId: sessionId,
          userId,
          timestamp: Date.now(),
        });
        console.log("Step 2 Complete: Server notified");

        console.log("Step 3: Starting frame streaming to desktop");
        startFrameStreaming(stream);
        console.log("Step 3 Complete: Frame streaming started");

        console.log("Step 4: Requesting video recording session");
        socketRef.current.emit("video_recording_start", {
          videoType: "secondary_camera",
          totalChunks: 0,
          metadata: {
            mimeType: "video/webm;codecs=vp9",
            videoBitsPerSecond: 2500000,
          },
          interviewId: sessionId,
          userId,
        });

        try {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              socketRef.current.off("video_recording_ready", handler);
              socketRef.current.off("video_recording_error", errorHandler);
              reject(
                new Error("Server timeout - no video session confirmation"),
              );
            }, 10000);

            const handler = (data) => {
              if (data.videoType === "secondary_camera") {
                clearTimeout(timeout);
                socketRef.current.off("video_recording_error", errorHandler);
                console.log(
                  "Step 4 Complete: Server confirmed video session:",
                  data,
                );
                resolve(data);
              }
            };

            const errorHandler = (error) => {
              if (error.videoType === "secondary_camera") {
                clearTimeout(timeout);
                socketRef.current.off("video_recording_ready", handler);
                console.error("Server error:", error);
                reject(new Error(error.error || "Server error"));
              }
            };

            socketRef.current.on("video_recording_ready", handler);
            socketRef.current.on("video_recording_error", errorHandler);
          });

          console.log("Step 5: Starting video recording");
          await secondaryCamera.startRecording();
          console.log("Step 5 Complete: Video recording started");
        } catch (serverError) {
          console.error("Server confirmation failed:", serverError);
          console.log("Continuing frame streaming without recording");
        }
      } catch (err) {
        console.error("Camera error:", err);
        let errorMessage = "Unable to access front camera. ";
        if (err.name === "NotAllowedError") {
          errorMessage += "Please grant camera permission and refresh.";
        } else if (err.name === "NotFoundError") {
          errorMessage += "No front camera found.";
        } else if (err.name === "NotReadableError") {
          errorMessage += "Camera in use by another app.";
        } else {
          errorMessage += err.message;
        }
        setError(errorMessage);
      }
    };

    requestCamera();
  }, [isConnected, cameraGranted, sessionId, userId]);

  useEffect(() => {
    return () => {
      stopFrameStreaming();
      if (secondaryCamera.isRecording) {
        secondaryCamera.stopRecording();
      }
      secondaryCamera.cleanup();
    };
  }, []);

  if (!sessionId || !userId) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md text-center shadow-2xl">
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Invalid Link
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This page must be accessed by scanning the QR code from your desktop
            interview session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 to-gray-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-linear-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-4 shadow-xl">
            <svg
              className="w-8 h-8 text-white"
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
          <h1 className="text-2xl font-bold text-white mb-2">
            Secondary Camera
          </h1>
          <p className="text-gray-300 text-sm">
            Keep this page open during your interview
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border-2 border-red-500 rounded-xl p-6 text-center">
            <svg
              className="w-12 h-12 text-red-500 mx-auto mb-3"
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
            <p className="text-red-300 text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-gray-700">
          <div className="bg-linear-to-r from-orange-600 to-red-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {secondaryCamera.isRecording ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                    <span className="text-white font-bold text-sm">
                      RECORDING
                    </span>
                  </>
                ) : isStreaming ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-green-300 animate-pulse" />
                    <span className="text-white font-bold text-sm">
                      STREAMING
                    </span>
                  </>
                ) : isConnected ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-yellow-300 animate-pulse" />
                    <span className="text-white font-bold text-sm">
                      CONNECTED
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                    <span className="text-white font-bold text-sm">
                      CONNECTING...
                    </span>
                  </>
                )}
              </div>
              {isConnected && (
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
                    d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                  />
                </svg>
              )}
            </div>
          </div>

          <div className="relative aspect-9/16 bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            <canvas ref={canvasRef} className="hidden" />

            {!isStreaming && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                <div className="animate-spin w-12 h-12 border-4 border-gray-600 border-t-orange-500 rounded-full mb-4" />
                <p className="text-white text-sm font-medium">
                  {!isConnected ? "Connecting..." : "Initializing camera..."}
                </p>
              </div>
            )}

            {secondaryCamera.isRecording && (
              <div className="absolute top-4 left-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-red-600/90 backdrop-blur-sm rounded-lg shadow-xl">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-xs font-bold">REC</span>
                </div>
              </div>
            )}

            {isStreaming && (
              <div className="absolute top-4 right-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-green-600/90 backdrop-blur-sm rounded-lg shadow-xl">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-xs font-bold">LIVE</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-750 px-6 py-4 border-t border-gray-700">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-blue-400 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-gray-300">
                <p className="font-semibold mb-1">Status:</p>
                <ul className="space-y-1 text-xs text-gray-400">
                  <li>
                    Connection:{" "}
                    {isConnected ? "Connected to server" : "Not connected"}
                  </li>
                  <li>
                    Camera:{" "}
                    {cameraGranted ? "Access granted" : "Requesting access..."}
                  </li>
                  <li>
                    Streaming:{" "}
                    {isStreaming
                      ? "Streaming to desktop"
                      : "Waiting to stream..."}
                  </li>
                  <li>
                    Recording:{" "}
                    {secondaryCamera.isRecording
                      ? "Recording active"
                      : "Waiting to record..."}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileCameraPage;
