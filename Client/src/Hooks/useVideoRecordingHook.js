import { useRef, useState, useCallback, useEffect } from "react";

// ─── Config ──────────────────────────────────────────────────────────────────
const CHUNK_DURATION = 20000; // 20-s chunks
const LIVEKIT_MODE = true;

// ─── MIME type detection ──────────────────────────────────────────────────────
function findSupportedMimeType() {
  const candidates = [
    { type: "video/webm;codecs=vp9", bitrate: 2_500_000 },
    { type: "video/webm;codecs=vp9", bitrate: 1_500_000 },
    { type: "video/webm;codecs=vp8", bitrate: 2_500_000 },
    { type: "video/webm;codecs=vp8", bitrate: 1_500_000 },
    { type: "video/webm;codecs=h264", bitrate: 2_500_000 },
    { type: "video/webm", bitrate: 2_500_000 },
    { type: "video/webm", bitrate: 1_500_000 },
    { type: "video/mp4", bitrate: 2_500_000 },
    { type: "", bitrate: 1_000_000 },
  ];
  for (const { type, bitrate } of candidates) {
    if (type === "" || MediaRecorder.isTypeSupported(type)) {
      const options = {};
      if (type) options.mimeType = type;
      if (bitrate) options.videoBitsPerSecond = bitrate;
      console.log(` Video MIME: ${type || "browser default"} @ ${bitrate}bps`);
      return { mimeType: type || "default", bitrate, options };
    }
  }
  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
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

  // FIX: ref guard prevents stale-closure double-start in React StrictMode
  const isRecordingRef = useRef(false);

  const preWarmVideoIdRef = useRef(preWarmVideoId);
  useEffect(() => {
    preWarmVideoIdRef.current = preWarmVideoId;
  }, [preWarmVideoId]);

  // ─────────────────────────────────────────────────────────────────────────
  // startRecording
  // ─────────────────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    // LiveKit egress records primary camera; skip local recorder if no stream
    if (LIVEKIT_MODE && !cameraStream) {
      isRecordingRef.current = true;
      setIsRecording(true);
      console.log("📹 Video: LiveKit egress active (no local stream)");
      return;
    }

    if (!cameraStream) return;
    if (isRecordingRef.current) return; // ref guard (not stale state)
    if (!cameraStream.active) {
      console.warn("⚠️ Camera stream not active");
      return;
    }

    const videoTrack = cameraStream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== "live") {
      console.warn("⚠️ Video track not live:", videoTrack?.readyState);
      return;
    }

    if (!socketRef?.current?.connected) {
      // Retry once socket reconnects
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

      const mimeConfig = findSupportedMimeType();
      if (!mimeConfig) throw new Error("No supported video MIME type found.");

      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(cameraStream, mimeConfig.options);
      } catch (e) {
        console.warn("⚠️ Preferred MIME failed, falling back:", e.message);
        mediaRecorder = new MediaRecorder(cameraStream);
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
        isRecordingRef.current = true;
        setIsRecording(true);
        console.log(" Video MediaRecorder started");
      };

      mediaRecorder.onstop = () => {
        if (hasStoppedRef.current) return;
        hasStoppedRef.current = true;
        isRecordingRef.current = false;
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
        console.error("❌ Video MediaRecorder error:", event.error);
        isRequestingSessionRef.current = false;
        isRecordingRef.current = false;
        setIsRecording(false);
      };

      // ── Session init ──────────────────────────────────────────────────────
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
          socketRef.current.off("video_recording_error", errHandler);
          // Don't block recording on server timeout
          console.warn("⚠️ Server confirmation timeout — proceeding");
          videoSessionReadyRef.current = true;
          isRequestingSessionRef.current = false;
          resolve();
        }, 10_000);

        const handler = (res) => {
          if (res?.videoType && res.videoType !== "primary_camera") return;
          clearTimeout(timeout);
          socketRef.current.off("video_recording_error", errHandler);
          videoSessionReadyRef.current = true;
          isRequestingSessionRef.current = false;
          resolve(res);
        };
        const errHandler = (err) => {
          if (err?.videoType && err.videoType !== "primary_camera") return;
          clearTimeout(timeout);
          socketRef.current.off("video_recording_ready", handler);
          reject(new Error(err.error ?? "Server error"));
        };

        socketRef.current.on("video_recording_ready", handler);
        socketRef.current.on("video_recording_error", errHandler);
      });

      mediaRecorder.start(CHUNK_DURATION);
      console.log(" Primary camera recording started");
    } catch (err) {
      console.error("❌ Video recording setup error:", err);
      isRequestingSessionRef.current = false;
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  }, [cameraStream, socketRef]); // ref guard replaces isRecording dep

  // ─────────────────────────────────────────────────────────────────────────
  // stopRecording
  // ─────────────────────────────────────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    // LiveKit egress mode — server stops egress; flip flag locally
    if (LIVEKIT_MODE && !mediaRecorderRef.current) {
      isRecordingRef.current = false;
      setIsRecording(false);
      console.log("🛑 Video: LiveKit egress will be stopped by server");
      return null;
    }
    if (!isRecordingRef.current || !mediaRecorderRef.current) return null;
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      recorder.onstop = () => {
        isRecordingRef.current = false;
        setIsRecording(false);
        videoSessionReadyRef.current = false;
        resolve(chunkCountRef.current);
      };
      if (recorder.state !== "inactive") recorder.stop();
      else recorder.onstop();
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // cleanup
  // ─────────────────────────────────────────────────────────────────────────
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
    isRecordingRef.current = false;
    setIsRecording(false);
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
