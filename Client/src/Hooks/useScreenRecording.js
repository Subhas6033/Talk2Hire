import { useRef, useState, useCallback, useEffect } from "react";

const CHUNK_DURATION = 5000;

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
      console.log(` Screen MIME: ${type || "browser default"} @ ${bitrate}bps`);
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
  const screenStreamRef = useRef(null);

  // ── FIX A: use a ref for recording state so startRecording's guard ──────────
  // doesn't read a stale closure value from before StrictMode cleanup ran.
  const isRecordingRef = useRef(false);

  // ── FIX B: mount ID to invalidate stale onstop callbacks ────────────────────
  // Each mount gets a unique ID. onstop handlers capture the mount ID at
  // creation time and bail out if the ID no longer matches — preventing
  // mount 1's deferred onstop from wiping mount 2's recording state.
  const mountIdRef = useRef(0);

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
      // FIX A: read ref instead of stale state closure
      if (isRecordingRef.current) {
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
        screenSessionReadyRef.current = false;
        chunkCountRef.current = 0;

        // Stamp this recording session with the current mount ID
        mountIdRef.current += 1;
        const myMountId = mountIdRef.current;

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
        if (!mimeConfig) throw new Error("No supported video MIME type found.");

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
          // FIX B: ignore data from a stale mount's recorder
          if (mountIdRef.current !== myMountId) return;
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
          // FIX B: bail if this recorder belongs to a superseded mount
          if (mountIdRef.current !== myMountId) return;
          console.log(" Screen MediaRecorder started");
          isRecordingRef.current = true;
          setIsRecording(true);
        };

        mediaRecorder.onstop = () => {
          // FIX B: stale mount's onstop — do nothing, don't touch live state
          if (mountIdRef.current !== myMountId) {
            console.log("🗑️ Stale screen onstop ignored (mount superseded)");
            return;
          }
          console.log(
            `🛑 Screen recording stopped. Chunks: ${chunkCountRef.current}`,
          );
          isRecordingRef.current = false;
          setIsRecording(false);
          screenSessionReadyRef.current = false;
          if (socketRef.current?.connected) {
            socketRef.current.emit("video_recording_stop", {
              videoType: "screen_recording",
              totalChunks: chunkCountRef.current,
            });
          }
          //  Do NOT stop stream tracks — owned by InterviewSetup/streamStore.
          // Just clear the local ref.
          screenStreamRef.current = null;
          setScreenStream(null);
        };

        mediaRecorder.onerror = (event) => {
          if (mountIdRef.current !== myMountId) return;
          console.error("❌ Screen MediaRecorder error:", event.error);
          isRequestingSessionRef.current = false;
          isRecordingRef.current = false;
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
              socketRef.current.off("video_recording_ready", handler);
              socketRef.current.off("video_recording_error", errorHandler);
              screenSessionReadyRef.current = true;
              isRequestingSessionRef.current = false;
              resolve(res);
            };
            const errorHandler = (res) => {
              if (res.videoType !== "screen_recording") return;
              clearTimeout(timeout);
              socketRef.current.off("video_recording_ready", handler);
              socketRef.current.off("video_recording_error", errorHandler);
              reject(
                new Error(res.message || "Screen recording session error"),
              );
            };
            socketRef.current.on("video_recording_ready", handler);
            socketRef.current.on("video_recording_error", errorHandler);
          });
        }

        mediaRecorder.start(CHUNK_DURATION);
      } catch (err) {
        console.error("❌ Screen recording setup error:", err);
        isRequestingSessionRef.current = false;
        isRecordingRef.current = false;
        setIsRecording(false);
      }
    },
    // FIX A: removed isRecording from deps — use ref instead to avoid stale closure
    [socketRef, requestScreenShare, screenStream],
  );

  // ── stopRecording ───────────────────────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return null;
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
  // Runs on every effect teardown — including StrictMode's first-unmount.
  //
  // CRITICAL: Do NOT stop stream tracks here.
  // The stream is owned by InterviewSetup/streamStore. Stopping tracks in
  // cleanup() kills them before mount 2's attachScreenVideo() runs, leaving
  // readyState="ended" so the screen preview never shows on the real mount.
  //
  // We increment mountIdRef so that any deferred onstop callbacks from the
  // stopped MediaRecorder know they belong to a superseded mount and should
  // not update state (which now belongs to mount 2).
  const cleanup = useCallback(() => {
    mountIdRef.current += 1; // invalidate all in-flight onstop/onstart callbacks

    if (mediaRecorderRef.current?.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    mediaRecorderRef.current = null;

    //  Do NOT stop stream tracks — owned by InterviewSetup/streamStore.
    screenStreamRef.current = null;

    // Reset all flags so mount 2 starts clean
    chunkCountRef.current = 0;
    screenSessionReadyRef.current = false;
    isRequestingSessionRef.current = false;
    isRecordingRef.current = false;

    // Reset state — mount 2 will set these again via startRecording
    setIsRecording(false);
    setScreenStream(null);
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
