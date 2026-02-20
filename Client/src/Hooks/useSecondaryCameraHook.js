import { useRef, useState, useCallback, useEffect } from "react";

const CHUNK_DURATION = 20000; // 20 seconds per chunk

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

  /**
   * Find supported MIME type for secondary camera
   */
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
          ` Secondary camera MIME type: ${mimeType || "default"} @ ${bitrate}bps`,
        );
        return { mimeType: mimeType || "default", bitrate, options };
      } catch {
        continue;
      }
    }

    return null;
  };

  /**
   * Request secondary camera access (mobile front camera)
   */
  const requestSecondaryCamera = useCallback(async () => {
    try {
      console.log("📱 Requesting secondary camera (mobile front)...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user", // Front camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      console.log(" Secondary camera access granted");
      secondaryStreamRef.current = stream;
      setSecondaryCameraStream(stream);
      setIsConnected(true);

      // Notify server about secondary camera connection
      if (socketRef?.current?.connected) {
        socketRef.current.emit("secondary_camera_connected", {
          interviewId,
          userId,
          timestamp: Date.now(),
        });
      }

      return stream;
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
  }, [interviewId, userId, socketRef]);

  /**
   * Start recording secondary camera
   */
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

      // Get or request stream
      let stream = secondaryStreamRef.current;
      if (!stream || !stream.active) {
        stream = await requestSecondaryCamera();
        if (!stream) {
          isRequestingSessionRef.current = false;
          return;
        }
      }

      // Verify track is live
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== "live") {
        console.error("❌ Secondary camera video track is not live");
        isRequestingSessionRef.current = false;
        return;
      }

      // Find MIME config
      const mimeConfig = findSupportedMimeType(stream);
      if (!mimeConfig) {
        throw new Error(
          "No supported video MIME type found for secondary camera.",
        );
      }

      // Create MediaRecorder
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

      // Handle track ended
      videoTrack.onended = () => {
        console.log("🛑 Secondary camera stopped");
        if (mediaRecorderRef.current?.state !== "inactive") {
          stopRecording();
        }
      };

      // Event handlers
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
        console.log(" Secondary camera MediaRecorder started");
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

        // TODO: Stream the video in the

        // Stop stream tracks
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

      // Request server session
      console.log("📤 Requesting secondary camera session from server...");
      socketRef.current.emit("video_recording_start", {
        videoType: "secondary_camera",
        totalChunks: 0,
        metadata: {
          mimeType: mimeConfig.mimeType,
          videoBitsPerSecond: mimeConfig.bitrate,
        },
      });

      // Wait for server confirmation
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
          console.log(" Server confirmed secondary camera ready:", response);
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
        " Secondary camera session confirmed, starting MediaRecorder",
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
  }, [isRecording, socketRef, requestSecondaryCamera]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(async () => {
    console.log("🛑 Attempting to stop secondary camera recording...");

    if (!mediaRecorderRef.current) {
      console.log("⚠️ No media recorder to stop");

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
        console.log(" Stop command sent to secondary camera recorder");
      } catch (error) {
        console.error("❌ Error stopping recorder:", error);
        mediaRecorderRef.current = null;
        resolve(null);
      }
    });
  }, []);

  /**
   * Cleanup
   */
  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up secondary camera");

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
  }, []);

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
