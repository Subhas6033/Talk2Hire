import { useRef, useState, useCallback, useEffect } from "react";

const CHUNK_DURATION = 20000;

/**
 * KEY FIX: Hook now accepts an optional `preWarmVideoId` constructor argument.
 * When provided, startRecording() skips emitting video_recording_start and
 * immediately begins chunking to the already-confirmed server session.
 * This removes the ~500ms–1s registration round-trip that was delaying
 * primary camera recording on InterviewLive mount.
 */
const useVideoRecording = (
  interviewId,
  userId,
  cameraStream,
  socketRef,
  preWarmVideoId = null,
) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);

  const mediaRecorderRef = useRef(null);
  const chunkCountRef = useRef(0);
  const videoSessionReadyRef = useRef(false);
  const isRequestingSessionRef = useRef(false);
  const hasStoppedRef = useRef(false);

  // Keep preWarmVideoId fresh in a ref
  const preWarmVideoIdRef = useRef(preWarmVideoId);
  useEffect(() => {
    preWarmVideoIdRef.current = preWarmVideoId;
  }, [preWarmVideoId]);

  const findSupportedMimeType = (stream) => {
    console.log("🔍 Starting MIME type detection...");

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      console.error("❌ No video track for MIME detection");
      return null;
    }

    const mimeTypesToTry = [
      { type: "video/webm;codecs=vp9", bitrate: 2500000 },
      { type: "video/webm;codecs=vp9", bitrate: 1500000 },
      { type: "video/webm;codecs=vp8", bitrate: 2500000 },
      { type: "video/webm;codecs=vp8", bitrate: 1500000 },
      { type: "video/webm;codecs=h264", bitrate: 2500000 },
      { type: "video/webm;codecs=h264", bitrate: 1500000 },
      { type: "video/webm", bitrate: 2500000 },
      { type: "video/webm", bitrate: 1500000 },
      { type: "video/webm", bitrate: 1000000 },
      { type: "video/mp4", bitrate: 2500000 },
      { type: "video/mp4", bitrate: 1500000 },
      { type: "", bitrate: 1000000 },
    ];

    for (let i = 0; i < mimeTypesToTry.length; i++) {
      const config = mimeTypesToTry[i];
      const { type: mimeType, bitrate } = config;

      if (mimeType && !MediaRecorder.isTypeSupported(mimeType)) {
        console.log(
          `⚠️ [${i + 1}/${mimeTypesToTry.length}] ${mimeType} - NOT supported`,
        );
        continue;
      }

      try {
        const options = {};
        if (mimeType) options.mimeType = mimeType;
        if (bitrate) options.videoBitsPerSecond = bitrate;

        const testRecorder = new MediaRecorder(stream, options);
        if (testRecorder.state !== "inactive") testRecorder.stop();

        console.log(
          ` SUCCESS! MIME type works: ${mimeType || "default"} @ ${bitrate}bps`,
        );
        return { mimeType: mimeType || "default", bitrate, options };
      } catch (error) {
        console.log(
          `❌ [${i + 1}/${mimeTypesToTry.length}] ${mimeType || "default"} @ ${bitrate}bps failed:`,
          error.message,
        );
        continue;
      }
    }

    console.error("❌ No compatible MIME type found");
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

    if (!cameraStream.active) {
      console.error("❌ FATAL: Camera stream is not active!");
      alert("Camera stream is not active. Please refresh and try again.");
      return;
    }

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

      const mimeConfig = findSupportedMimeType(cameraStream);
      if (!mimeConfig) {
        throw new Error(
          "No supported video MIME type found. Please try Chrome, Edge, or Firefox.",
        );
      }

      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(cameraStream, mimeConfig.options);
      } catch (createError) {
        console.error("❌ Failed to create MediaRecorder:", createError);
        try {
          console.log("🔄 Last resort: creating with NO options...");
          mediaRecorder = new MediaRecorder(cameraStream);
        } catch (finalError) {
          console.error(
            "❌ All MediaRecorder creation attempts failed:",
            finalError,
          );
          isRequestingSessionRef.current = false;
          alert(
            "Failed to initialize video recorder. Please try Chrome or Firefox.",
          );
          return;
        }
      }

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return;

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
        console.log(" MediaRecorder started successfully");
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
        isRequestingSessionRef.current = false;
        setIsRecording(false);
      };

      // KEY FIX: Pre-warmed path — session already confirmed during setup step 7.
      // Skip video_recording_start entirely and begin recording immediately.
      if (preWarmVideoIdRef.current) {
        console.log(
          "♻️ Primary camera session pre-warmed, skipping registration. videoId:",
          preWarmVideoIdRef.current,
        );
        videoSessionReadyRef.current = true;
        isRequestingSessionRef.current = false;
        mediaRecorder.start(CHUNK_DURATION);
        console.log(" MediaRecorder started (pre-warmed path)");
        return;
      }

      // Fallback: request a new server session
      console.log("📤 Requesting video session from server...");
      socketRef.current.emit("video_recording_start", {
        videoType: "primary_camera",
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
          reject(new Error("Server timeout - no response in 10 seconds"));
        }, 10000);

        const handler = (response) => {
          if (response?.videoType && response.videoType !== "primary_camera")
            return;
          clearTimeout(timeout);
          socketRef.current.off("video_recording_error", errorHandler);
          console.log(" Server confirmed ready:", response);
          resolve(response);
        };

        const errorHandler = (error) => {
          if (error?.videoType && error.videoType !== "primary_camera") return;
          clearTimeout(timeout);
          socketRef.current.off("video_recording_ready", handler);
          console.error("❌ Server error:", error);
          reject(new Error(error.error || error.message || "Server error"));
        };

        socketRef.current.on("video_recording_ready", handler);
        socketRef.current.on("video_recording_error", errorHandler);
      });

      try {
        await serverResponsePromise;
        console.log(" Server confirmed video session ready");
        videoSessionReadyRef.current = true;
        isRequestingSessionRef.current = false;
        mediaRecorder.start(CHUNK_DURATION);
        console.log(" MediaRecorder started after server confirmation");
      } catch (serverError) {
        console.error("❌ Server did not confirm session:", serverError);
        isRequestingSessionRef.current = false;

        if (mediaRecorder && mediaRecorder.state === "inactive") {
          console.warn("⚠️ Proceeding without server confirmation (risky!)");
          videoSessionReadyRef.current = true;
          try {
            mediaRecorder.start(CHUNK_DURATION);
            console.log(" Started recording without server confirmation");
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
