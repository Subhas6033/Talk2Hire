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

    if (!socketRef || !socketRef.current) {
      console.error("❌ No socket reference provided");
      return;
    }

    // ✅ IMPROVED: Wait for socket connection before starting
    if (!socketRef.current.connected) {
      console.warn("⚠️ Socket not connected, waiting for connection...");

      const maxWaitTime = 10000; // 10 seconds
      const startTime = Date.now();

      const connectionWaitInterval = setInterval(() => {
        if (socketRef.current?.connected) {
          clearInterval(connectionWaitInterval);
          console.log("✅ Socket connected, starting recording now");
          startRecording(); // Retry
        } else if (Date.now() - startTime > maxWaitTime) {
          clearInterval(connectionWaitInterval);
          console.error("❌ Socket connection timeout after 10s");
          setError("Failed to connect to server. Please refresh.");
        }
      }, 500);

      return;
    }

    if (isRequestingSessionRef.current) {
      console.log("⚠️ Already requesting video session");
      return;
    }

    try {
      console.log("🎥 Requesting video session from server...");
      isRequestingSessionRef.current = true;
      hasStoppedRef.current = false;
      videoSessionReadyRef.current = false;
      chunkCountRef.current = 0;

      // Supported MIME types
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

      // ✅ STEP 1: Request video session
      socketRef.current.emit("video_recording_start", {
        videoType: "primary_camera",
        totalChunks: 0,
        metadata: {
          mimeType: selectedMimeType,
          videoBitsPerSecond: 2500000,
        },
      });

      // ✅ STEP 2: Wait for server confirmation
      const readyListener = (response) => {
        if (response?.videoType !== "primary_camera") return;

        console.log("✅ Server ready for primary camera:", response);
        videoSessionReadyRef.current = true;
        isRequestingSessionRef.current = false;

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

        mediaRecorder.onerror = (err) => {
          console.error("❌ MediaRecorder error:", err);
          setIsRecording(false);
        };

        mediaRecorder.onstart = () => {
          console.log("▶️ MediaRecorder started");
          setIsRecording(true);
        };

        mediaRecorder.onstop = () => {
          if (hasStoppedRef.current) return;
          hasStoppedRef.current = true;

          console.log(
            `🛑 MediaRecorder stopped. Total chunks: ${chunkCountRef.current}`,
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

        // ✅ Handle socket disconnect / reconnect
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

        mediaRecorder.start(CHUNK_DURATION);
        console.log("✅ MediaRecorder started (2s chunks)");

        socketRef.current.off("video_recording_ready", readyListener);
      };

      socketRef.current.off("video_recording_ready");
      socketRef.current.on("video_recording_ready", readyListener);

      // Timeout safety
      setTimeout(() => {
        if (!videoSessionReadyRef.current && isRequestingSessionRef.current) {
          console.error("❌ Server did not confirm video session in time");
          isRequestingSessionRef.current = false;
        }
      }, 10000);
    } catch (err) {
      console.error("❌ Failed to start video recording:", err);
      isRequestingSessionRef.current = false;
      setIsRecording(false);
    }
  }, [cameraStream, isRecording, interviewId, userId, socketRef]);

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
