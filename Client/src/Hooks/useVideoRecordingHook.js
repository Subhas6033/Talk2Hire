import { useRef, useState, useCallback, useEffect } from "react";

const CHUNK_DURATION = 2000; // Send video chunks every 2 seconds

const useVideoRecording = (interviewId, userId, cameraStream, socketRef) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);

  const mediaRecorderRef = useRef(null);
  const chunkCountRef = useRef(0);
  const videoSessionReadyRef = useRef(false);
  const isRequestingSessionRef = useRef(false);
  const hasStoppedRef = useRef(false);

  // ✅ FIXED: Start recording - wait for server confirmation
  const startRecording = useCallback(() => {
    if (!cameraStream || isRecording) {
      console.log("⚠️ Cannot start recording:", {
        hasStream: !!cameraStream,
        isRecording,
      });
      return;
    }

    if (!socketRef?.current?.connected) {
      console.error("❌ Socket not connected");

      // ✅ FIX: Retry after delay
      setTimeout(() => {
        if (socketRef?.current?.connected) {
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

      const mimeTypes = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];

      let selectedMimeType = null;
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error("No supported video MIME type");
      }

      // ✅ FIX: Create MediaRecorder immediately
      const mediaRecorder = new MediaRecorder(cameraStream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000,
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return;

        chunkCountRef.current++;

        const reader = new FileReader();
        reader.onloadend = () => {
          if (socketRef.current?.connected && videoSessionReadyRef.current) {
            socketRef.current.emit("video_chunk", {
              videoType: "primary_camera",
              chunkNumber: chunkCountRef.current,
              chunkData: reader.result.split(",")[1],
              isLastChunk: false,
              timestamp: Date.now(),
            });
          }
        };
        reader.readAsDataURL(event.data);

        setRecordedChunks((prev) => [...prev, event.data]);
      };

      mediaRecorder.onstart = () => {
        console.log("✅ MediaRecorder started");
        setIsRecording(true);
      };

      mediaRecorder.onstop = () => {
        if (hasStoppedRef.current) return;
        hasStoppedRef.current = true;

        console.log(`🛑 Recording stopped. Chunks: ${chunkCountRef.current}`);
        setIsRecording(false);
        videoSessionReadyRef.current = false;

        if (socketRef.current?.connected) {
          socketRef.current.emit("video_recording_stop", {
            videoType: "primary_camera",
            totalChunks: chunkCountRef.current,
          });
        }
      };

      // ✅ FIX: Request session from server
      console.log("📤 Requesting video session...");
      socketRef.current.emit("video_recording_start", {
        videoType: "primary_camera",
        totalChunks: 0,
        metadata: {
          mimeType: selectedMimeType,
          videoBitsPerSecond: 2500000,
        },
      });

      // ✅ FIX: Wait for server ready
      const readyListener = (response) => {
        if (response?.videoType !== "primary_camera") return;

        console.log("✅ Server ready, starting MediaRecorder");
        videoSessionReadyRef.current = true;
        isRequestingSessionRef.current = false;

        mediaRecorder.start(CHUNK_DURATION);

        socketRef.current.off("video_recording_ready", readyListener);
      };

      socketRef.current.on("video_recording_ready", readyListener);

      // ✅ FIX: Timeout
      setTimeout(() => {
        if (!videoSessionReadyRef.current) {
          console.error("❌ Server session timeout");
          isRequestingSessionRef.current = false;

          // Start anyway
          if (mediaRecorder.state === "inactive") {
            videoSessionReadyRef.current = true;
            mediaRecorder.start(CHUNK_DURATION);
          }
        }
      }, 5000);
    } catch (err) {
      console.error("❌ Recording error:", err);
      isRequestingSessionRef.current = false;
      setIsRecording(false);
    }
  }, [cameraStream, isRecording, socketRef]);

  // ✅ Stop recording safely
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

  // Cleanup
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
      socketRef.current.off("disconnect");
      socketRef.current.off("reconnect");
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
