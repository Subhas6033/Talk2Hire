import { useRef, useState, useCallback, useEffect } from "react";

const CHUNK_DURATION = 20000;

function findSupportedMimeType() {
  const candidates = [
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

  for (const { type, bitrate } of candidates) {
    if (type === "" || MediaRecorder.isTypeSupported(type)) {
      const options = {};
      if (type) options.mimeType = type;
      if (bitrate) options.videoBitsPerSecond = bitrate;
      console.log(
        `✅ Video MIME: ${type || "browser default"} @ ${bitrate}bps`,
      );
      return { mimeType: type || "default", bitrate, options };
    }
  }
  return null;
}

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

  const preWarmVideoIdRef = useRef(preWarmVideoId);
  useEffect(() => {
    preWarmVideoIdRef.current = preWarmVideoId;
  }, [preWarmVideoId]);

  const startRecording = useCallback(async () => {
    if (!cameraStream || isRecording) return;
    if (!cameraStream.active) {
      alert("Camera stream is not active. Please refresh.");
      return;
    }

    const videoTrack = cameraStream.getVideoTracks()[0];
    if (!videoTrack) {
      alert("No video track found.");
      return;
    }
    if (videoTrack.readyState !== "live") {
      alert(`Video track is ${videoTrack.readyState}.`);
      return;
    }

    if (!socketRef?.current?.connected) {
      setTimeout(() => {
        if (socketRef?.current?.connected) startRecording();
      }, 2000);
      return;
    }
    if (isRequestingSessionRef.current) return;

    try {
      isRequestingSessionRef.current = true;
      hasStoppedRef.current = false;
      videoSessionReadyRef.current = false;
      chunkCountRef.current = 0;

      // FIX: isTypeSupported() only — no test instances
      const mimeConfig = findSupportedMimeType();
      if (!mimeConfig) throw new Error("No supported video MIME type found.");

      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(cameraStream, mimeConfig.options);
      } catch (e) {
        console.warn("⚠️ Preferred MIME failed, fallback:", e.message);
        try {
          mediaRecorder = new MediaRecorder(cameraStream);
        } catch (finalErr) {
          isRequestingSessionRef.current = false;
          alert("Failed to initialize video recorder: " + finalErr.message);
          return;
        }
      }
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return;
        chunkCountRef.current++;
        const chunkNum = chunkCountRef.current;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (socketRef.current?.connected && videoSessionReadyRef.current) {
            socketRef.current.emit("video_chunk", {
              videoType: "primary_camera",
              chunkNumber: chunkNum,
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
        console.log("✅ Video MediaRecorder started");
        setIsRecording(true);
      };

      mediaRecorder.onstop = () => {
        if (hasStoppedRef.current) return;
        hasStoppedRef.current = true;
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

      // Session management
      if (preWarmVideoIdRef.current) {
        console.log("♻️ Primary camera pre-warmed:", preWarmVideoIdRef.current);
        videoSessionReadyRef.current = true;
        isRequestingSessionRef.current = false;
        mediaRecorder.start(CHUNK_DURATION);
        return;
      }

      socketRef.current.emit("video_recording_start", {
        videoType: "primary_camera",
        totalChunks: 0,
        metadata: {
          mimeType: mimeConfig.mimeType,
          videoBitsPerSecond: mimeConfig.bitrate,
        },
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          socketRef.current.off("video_recording_ready", handler);
          socketRef.current.off("video_recording_error", errorHandler);
          // Proceed anyway — don't block recording on server timeout
          console.warn("⚠️ Server confirmation timeout, proceeding anyway");
          videoSessionReadyRef.current = true;
          isRequestingSessionRef.current = false;
          resolve();
        }, 10000);
        const handler = (res) => {
          if (res?.videoType && res.videoType !== "primary_camera") return;
          clearTimeout(timeout);
          socketRef.current.off("video_recording_error", errorHandler);
          videoSessionReadyRef.current = true;
          isRequestingSessionRef.current = false;
          resolve(res);
        };
        const errorHandler = (err) => {
          if (err?.videoType && err.videoType !== "primary_camera") return;
          clearTimeout(timeout);
          socketRef.current.off("video_recording_ready", handler);
          reject(new Error(err.error || "Server error"));
        };
        socketRef.current.on("video_recording_ready", handler);
        socketRef.current.on("video_recording_error", errorHandler);
      });

      mediaRecorder.start(CHUNK_DURATION);
      console.log("✅ Primary camera recording started");
    } catch (err) {
      console.error("❌ Video recording setup error:", err);
      isRequestingSessionRef.current = false;
      setIsRecording(false);
    }
  }, [cameraStream, isRecording, socketRef]);

  const stopRecording = useCallback(async () => {
    if (!isRecording || !mediaRecorderRef.current) return null;
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      recorder.onstop = () => {
        setIsRecording(false);
        videoSessionReadyRef.current = false;
        resolve(chunkCountRef.current);
      };
      if (recorder.state !== "inactive") recorder.stop();
      else recorder.onstop();
    });
  }, [isRecording]);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    if (socketRef?.current) socketRef.current.off("video_recording_ready");
    chunkCountRef.current = 0;
    videoSessionReadyRef.current = false;
    isRequestingSessionRef.current = false;
    hasStoppedRef.current = false;
  }, [socketRef]);

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    isRecording,
    recordedChunks,
    startRecording,
    stopRecording,
    cleanup,
  };
};

export default useVideoRecording;
