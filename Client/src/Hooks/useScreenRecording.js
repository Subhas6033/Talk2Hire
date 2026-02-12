import { useRef, useState, useCallback, useEffect } from "react";

const CHUNK_DURATION = 20000; // 20 seconds per chunk

const useScreenRecording = (interviewId, userId, socketRef) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [screenStream, setScreenStream] = useState(null); // exposed for live preview

  const mediaRecorderRef = useRef(null);
  const chunkCountRef = useRef(0);
  const screenSessionReadyRef = useRef(false);
  const isRequestingSessionRef = useRef(false);
  const hasStoppedRef = useRef(false);
  const screenStreamRef = useRef(null); // internal ref to avoid stale closures

  /**
   * Find supported MIME type for screen recording
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
          `✅ Screen MIME type: ${mimeType || "default"} @ ${bitrate}bps`,
        );
        return { mimeType: mimeType || "default", bitrate, options };
      } catch {
        continue;
      }
    }

    return null;
  };

  /**
   * Request screen share from user — exposed so the UI can call it early if needed
   */
  const requestScreenShare = useCallback(async () => {
    try {
      console.log("🖥️ Requesting screen share...");

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          cursor: "always",
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });

      console.log("✅ Screen share granted");
      screenStreamRef.current = stream;
      setScreenStream(stream); // triggers re-render so preview <video> gets srcObject
      return stream;
    } catch (error) {
      console.error("❌ Screen share denied:", error);
      if (error.name === "NotAllowedError") {
        alert(
          "Screen sharing permission denied. Screen recording will not be available.",
        );
      } else {
        alert("Failed to start screen sharing: " + error.message);
      }
      return null;
    }
  }, []);

  /**
   * Start screen recording
   */
  const startRecording = useCallback(async () => {
    if (isRecording) {
      console.log("⚠️ Screen recording already in progress");
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
      console.log("⚠️ Already requesting screen recording session");
      return;
    }

    try {
      console.log("🖥️ Starting screen recording...");
      isRequestingSessionRef.current = true;
      hasStoppedRef.current = false;
      screenSessionReadyRef.current = false;
      chunkCountRef.current = 0;

      // Acquire stream (reuse if already granted)
      let stream = screenStreamRef.current;
      if (!stream || !stream.active) {
        stream = await requestScreenShare();
        if (!stream) {
          isRequestingSessionRef.current = false;
          return;
        }
      }

      // Verify track is live
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== "live") {
        console.error("❌ Screen video track is not live");
        isRequestingSessionRef.current = false;
        return;
      }

      // Find MIME config
      const mimeConfig = findSupportedMimeType(stream);
      if (!mimeConfig) {
        throw new Error(
          "No supported video MIME type found for screen recording.",
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
          alert("Failed to initialize screen recorder: " + finalError.message);
          return;
        }
      }

      mediaRecorderRef.current = mediaRecorder;

      // If the user clicks "Stop sharing" in the browser chrome, stop recording cleanly
      videoTrack.onended = () => {
        console.log("🛑 User stopped screen sharing from browser UI");
        if (mediaRecorderRef.current?.state !== "inactive") {
          stopRecording();
        }
      };

      // ── Event handlers ────────────────────────────────────────────────────

      mediaRecorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return;

        chunkCountRef.current++;
        const currentChunkNumber = chunkCountRef.current;

        const reader = new FileReader();
        reader.onloadend = () => {
          if (socketRef.current?.connected && screenSessionReadyRef.current) {
            const base64Data = reader.result.split(",")[1];
            socketRef.current.emit("video_chunk", {
              videoType: "screen_recording",
              chunkNumber: currentChunkNumber,
              chunkData: base64Data,
              isLastChunk: false,
              timestamp: Date.now(),
            });
          }
        };
        reader.readAsDataURL(event.data);
        setRecordedChunks((prev) => [...prev, event.data]);
      };

      mediaRecorder.onstart = () => {
        console.log("✅ Screen MediaRecorder started");
        setIsRecording(true);
      };

      mediaRecorder.onstop = () => {
        if (hasStoppedRef.current) return;
        hasStoppedRef.current = true;

        console.log(
          `🛑 Screen recording stopped. Chunks: ${chunkCountRef.current}`,
        );
        setIsRecording(false);
        screenSessionReadyRef.current = false;

        if (socketRef.current?.connected) {
          socketRef.current.emit("video_recording_stop", {
            videoType: "screen_recording",
            totalChunks: chunkCountRef.current,
          });
        }

        // Stop the stream tracks to release OS-level capture
        const s = screenStreamRef.current;
        if (s) {
          s.getTracks().forEach((t) => t.stop());
          screenStreamRef.current = null;
          setScreenStream(null);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("❌ Screen MediaRecorder error:", event.error);
        isRequestingSessionRef.current = false;
        setIsRecording(false);
      };

      // ── Request server session ────────────────────────────────────────────
      console.log("📤 Requesting screen recording session from server...");
      socketRef.current.emit("video_recording_start", {
        videoType: "screen_recording",
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
              "Server timeout waiting for screen recording confirmation",
            ),
          );
        }, 10000);

        const handler = (response) => {
          // Only handle the screen_recording type response
          if (response.videoType !== "screen_recording") return;
          clearTimeout(timeout);
          socketRef.current.off("video_recording_error", errorHandler);
          console.log("✅ Server confirmed screen recording ready:", response);
          resolve(response);
        };

        const errorHandler = (error) => {
          if (error.videoType !== "screen_recording") return;
          clearTimeout(timeout);
          socketRef.current.off("video_recording_ready", handler);
          reject(new Error(error.error || error.message || "Server error"));
        };

        socketRef.current.on("video_recording_ready", handler);
        socketRef.current.on("video_recording_error", errorHandler);
      });

      await serverResponsePromise;
      console.log("✅ Screen session confirmed, starting MediaRecorder");
      screenSessionReadyRef.current = true;
      isRequestingSessionRef.current = false;
      mediaRecorder.start(CHUNK_DURATION);
    } catch (err) {
      console.error("❌ Screen recording setup error:", err);
      isRequestingSessionRef.current = false;
      setIsRecording(false);
      alert("Failed to setup screen recording: " + err.message);
    }
  }, [isRecording, socketRef, requestScreenShare]);

  /**
   * Stop screen recording - FIXED: Added null checks
   */
  const stopRecording = useCallback(async () => {
    console.log("🛑 Attempting to stop screen recording...");

    // ✅ FIX: Check if mediaRecorderRef exists and is not null
    if (!mediaRecorderRef.current) {
      console.log(
        "⚠️ No media recorder to stop (already stopped or never started)",
      );

      // Clean up stream if it exists
      const s = screenStreamRef.current;
      if (s && s.active) {
        console.log("🧹 Cleaning up active stream");
        s.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
        setScreenStream(null);
      }

      return null;
    }

    // ✅ FIX: Check state before attempting to stop
    if (mediaRecorderRef.current.state === "inactive") {
      console.log("⚠️ Recorder already inactive");
      return null;
    }

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;

      const originalStop = recorder.onstop;
      recorder.onstop = (e) => {
        if (originalStop) originalStop(e);
        mediaRecorderRef.current = null; // ✅ FIX: Clear ref after stop
        resolve(chunkCountRef.current);
      };

      try {
        recorder.stop();
        console.log("✅ Stop command sent to recorder");
      } catch (error) {
        console.error("❌ Error stopping recorder:", error);
        mediaRecorderRef.current = null; // ✅ FIX: Clear ref even on error
        resolve(null);
      }
    });
  }, []);

  /**
   * Cleanup on unmount - FIXED: Added null checks
   */
  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up screen recording");

    // ✅ FIX: Only stop if recorder exists and is not inactive
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

    // Clear the ref
    mediaRecorderRef.current = null;

    // Stop stream tracks
    const s = screenStreamRef.current;
    if (s && s.active) {
      s.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (error) {
          console.error("❌ Error stopping track:", error);
        }
      });
      screenStreamRef.current = null;
      setScreenStream(null);
    }

    // Reset state
    chunkCountRef.current = 0;
    screenSessionReadyRef.current = false;
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
    screenStream,
    startRecording,
    stopRecording,
    requestScreenShare,
    cleanup,
  };
};

export default useScreenRecording;
