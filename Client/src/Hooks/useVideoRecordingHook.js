import { useRef, useState, useCallback, useEffect } from "react";

const CHUNK_DURATION = 2000; // Send video chunks every 2 seconds (matching security camera)

const useVideoRecording = (interviewId, userId, cameraStream, socketRef) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);

  const mediaRecorderRef = useRef(null);
  const chunkCountRef = useRef(0);
  const videoSessionReadyRef = useRef(false);

  // Start recording
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

    try {
      console.log("🎥 Starting primary camera video recording...");

      // Check supported MIME types
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

      const options = {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      };

      const mediaRecorder = new MediaRecorder(cameraStream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunkCountRef.current = 0;
      videoSessionReadyRef.current = false;

      // ✅ FIX 1: Emit video_recording_start to server
      console.log("📤 Emitting video_recording_start to server...");
      socketRef.current.emit("video_recording_start", {
        videoType: "primary_camera",
        totalChunks: 0,
        metadata: {
          mimeType: selectedMimeType,
          videoBitsPerSecond: 2500000,
        },
      });

      // ✅ FIX 2: Wait for server confirmation before starting recording
      const readyListener = (response) => {
        if (response.videoType === "primary_camera") {
          console.log("✅ Server ready for primary camera chunks:", response);
          videoSessionReadyRef.current = true;

          // Now start the actual recording
          if (mediaRecorderRef.current) {
            mediaRecorderRef.current.start(CHUNK_DURATION);
            console.log("▶️ MediaRecorder started (2s chunks)");
          }

          // Remove listener after receiving
          socketRef.current.off("video_recording_ready", readyListener);
        }
      };

      socketRef.current.on("video_recording_ready", readyListener);

      // Handle data available (chunks)
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunkCountRef.current++;

          console.log(
            `📦 Primary camera chunk ${chunkCountRef.current} captured (${event.data.size} bytes)`,
          );

          // ✅ FIX 3: Send via WebSocket instead of HTTP
          const reader = new FileReader();
          reader.onloadend = () => {
            if (socketRef.current?.connected && videoSessionReadyRef.current) {
              const base64data = reader.result.split(",")[1];

              socketRef.current.emit("video_chunk", {
                videoType: "primary_camera",
                chunkNumber: chunkCountRef.current,
                chunkData: base64data,
                isLastChunk: false,
                timestamp: Date.now(),
              });

              if (chunkCountRef.current % 5 === 0) {
                console.log(
                  `📤 Primary camera chunks sent: ${chunkCountRef.current}`,
                );
              }
            } else {
              console.warn(
                "⚠️ Socket not connected or session not ready, chunk not sent",
              );
            }
          };
          reader.readAsDataURL(event.data);

          // Keep chunks in state for reference
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };

      mediaRecorder.onerror = (error) => {
        console.error("❌ MediaRecorder error:", error);
        setIsRecording(false);
      };

      mediaRecorder.onstop = () => {
        console.log(
          `🛑 MediaRecorder stopped. Total chunks: ${chunkCountRef.current}`,
        );
        setIsRecording(false);

        // ✅ FIX 4: Notify server recording stopped
        if (socketRef.current?.connected) {
          socketRef.current.emit("video_recording_stop", {
            videoType: "primary_camera",
            totalChunks: chunkCountRef.current,
          });
          console.log("📤 Sent video_recording_stop to server");
        }
      };

      mediaRecorder.onstart = () => {
        console.log("▶️ MediaRecorder started");
        setIsRecording(true);
      };

      console.log(
        "✅ MediaRecorder configured, waiting for server confirmation...",
      );

      // Set timeout in case server doesn't respond
      setTimeout(() => {
        if (!videoSessionReadyRef.current) {
          console.error(
            "❌ Server didn't confirm video session within 10s, starting anyway",
          );
          if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === "inactive"
          ) {
            mediaRecorderRef.current.start(CHUNK_DURATION);
          }
        }
      }, 10000);
    } catch (error) {
      console.error("❌ Failed to start video recording:", error);
      setIsRecording(false);
    }
  }, [cameraStream, isRecording, interviewId, userId, socketRef]);

  // ✅ FIX 5: Simplified stop recording (no redundant HTTP upload)
  const stopRecording = useCallback(async () => {
    if (!isRecording || !mediaRecorderRef.current) {
      console.log("⚠️ No active recording to stop");
      return null;
    }

    console.log("🛑 Stopping video recording...");

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;

      mediaRecorder.onstop = async () => {
        console.log("✅ Recording stopped");

        // Server will finalize the video from chunks
        console.log(`📊 Total chunks recorded: ${chunkCountRef.current}`);

        setIsRecording(false);
        resolve(chunkCountRef.current);
      };

      // Stop recording
      if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      } else {
        // Already stopped
        mediaRecorder.onstop();
      }
    });
  }, [isRecording, socketRef]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up video recording...");

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    chunkCountRef.current = 0;
    videoSessionReadyRef.current = false;
  }, []);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
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
