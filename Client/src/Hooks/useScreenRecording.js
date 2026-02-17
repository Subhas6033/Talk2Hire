import { useRef, useState, useCallback, useEffect } from "react";

const CHUNK_DURATION = 20000;

function isMobileBrowser() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

function findSupportedMimeType() {
  const candidates = [
    { type: "video/webm;codecs=vp9", bitrate: 2500000 },
    { type: "video/webm;codecs=vp8", bitrate: 2500000 },
    { type: "video/webm;codecs=h264", bitrate: 2500000 },
    { type: "video/webm", bitrate: 2500000 },
    { type: "video/webm", bitrate: 1500000 },
    { type: "video/mp4", bitrate: 2500000 },
    { type: "", bitrate: 1000000 },
  ];

  for (const { type, bitrate } of candidates) {
    if (type === "" || MediaRecorder.isTypeSupported(type)) {
      const options = {};
      if (type) options.mimeType = type;
      if (bitrate) options.videoBitsPerSecond = bitrate;
      console.log(
        `✅ Screen MIME: ${type || "browser default"} @ ${bitrate}bps`,
      );
      return { mimeType: type || "default", bitrate, options };
    }
  }
  return null;
}

const useScreenRecording = (
  interviewId,
  userId,
  socketRef,
  preWarmVideoId = null,
) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [screenStream, setScreenStream] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunkCountRef = useRef(0);
  const screenSessionReadyRef = useRef(false);
  const isRequestingSessionRef = useRef(false);
  const hasStoppedRef = useRef(false);
  const screenStreamRef = useRef(null);

  const preWarmVideoIdRef = useRef(preWarmVideoId);
  useEffect(() => {
    preWarmVideoIdRef.current = preWarmVideoId;
  }, [preWarmVideoId]);

  // ── requestScreenShare ──────────────────────────────────────────────────────
  const requestScreenShare = useCallback(async () => {
    if (isMobileBrowser()) {
      console.log("📱 Mobile — screen sharing not supported");
      return null;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      console.warn("⚠️ getDisplayMedia not available");
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          cursor: "always",
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });
      screenStreamRef.current = stream;
      setScreenStream(stream);
      return stream;
    } catch (error) {
      console.error("❌ Screen share denied:", error);
      if (error.name === "NotAllowedError")
        alert("Screen sharing permission denied.");
      else alert("Failed to start screen sharing: " + error.message);
      return null;
    }
  }, []);

  // ── startRecording ──────────────────────────────────────────────────────────
  const startRecording = useCallback(
    async (existingStream = null) => {
      if (isRecording) {
        console.log("⚠️ Screen recording already in progress");
        return;
      }

      if (!socketRef?.current?.connected) {
        console.error("❌ Socket not connected, retrying in 2s...");
        setTimeout(() => {
          if (socketRef?.current?.connected) startRecording(existingStream);
        }, 2000);
        return;
      }
      if (isRequestingSessionRef.current) {
        console.log("⚠️ Already requesting session");
        return;
      }

      try {
        console.log("🖥️ Starting screen recording...");
        isRequestingSessionRef.current = true;
        hasStoppedRef.current = false;
        screenSessionReadyRef.current = false;
        chunkCountRef.current = 0;

        let stream;
        if (existingStream && existingStream.active) {
          stream = existingStream;
          screenStreamRef.current = stream;
          if (screenStream !== stream) setScreenStream(stream);
        } else {
          stream = screenStreamRef.current;
          if (!stream || !stream.active) {
            stream = await requestScreenShare();
            if (!stream) {
              isRequestingSessionRef.current = false;
              return;
            }
          }
        }

        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack || videoTrack.readyState !== "live") {
          console.error(
            "❌ Screen video track not live:",
            videoTrack?.readyState,
          );
          isRequestingSessionRef.current = false;
          return;
        }

        const mimeConfig = findSupportedMimeType();
        if (!mimeConfig) {
          throw new Error("No supported video MIME type found.");
        }

        let mediaRecorder;
        try {
          mediaRecorder = new MediaRecorder(stream, mimeConfig.options);
        } catch (e) {
          console.warn("⚠️ Preferred MIME failed, falling back:", e.message);
          mediaRecorder = new MediaRecorder(stream);
        }
        mediaRecorderRef.current = mediaRecorder;

        videoTrack.onended = () => {
          console.log("🛑 User stopped screen sharing");
          if (mediaRecorderRef.current?.state !== "inactive") stopRecording();
        };

        mediaRecorder.ondataavailable = (event) => {
          if (!event.data || event.data.size === 0) return;
          chunkCountRef.current++;
          const chunkNum = chunkCountRef.current;
          const reader = new FileReader();
          reader.onloadend = () => {
            if (socketRef.current?.connected && screenSessionReadyRef.current) {
              socketRef.current.emit("video_chunk", {
                videoType: "screen_recording",
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
          console.log("✅ Screen MediaRecorder started");
          setIsRecording(true);
        };

        // FIX: Do NOT stop stream tracks in onstop.
        //
        // Previously this handler called s.getTracks().forEach(t => t.stop()),
        // which killed the MediaStream that InterviewLive's <video> was still
        // displaying. The track's readyState became "ended" before
        // attachScreenVideo() could attach it, causing the "Screen share not
        // available" placeholder to stay visible forever.
        //
        // The stream is OWNED by InterviewSetup via streamsRef. It must remain
        // live until InterviewSetup unmounts and runs its cleanup effect.
        // Stopping tracks here was the root cause of the blank screen preview.
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
          // ✅ DO NOT stop stream tracks here — stream is owned by streamsRef/
          // InterviewSetup and must stay alive for the preview <video> element.
          // InterviewSetup's cleanup effect stops the tracks on page unmount.
          screenStreamRef.current = null;
          setScreenStream(null);
        };

        mediaRecorder.onerror = (event) => {
          console.error("❌ Screen MediaRecorder error:", event.error);
          isRequestingSessionRef.current = false;
          setIsRecording(false);
        };

        if (preWarmVideoIdRef.current) {
          console.log(
            "♻️ Screen session pre-warmed:",
            preWarmVideoIdRef.current,
          );
          screenSessionReadyRef.current = true;
          isRequestingSessionRef.current = false;
        } else {
          socketRef.current.emit("video_recording_start", {
            videoType: "screen_recording",
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
              reject(new Error("Server timeout for screen recording"));
            }, 10000);
            const handler = (res) => {
              if (res.videoType !== "screen_recording") return;
              clearTimeout(timeout);
              socketRef.current.off("video_recording_error", errorHandler);
              resolve(res);
            };
            const errorHandler = (err) => {
              if (err.videoType !== "screen_recording") return;
              clearTimeout(timeout);
              socketRef.current.off("video_recording_ready", handler);
              reject(new Error(err.error || "Server error"));
            };
            socketRef.current.on("video_recording_ready", handler);
            socketRef.current.on("video_recording_error", errorHandler);
          });
          screenSessionReadyRef.current = true;
          isRequestingSessionRef.current = false;
        }

        mediaRecorder.start(CHUNK_DURATION);
      } catch (err) {
        console.error("❌ Screen recording setup error:", err);
        isRequestingSessionRef.current = false;
        setIsRecording(false);
      }
    },
    [isRecording, socketRef, requestScreenShare, screenStream],
  );

  // ── stopRecording ───────────────────────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) {
      // Nothing to stop — but do NOT touch the stream tracks here either.
      // The stream is owned by InterviewSetup.
      return null;
    }
    if (mediaRecorderRef.current.state === "inactive") return null;

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      const orig = recorder.onstop;
      recorder.onstop = (e) => {
        if (orig) orig(e);
        mediaRecorderRef.current = null;
        resolve(chunkCountRef.current);
      };
      try {
        recorder.stop();
      } catch (err) {
        console.error("❌ Error stopping recorder:", err);
        mediaRecorderRef.current = null;
        resolve(null);
      }
    });
  }, []);

  // ── cleanup ─────────────────────────────────────────────────────────────────
  // Called on unmount — here it IS correct to stop tracks because the component
  // that owns the stream (InterviewSetup) is also unmounting at this point.
  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    mediaRecorderRef.current = null;
    // Only stop tracks in cleanup (unmount), never in onstop.
    const s = screenStreamRef.current;
    if (s?.active) {
      s.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });
      screenStreamRef.current = null;
      setScreenStream(null);
    }
    chunkCountRef.current = 0;
    screenSessionReadyRef.current = false;
    isRequestingSessionRef.current = false;
    hasStoppedRef.current = false;
    setIsRecording(false);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

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
