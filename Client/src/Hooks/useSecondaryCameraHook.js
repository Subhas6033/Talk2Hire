import { useRef, useState, useCallback, useEffect } from "react";

const CHUNK_DURATION = 20000;

/**
 * KEY FIX: Hook now accepts an optional `preWarmVideoId` constructor argument.
 * When provided, startRecording() skips emitting video_recording_start and
 * immediately begins chunking to the already-confirmed server session.
 *
 * Additionally, startRecording() now accepts an existing MediaStream as its
 * first argument. When the caller passes the stream that was already acquired
 * during InterviewSetup, we skip requestScreenShare() entirely — no browser
 * dialog, no extra latency, the preview <video> in InterviewLive continues
 * showing without interruption.
 */
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

  // Capture preWarmVideoId in a ref so the callback closure is always fresh
  const preWarmVideoIdRef = useRef(preWarmVideoId);
  useEffect(() => {
    preWarmVideoIdRef.current = preWarmVideoId;
  }, [preWarmVideoId]);

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
          ` Screen MIME type: ${mimeType || "default"} @ ${bitrate}bps`,
        );
        return { mimeType: mimeType || "default", bitrate, options };
      } catch {
        continue;
      }
    }
    return null;
  };

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
      console.log(" Screen share granted");
      screenStreamRef.current = stream;
      setScreenStream(stream);
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
   * Start screen recording.
   *
   * @param {MediaStream|null} existingStream  Pass the stream already acquired
   *   during InterviewSetup so we skip the getDisplayMedia() dialog entirely.
   *   If null/undefined, requestScreenShare() is called as before.
   */
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
        console.log("⚠️ Already requesting screen recording session");
        return;
      }

      try {
        console.log("🖥️ Starting screen recording...");
        isRequestingSessionRef.current = true;
        hasStoppedRef.current = false;
        screenSessionReadyRef.current = false;
        chunkCountRef.current = 0;

        // KEY FIX: Use the pre-acquired stream if provided; skip getDisplayMedia
        let stream;
        if (existingStream && existingStream.active) {
          console.log(
            "♻️ Reusing pre-acquired screen stream (no browser dialog)",
          );
          stream = existingStream;
          screenStreamRef.current = stream;
          setScreenStream(stream);
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
          console.error("❌ Screen video track is not live");
          isRequestingSessionRef.current = false;
          return;
        }

        const mimeConfig = findSupportedMimeType(stream);
        if (!mimeConfig) {
          throw new Error(
            "No supported video MIME type found for screen recording.",
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
              "Failed to initialize screen recorder: " + finalError.message,
            );
            return;
          }
        }

        mediaRecorderRef.current = mediaRecorder;

        videoTrack.onended = () => {
          console.log("🛑 User stopped screen sharing from browser UI");
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
          console.log(" Screen MediaRecorder started");
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

        // KEY FIX: Pre-warmed path — session already confirmed, skip round-trip
        if (preWarmVideoIdRef.current) {
          console.log(
            "♻️ Screen recording session pre-warmed, skipping registration. videoId:",
            preWarmVideoIdRef.current,
          );
          screenSessionReadyRef.current = true;
          isRequestingSessionRef.current = false;
        } else {
          // Fallback: request a new server session
          console.log("📤 Requesting screen recording session from server...");
          socketRef.current.emit("video_recording_start", {
            videoType: "screen_recording",
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
                  "Server timeout waiting for screen recording confirmation",
                ),
              );
            }, 10000);

            const handler = (response) => {
              if (response.videoType !== "screen_recording") return;
              clearTimeout(timeout);
              socketRef.current.off("video_recording_error", errorHandler);
              console.log(
                " Server confirmed screen recording ready:",
                response,
              );
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
          console.log(" Screen session confirmed, starting MediaRecorder");
          screenSessionReadyRef.current = true;
          isRequestingSessionRef.current = false;
        }

        mediaRecorder.start(CHUNK_DURATION);
      } catch (err) {
        console.error("❌ Screen recording setup error:", err);
        isRequestingSessionRef.current = false;
        setIsRecording(false);
        alert("Failed to setup screen recording: " + err.message);
      }
    },
    [isRecording, socketRef, requestScreenShare],
  );

  const stopRecording = useCallback(async () => {
    console.log("🛑 Attempting to stop screen recording...");

    if (!mediaRecorderRef.current) {
      console.log("⚠️ No media recorder to stop");
      const s = screenStreamRef.current;
      if (s && s.active) {
        s.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
        setScreenStream(null);
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
        console.log(" Stop command sent to recorder");
      } catch (error) {
        console.error("❌ Error stopping recorder:", error);
        mediaRecorderRef.current = null;
        resolve(null);
      }
    });
  }, []);

  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up screen recording");

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
