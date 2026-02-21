import { useRef, useState, useCallback, useEffect } from "react";

const CHUNK_DURATION = 20000;

const useSecondaryCamera = (interviewId, userId, socketRef) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [secondaryCameraStream, setSecondaryCameraStream] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(null); // current zoom applied
  const [maxZoom, setMaxZoom] = useState(null); // max supported zoom
  const [zoomSupported, setZoomSupported] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunkCountRef = useRef(0);
  const secondarySessionReadyRef = useRef(false);
  const isRequestingSessionRef = useRef(false);
  const hasStoppedRef = useRef(false);
  const secondaryStreamRef = useRef(null);
  const videoTrackRef = useRef(null); // direct ref to the MediaStreamTrack

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
   * Apply zoom to the current video track.
   * Call this after requestSecondaryCamera() to change zoom level dynamically.
   * level: number — must be within [minZoom, maxZoom] from capabilities.
   */
  const applyZoom = useCallback(async (level) => {
    const track = videoTrackRef.current;
    if (!track) {
      console.warn("⚠️ No video track available to apply zoom");
      return false;
    }

    const capabilities = track.getCapabilities();
    if (!("zoom" in capabilities)) {
      console.warn("⚠️ Zoom not supported on this device/browser");
      return false;
    }

    const clamped = Math.min(
      Math.max(level, capabilities.zoom.min),
      capabilities.zoom.max,
    );

    try {
      await track.applyConstraints({ advanced: [{ zoom: clamped }] });
      setZoomLevel(clamped);
      console.log(`✅ Zoom applied: ${clamped}`);
      return true;
    } catch (err) {
      console.error("❌ applyConstraints zoom failed:", err.message);
      return false;
    }
  }, []);

  /**
   * Request secondary camera access and detect zoom capabilities.
   * Mirrors the pattern: getUserMedia → getCapabilities → read zoom range.
   */
  const requestSecondaryCamera = useCallback(async () => {
    try {
      console.log("📱 Requesting secondary camera (mobile front)...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      const videoTrack = stream.getVideoTracks()[0];
      videoTrackRef.current = videoTrack;

      // ── Zoom capability detection (mirrors your pattern) ──────────────────
      const capabilities = videoTrack.getCapabilities();
      if ("zoom" in capabilities) {
        const max = capabilities.zoom.max;
        const min = capabilities.zoom.min;
        setMaxZoom(max);
        setZoomSupported(true);
        console.log(`🔍 Zoom supported — range: ${min}–${max}`);

        // Set to minimum zoom immediately = widest possible view
        await videoTrack.applyConstraints({
          advanced: [{ zoom: min }],
        });
        setZoomLevel(min);
        console.log(`✅ Initial zoom set to minimum (${min}) for widest view`);
      } else {
        setZoomSupported(false);
        console.log("ℹ️ Zoom not supported on this device/browser");
      }
      // ─────────────────────────────────────────────────────────────────────

      console.log("✅ Secondary camera access granted");
      secondaryStreamRef.current = stream;
      setSecondaryCameraStream(stream);
      setIsConnected(true);

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
        console.log("🛑 Secondary camera track ended");
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

        const s = secondaryStreamRef.current;
        if (s) {
          s.getTracks().forEach((t) => t.stop());
          secondaryStreamRef.current = null;
          videoTrackRef.current = null;
          setSecondaryCameraStream(null);
          setIsConnected(false);
          setZoomLevel(null);
          setZoomSupported(false);
          setMaxZoom(null);
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
  }, [isRecording, socketRef, requestSecondaryCamera]);

  const stopRecording = useCallback(async () => {
    console.log("🛑 Attempting to stop secondary camera recording...");

    if (!mediaRecorderRef.current) {
      console.log("⚠️ No media recorder to stop");

      const s = secondaryStreamRef.current;
      if (s && s.active) {
        console.log("🧹 Cleaning up active stream");
        s.getTracks().forEach((t) => t.stop());
        secondaryStreamRef.current = null;
        videoTrackRef.current = null;
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
  }, []);

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
      videoTrackRef.current = null;
      setSecondaryCameraStream(null);
      setIsConnected(false);
    }

    chunkCountRef.current = 0;
    secondarySessionReadyRef.current = false;
    isRequestingSessionRef.current = false;
    hasStoppedRef.current = false;
    setIsRecording(false);
    setZoomLevel(null);
    setZoomSupported(false);
    setMaxZoom(null);
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
    // Zoom controls — exposed so UI can build a zoom slider if needed
    applyZoom,
    zoomLevel,
    maxZoom,
    zoomSupported,
  };
};

export default useSecondaryCamera;
