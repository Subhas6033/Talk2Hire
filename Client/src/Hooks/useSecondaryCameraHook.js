import { useRef, useState, useCallback, useEffect } from "react";

const CHUNK_DURATION = 20000;
const ZOOM_LEVEL = 0.5; // <1 = wider view, >1 = zoom in

const useSecondaryCamera = (interviewId, userId, socketRef) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [secondaryCameraStream, setSecondaryCameraStream] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunkCountRef = useRef(0);
  const secondarySessionReadyRef = useRef(false);
  const isRequestingSessionRef = useRef(false);
  const hasStoppedRef = useRef(false);
  const secondaryStreamRef = useRef(null);

  // Canvas zoom refs
  const hiddenVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const rawStreamRef = useRef(null); // the real camera stream (to stop tracks on cleanup)

  const findSupportedMimeType = (stream) => {
    const mimeTypesToTry = [
      { type: "video/webm;codecs=vp9", bitrate: 2500000 },
      { type: "video/webm;codecs=vp8", bitrate: 2500000 },
      { type: "video/webm;codecs=h264", bitrate: 2500000 },
      { type: "video/webm", bitrate: 2500000 },
      { type: "video/webm", bitrate: 1500000 },
      { type: "video/mp4", bitrate: 2500000 },
      { type: "", bitrate: 1000000 },
    ];

    for (const config of mimeTypesToTry) {
      const { type: mimeType, bitrate } = config;
      if (mimeType && !MediaRecorder.isTypeSupported(mimeType)) continue;
      try {
        const options = {};
        if (mimeType) options.mimeType = mimeType;
        if (bitrate) options.videoBitsPerSecond = bitrate;
        const testRecorder = new MediaRecorder(stream, options);
        if (testRecorder.state !== "inactive") testRecorder.stop();
        console.log(
          `Secondary camera MIME type: ${mimeType || "default"} @ ${bitrate}bps`,
        );
        return { mimeType: mimeType || "default", bitrate, options };
      } catch {
        continue;
      }
    }
    return null;
  };

  /**
   * Stops the canvas draw loop and cleans up canvas/hidden video resources.
   * Does NOT stop the raw camera stream — call stopRawStream() for that.
   */
  const stopCanvasPipeline = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.srcObject = null;
      hiddenVideoRef.current = null;
    }
    canvasRef.current = null;
  }, []);

  /**
   * Stops the raw camera tracks.
   */
  const stopRawStream = useCallback(() => {
    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((t) => t.stop());
      rawStreamRef.current = null;
    }
  }, []);

  /**
   * Creates a canvas stream that applies ZOOM_LEVEL to the raw camera stream.
   * Returns the canvas MediaStream (to be used for recording/preview).
   */
  const createZoomedCanvasStream = useCallback(async (rawStream) => {
    const hiddenVideo = document.createElement("video");
    hiddenVideo.srcObject = rawStream;
    hiddenVideo.playsInline = true;
    hiddenVideo.muted = true;
    hiddenVideoRef.current = hiddenVideo;

    await new Promise((resolve) => {
      hiddenVideo.onloadedmetadata = () => {
        hiddenVideo.play();
        resolve();
      };
    });

    const vw = hiddenVideo.videoWidth;
    const vh = hiddenVideo.videoHeight;

    const canvas = document.createElement("canvas");
    canvas.width = vw;
    canvas.height = vh;
    canvasRef.current = canvas;
    const ctx = canvas.getContext("2d");

    const drawFrame = () => {
      if (!hiddenVideoRef.current || !canvasRef.current) return;

      // ZOOM_LEVEL < 1 means crop > video size → clamped to full frame (wide/zoomed-out)
      // ZOOM_LEVEL > 1 means crop < video size → zoomed in
      const sw = Math.min(vw / ZOOM_LEVEL, vw);
      const sh = Math.min(vh / ZOOM_LEVEL, vh);
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;

      ctx.drawImage(hiddenVideo, sx, sy, sw, sh, 0, 0, vw, vh);
      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    // 30fps canvas stream — this is what gets recorded and previewed
    return canvas.captureStream(30);
  }, []);

  /**
   * Request secondary camera access and return a zoomed canvas stream.
   */
  const requestSecondaryCamera = useCallback(async () => {
    try {
      console.log("📱 Requesting secondary camera (mobile front)...");

      const rawStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 480 }, // ← request lower res
          height: { ideal: 640 },
          aspectRatio: { ideal: 4 / 3 },
        },
        audio: false,
      });

      rawStreamRef.current = rawStream;

      // Build zoomed canvas stream
      const canvasStream = await createZoomedCanvasStream(rawStream);

      console.log("✅ Secondary camera access granted (canvas zoom active)");
      secondaryStreamRef.current = canvasStream;
      setSecondaryCameraStream(canvasStream);
      setIsConnected(true);

      if (socketRef?.current?.connected) {
        socketRef.current.emit("secondary_camera_connected", {
          interviewId,
          userId,
          timestamp: Date.now(),
        });
      }

      return canvasStream;
    } catch (error) {
      console.error("❌ Secondary camera access error:", error);

      let errorMessage = "Unable to access front camera. ";
      if (error.name === "NotAllowedError") {
        errorMessage += "Please grant camera permissions.";
      } else if (error.name === "NotFoundError") {
        errorMessage += "No front camera found on this device.";
      } else if (error.name === "NotReadableError") {
        errorMessage += "Camera in use by another app.";
      } else {
        errorMessage += error.message;
      }

      alert(errorMessage);
      setIsConnected(false);
      return null;
    }
  }, [interviewId, userId, socketRef, createZoomedCanvasStream]);

  const startRecording = useCallback(async () => {
    if (isRecording) {
      console.log("⚠️ Secondary camera already recording");
      return;
    }

    if (!socketRef?.current?.connected) {
      console.error("❌ Socket not connected, retrying in 2s...");
      setTimeout(() => {
        if (socketRef?.current?.connected) startRecording();
      }, 2000);
      return;
    }

    if (isRequestingSessionRef.current) {
      console.log("⚠️ Already requesting secondary camera session");
      return;
    }

    try {
      console.log("📹 Starting secondary camera recording...");
      isRequestingSessionRef.current = true;
      hasStoppedRef.current = false;
      secondarySessionReadyRef.current = false;
      chunkCountRef.current = 0;

      let stream = secondaryStreamRef.current;
      if (!stream || !stream.active) {
        stream = await requestSecondaryCamera();
        if (!stream) {
          isRequestingSessionRef.current = false;
          return;
        }
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== "live") {
        console.error("❌ Secondary camera video track is not live");
        isRequestingSessionRef.current = false;
        return;
      }

      const mimeConfig = findSupportedMimeType(stream);
      if (!mimeConfig) {
        throw new Error(
          "No supported video MIME type found for secondary camera.",
        );
      }

      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, mimeConfig.options);
      } catch {
        try {
          mediaRecorder = new MediaRecorder(stream);
        } catch (finalError) {
          isRequestingSessionRef.current = false;
          alert(
            "Failed to initialize secondary camera recorder: " +
              finalError.message,
          );
          return;
        }
      }

      mediaRecorderRef.current = mediaRecorder;

      videoTrack.onended = () => {
        console.log("🛑 Secondary camera canvas track ended");
        if (mediaRecorderRef.current?.state !== "inactive") {
          stopRecording();
        }
      };

      mediaRecorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return;

        chunkCountRef.current++;
        const currentChunkNumber = chunkCountRef.current;

        const reader = new FileReader();
        reader.onloadend = () => {
          if (
            socketRef.current?.connected &&
            secondarySessionReadyRef.current
          ) {
            const base64Data = reader.result.split(",")[1];
            socketRef.current.emit("video_chunk", {
              videoType: "secondary_camera",
              chunkNumber: currentChunkNumber,
              chunkData: base64Data,
              isLastChunk: false,
              timestamp: Date.now(),
            });

            if (currentChunkNumber % 10 === 0) {
              console.log(
                `📤 Secondary camera chunk #${currentChunkNumber} sent`,
              );
            }
          }
        };
        reader.readAsDataURL(event.data);
        setRecordedChunks((prev) => [...prev, event.data]);
      };

      mediaRecorder.onstart = () => {
        console.log("✅ Secondary camera MediaRecorder started");
        setIsRecording(true);
      };

      mediaRecorder.onstop = () => {
        if (hasStoppedRef.current) return;
        hasStoppedRef.current = true;

        console.log(
          `🛑 Secondary camera recording stopped. Chunks: ${chunkCountRef.current}`,
        );
        setIsRecording(false);
        secondarySessionReadyRef.current = false;

        if (socketRef.current?.connected) {
          socketRef.current.emit("video_recording_stop", {
            videoType: "secondary_camera",
            totalChunks: chunkCountRef.current,
          });
        }

        // Stop canvas pipeline first, then raw camera
        stopCanvasPipeline();
        stopRawStream();

        const s = secondaryStreamRef.current;
        if (s) {
          s.getTracks().forEach((t) => t.stop());
          secondaryStreamRef.current = null;
          setSecondaryCameraStream(null);
          setIsConnected(false);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("❌ Secondary camera MediaRecorder error:", event.error);
        isRequestingSessionRef.current = false;
        setIsRecording(false);
      };

      console.log("📤 Requesting secondary camera session from server...");
      socketRef.current.emit("video_recording_start", {
        videoType: "secondary_camera",
        totalChunks: 0,
        metadata: {
          mimeType: mimeConfig.mimeType,
          videoBitsPerSecond: mimeConfig.bitrate,
        },
      });

      const serverResponsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          socketRef.current.off("video_recording_ready", handler);
          socketRef.current.off("video_recording_error", errorHandler);
          reject(
            new Error(
              "Server timeout waiting for secondary camera confirmation",
            ),
          );
        }, 10000);

        const handler = (response) => {
          if (response.videoType !== "secondary_camera") return;
          clearTimeout(timeout);
          socketRef.current.off("video_recording_error", errorHandler);
          console.log("✅ Server confirmed secondary camera ready:", response);
          resolve(response);
        };

        const errorHandler = (error) => {
          if (error.videoType !== "secondary_camera") return;
          clearTimeout(timeout);
          socketRef.current.off("video_recording_ready", handler);
          reject(new Error(error.error || error.message || "Server error"));
        };

        socketRef.current.on("video_recording_ready", handler);
        socketRef.current.on("video_recording_error", errorHandler);
      });

      await serverResponsePromise;
      console.log(
        "✅ Secondary camera session confirmed, starting MediaRecorder",
      );
      secondarySessionReadyRef.current = true;
      isRequestingSessionRef.current = false;
      mediaRecorder.start(CHUNK_DURATION);
    } catch (err) {
      console.error("❌ Secondary camera recording setup error:", err);
      isRequestingSessionRef.current = false;
      setIsRecording(false);
      alert("Failed to setup secondary camera recording: " + err.message);
    }
  }, [
    isRecording,
    socketRef,
    requestSecondaryCamera,
    stopCanvasPipeline,
    stopRawStream,
  ]);

  const stopRecording = useCallback(async () => {
    console.log("🛑 Attempting to stop secondary camera recording...");

    if (!mediaRecorderRef.current) {
      console.log("⚠️ No media recorder to stop");

      stopCanvasPipeline();
      stopRawStream();

      const s = secondaryStreamRef.current;
      if (s && s.active) {
        console.log("🧹 Cleaning up active stream");
        s.getTracks().forEach((t) => t.stop());
        secondaryStreamRef.current = null;
        setSecondaryCameraStream(null);
        setIsConnected(false);
      }

      return null;
    }

    if (mediaRecorderRef.current.state === "inactive") {
      console.log("⚠️ Recorder already inactive");
      return null;
    }

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;

      const originalStop = recorder.onstop;
      recorder.onstop = (e) => {
        if (originalStop) originalStop(e);
        mediaRecorderRef.current = null;
        resolve(chunkCountRef.current);
      };

      try {
        recorder.stop();
        console.log("✅ Stop command sent to secondary camera recorder");
      } catch (error) {
        console.error("❌ Error stopping recorder:", error);
        mediaRecorderRef.current = null;
        resolve(null);
      }
    });
  }, [stopCanvasPipeline, stopRawStream]);

  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up secondary camera");

    // Stop canvas pipeline and raw camera
    stopCanvasPipeline();
    stopRawStream();

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error("❌ Error during cleanup stop:", error);
      }
    }
    mediaRecorderRef.current = null;

    const s = secondaryStreamRef.current;
    if (s && s.active) {
      s.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (error) {
          console.error("❌ Error stopping track:", error);
        }
      });
      secondaryStreamRef.current = null;
      setSecondaryCameraStream(null);
      setIsConnected(false);
    }

    chunkCountRef.current = 0;
    secondarySessionReadyRef.current = false;
    isRequestingSessionRef.current = false;
    hasStoppedRef.current = false;
    setIsRecording(false);
  }, [stopCanvasPipeline, stopRawStream]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    isRecording,
    recordedChunks,
    secondaryCameraStream,
    isConnected,
    startRecording,
    stopRecording,
    requestSecondaryCamera,
    cleanup,
  };
};

export default useSecondaryCamera;
