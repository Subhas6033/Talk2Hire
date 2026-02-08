import { useRef, useState, useCallback, useEffect } from "react";

const CHUNK_DURATION = 2000;

const useVideoRecording = (interviewId, userId, cameraStream, socketRef) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);

  const mediaRecorderRef = useRef(null);
  const chunkCountRef = useRef(0);
  const videoSessionReadyRef = useRef(false);
  const isRequestingSessionRef = useRef(false);
  const hasStoppedRef = useRef(false);

  // ✅ Listen for server ready signal
  /* useEffect(() => {
    if (!socketRef?.current) return;

    const handleVideoReady = (response) => {
      console.log("📡 Received video_recording_ready:", response);

      if (response?.videoType === "primary_camera") {
        console.log("✅ Server ready for video recording");
        videoSessionReadyRef.current = true;
        isRequestingSessionRef.current = false;

        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "inactive"
        ) {
          console.log("🎥 Starting MediaRecorder after server confirmation");
          try {
            mediaRecorderRef.current.start(CHUNK_DURATION);
          } catch (error) {
            console.error("❌ Error starting MediaRecorder:", error);
          }
        }
      }
    };

    socketRef.current.on("video_recording_ready", handleVideoReady);

    return () => {
      if (socketRef?.current) {
        socketRef.current.off("video_recording_ready", handleVideoReady);
      }
    };
  }, [socketRef]); */

  // ✅ CRITICAL FIX: Comprehensive MIME type detection
  const findSupportedMimeType = (stream) => {
    console.log("🔍 Starting MIME type detection...");

    // Get track info
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      console.error("❌ No video track for MIME detection");
      return null;
    }

    const settings = videoTrack.getSettings();
    console.log("📹 Video track settings:", settings);

    // ✅ Comprehensive list ordered by preference
    const mimeTypesToTry = [
      // WebM with VP9 (best quality)
      { type: "video/webm;codecs=vp9", bitrate: 2500000 },
      { type: "video/webm;codecs=vp9", bitrate: 1500000 },

      // WebM with VP8 (better compatibility)
      { type: "video/webm;codecs=vp8", bitrate: 2500000 },
      { type: "video/webm;codecs=vp8", bitrate: 1500000 },

      // WebM with H264 (Safari)
      { type: "video/webm;codecs=h264", bitrate: 2500000 },
      { type: "video/webm;codecs=h264", bitrate: 1500000 },

      // WebM without codec specified
      { type: "video/webm", bitrate: 2500000 },
      { type: "video/webm", bitrate: 1500000 },
      { type: "video/webm", bitrate: 1000000 },

      // MP4 fallback
      { type: "video/mp4", bitrate: 2500000 },
      { type: "video/mp4", bitrate: 1500000 },

      // Last resort - no type specified
      { type: "", bitrate: 1000000 },
    ];

    console.log(
      `🧪 Testing ${mimeTypesToTry.length} MIME type configurations...`,
    );

    for (let i = 0; i < mimeTypesToTry.length; i++) {
      const config = mimeTypesToTry[i];
      const mimeType = config.type;
      const bitrate = config.bitrate;

      // Skip empty type check for isTypeSupported
      if (mimeType && !MediaRecorder.isTypeSupported(mimeType)) {
        console.log(
          `⚠️ [${i + 1}/${mimeTypesToTry.length}] ${mimeType} - NOT supported by browser`,
        );
        continue;
      }

      // Try to actually create MediaRecorder with this config
      try {
        const options = {};
        if (mimeType) {
          options.mimeType = mimeType;
        }
        if (bitrate) {
          options.videoBitsPerSecond = bitrate;
        }

        console.log(
          `🧪 [${i + 1}/${mimeTypesToTry.length}] Testing: ${mimeType || "default"} @ ${bitrate}bps`,
        );

        const testRecorder = new MediaRecorder(stream, options);

        // If we got here, it worked!
        console.log(
          `✅ SUCCESS! MIME type works: ${mimeType || "default"} @ ${bitrate}bps`,
        );

        // Clean up test recorder
        if (testRecorder.state !== "inactive") {
          testRecorder.stop();
        }

        return { mimeType: mimeType || "default", bitrate, options };
      } catch (error) {
        console.log(
          `❌ [${i + 1}/${mimeTypesToTry.length}] ${mimeType || "default"} @ ${bitrate}bps failed:`,
          error.message,
        );
        continue;
      }
    }

    console.error("❌ No compatible MIME type found after testing all options");
    return null;
  };

  const startRecording = useCallback(async () => {
    if (!cameraStream || isRecording) {
      console.log("⚠️ Cannot start recording:", {
        hasStream: !!cameraStream,
        isRecording,
      });
      return;
    }

    // ✅ Verify stream is active
    if (!cameraStream.active) {
      console.error("❌ FATAL: Camera stream is not active!");
      console.error("Stream state:", {
        active: cameraStream.active,
        id: cameraStream.id,
        tracks: cameraStream.getTracks().map((t) => ({
          kind: t.kind,
          readyState: t.readyState,
          enabled: t.enabled,
        })),
      });
      alert("Camera stream is not active. Please refresh and try again.");
      return;
    }

    // ✅ Verify video track exists and is live
    const videoTrack = cameraStream.getVideoTracks()[0];
    if (!videoTrack) {
      console.error("❌ FATAL: No video track in stream!");
      alert("No video track found. Please refresh and try again.");
      return;
    }

    if (videoTrack.readyState !== "live") {
      console.error(
        "❌ FATAL: Video track is not live:",
        videoTrack.readyState,
      );
      alert(
        `Video track is ${videoTrack.readyState}. Please refresh and try again.`,
      );
      return;
    }

    console.log("✅ Stream verification passed:", {
      active: cameraStream.active,
      videoTrack: {
        label: videoTrack.label,
        enabled: videoTrack.enabled,
        readyState: videoTrack.readyState,
        settings: videoTrack.getSettings(),
      },
    });

    if (!socketRef?.current?.connected) {
      console.error("❌ Socket not connected");
      setTimeout(() => {
        if (socketRef?.current?.connected && cameraStream) {
          console.log("🔄 Socket connected, retrying recording...");
          startRecording();
        }
      }, 2000);
      return;
    }

    if (isRequestingSessionRef.current) {
      console.log("⚠️ Already requesting session");
      return;
    }

    try {
      console.log("🎥 Starting video recording...");
      isRequestingSessionRef.current = true;
      hasStoppedRef.current = false;
      videoSessionReadyRef.current = false;
      chunkCountRef.current = 0;

      // ✅ Find supported MIME type
      const mimeConfig = findSupportedMimeType(cameraStream);

      if (!mimeConfig) {
        throw new Error(
          "No supported video MIME type found. Your browser may not support video recording. Please try Chrome, Edge, or Firefox.",
        );
      }

      console.log("✅ Using MIME configuration:", mimeConfig);

      // ✅ Create MediaRecorder with found config
      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(cameraStream, mimeConfig.options);
        console.log("✅ MediaRecorder created successfully with:", mimeConfig);
      } catch (createError) {
        console.error("❌ Failed to create MediaRecorder:", createError);

        // ✅ Absolute last resort - no options at all
        try {
          console.log("🔄 Last resort: creating with NO options...");
          mediaRecorder = new MediaRecorder(cameraStream);
          console.log("✅ MediaRecorder created with default browser settings");
        } catch (finalError) {
          console.error(
            "❌ All MediaRecorder creation attempts failed:",
            finalError,
          );
          isRequestingSessionRef.current = false;
          alert(
            "Failed to initialize video recorder. Your browser may not support this feature. Please try Chrome or Firefox.",
          );
          return;
        }
      }

      mediaRecorderRef.current = mediaRecorder;

      // ✅ Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) {
          console.log("⚠️ Empty video chunk, skipping");
          return;
        }

        chunkCountRef.current++;
        const currentChunkNumber = chunkCountRef.current;

        if (currentChunkNumber % 10 === 0) {
          console.log(
            `📦 Video chunk #${currentChunkNumber} available (${event.data.size} bytes)`,
          );
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          if (socketRef.current?.connected && videoSessionReadyRef.current) {
            const base64Data = reader.result.split(",")[1];

            socketRef.current.emit("video_chunk", {
              videoType: "primary_camera",
              chunkNumber: currentChunkNumber,
              chunkData: base64Data,
              isLastChunk: false,
              timestamp: Date.now(),
            });
          } else {
            if (currentChunkNumber % 10 === 0) {
              console.warn(`⚠️ Cannot send chunk #${currentChunkNumber}:`, {
                socketConnected: socketRef.current?.connected,
                sessionReady: videoSessionReadyRef.current,
              });
            }
          }
        };

        reader.onerror = (error) => {
          console.error(
            `❌ Error reading chunk #${currentChunkNumber}:`,
            error,
          );
        };

        reader.readAsDataURL(event.data);
        setRecordedChunks((prev) => [...prev, event.data]);
      };

      mediaRecorder.onstart = () => {
        console.log("✅ MediaRecorder started successfully");
        setIsRecording(true);
      };

      mediaRecorder.onstop = () => {
        if (hasStoppedRef.current) return;
        hasStoppedRef.current = true;

        console.log(
          `🛑 Recording stopped. Total chunks: ${chunkCountRef.current}`,
        );
        setIsRecording(false);
        videoSessionReadyRef.current = false;

        if (socketRef.current?.connected) {
          socketRef.current.emit("video_recording_stop", {
            videoType: "primary_camera",
            totalChunks: chunkCountRef.current,
          });
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("❌ MediaRecorder error:", event.error);
        console.error("Error details:", {
          name: event.error?.name,
          message: event.error?.message,
          state: mediaRecorder.state,
        });
        isRequestingSessionRef.current = false;
        setIsRecording(false);
      };

      // ✅ FIXED: Request server session with promise-based waiting
      console.log("📤 Requesting video session from server...");

      socketRef.current.emit("video_recording_start", {
        videoType: "primary_camera",
        totalChunks: 0,
        metadata: {
          mimeType: mimeConfig.mimeType,
          videoBitsPerSecond: mimeConfig.bitrate,
        },
      });

      // ✅ Wait for server response with promise
      const serverResponsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          socketRef.current.off("video_recording_ready", handler);
          socketRef.current.off("video_recording_error", errorHandler);
          reject(new Error("Server timeout - no response in 10 seconds"));
        }, 10000);

        const handler = (response) => {
          clearTimeout(timeout);
          socketRef.current.off("video_recording_error", errorHandler);
          console.log("✅ Server confirmed ready:", response);
          resolve(response);
        };

        const errorHandler = (error) => {
          clearTimeout(timeout);
          socketRef.current.off("video_recording_ready", handler);
          console.error("❌ Server error:", error);
          reject(new Error(error.error || error.message || "Server error"));
        };

        socketRef.current.once("video_recording_ready", handler);
        socketRef.current.once("video_recording_error", errorHandler);
      });

      try {
        await serverResponsePromise;
        console.log("✅ Server confirmed video session ready");
        videoSessionReadyRef.current = true;
        isRequestingSessionRef.current = false;
        mediaRecorder.start(CHUNK_DURATION);

        console.log("✅ MediaRecorder started after server confirmation");
      } catch (serverError) {
        console.error("❌ Server did not confirm session:", serverError);
        isRequestingSessionRef.current = false;

        // Try to proceed anyway if MediaRecorder is ready
        if (mediaRecorder && mediaRecorder.state === "inactive") {
          console.warn("⚠️ Proceeding without server confirmation (risky!)");
          alert(
            "Server not responding, but starting recording anyway. Video may not save properly.",
          );

          // Manually set ready flag
          videoSessionReadyRef.current = true;

          try {
            mediaRecorder.start(CHUNK_DURATION);
            console.log("✅ Started recording without server confirmation");
          } catch (startError) {
            console.error("❌ Failed to start recording:", startError);
            throw new Error("Cannot start recording: " + startError.message);
          }
        } else {
          throw new Error("Server not ready and MediaRecorder unavailable");
        }
      }
    } catch (err) {
      console.error("❌ Recording setup error:", err);
      console.error("Error stack:", err.stack);
      isRequestingSessionRef.current = false;
      setIsRecording(false);
      alert("Failed to setup video recording: " + err.message);
    }
  }, [cameraStream, isRecording, socketRef]);

  const stopRecording = useCallback(async () => {
    if (!isRecording || !mediaRecorderRef.current) {
      console.log("⚠️ No active recording to stop");
      return null;
    }

    console.log("🛑 Stopping video recording...");

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;

      recorder.onstop = () => {
        setIsRecording(false);
        videoSessionReadyRef.current = false;
        resolve(chunkCountRef.current);
      };

      if (recorder.state !== "inactive") {
        recorder.stop();
      } else {
        recorder.onstop();
      }
    });
  }, [isRecording]);

  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up video recording");

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    if (socketRef?.current) {
      socketRef.current.off("video_recording_ready");
    }

    chunkCountRef.current = 0;
    videoSessionReadyRef.current = false;
    isRequestingSessionRef.current = false;
    hasStoppedRef.current = false;
  }, [socketRef]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    isRecording,
    recordedChunks,
    startRecording,
    stopRecording,
    cleanup,
  };
};

export default useVideoRecording;
