import { useRef, useCallback, useEffect } from "react";
const SAMPLE_RATE = 48000;
const CHUNK_DURATION_MS = 20000;
const LIVEKIT_MODE = true;

const useAudioRecording = (socketRef, interviewId, userId) => {
  const audioContextRef = useRef(null);
  const destinationRef = useRef(null);
  const ttsGainRef = useRef(null);
  const micGainRef = useRef(null);
  const micSourceRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const chunkNumberRef = useRef(0);
  const audioSessionIdRef = useRef(null);
  const isRecordingRef = useRef(false);

  const setAudioContext = useCallback(async (sharedCtx) => {
    if (audioContextRef.current === sharedCtx) return;
    audioContextRef.current = sharedCtx;
    if (sharedCtx.state === "suspended") await sharedCtx.resume();

    const destination = sharedCtx.createMediaStreamDestination();
    destinationRef.current = destination;

    const ttsGain = sharedCtx.createGain();
    const micGain = sharedCtx.createGain();
    ttsGain.gain.value = 1.0;
    micGain.gain.value = 1.0;
    ttsGainRef.current = ttsGain;
    micGainRef.current = micGain;

    ttsGain.connect(destination);
    micGain.connect(destination);

    console.log("✅ Audio recording graph wired", {
      sampleRate: sharedCtx.sampleRate,
      state: sharedCtx.state,
      livekitMode: LIVEKIT_MODE,
    });
  }, []);

  const initializeAudioRecording = useCallback(async () => {
    if (audioContextRef.current) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE }); // 48000
    await setAudioContext(ctx);
  }, [setAudioContext]);

  const connectTTSAudio = useCallback((sourceNode) => {
    if (!ttsGainRef.current) return;
    try {
      sourceNode.connect(ttsGainRef.current);
    } catch (err) {
      if (
        err.name !== "InvalidStateError" &&
        err.name !== "NotSupportedError"
      ) {
        console.error("❌ connectTTSAudio:", err);
      }
    }
  }, []);

  const connectMicrophoneAudio = useCallback(async (micStreamOrTrack) => {
    if (!audioContextRef.current || !micGainRef.current) {
      console.warn("⚠️ Audio graph not ready for mic connection");
      return;
    }
    try {
      if (micSourceRef.current) {
        try {
          micSourceRef.current.disconnect();
        } catch (_) {}
        micSourceRef.current = null;
      }
      const stream =
        micStreamOrTrack instanceof MediaStreamTrack
          ? new MediaStream([micStreamOrTrack])
          : micStreamOrTrack;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(micGainRef.current);
      micSourceRef.current = source;
      console.log("🎤 Mic connected to recording mix");
    } catch (err) {
      console.error("❌ connectMicrophoneAudio:", err);
    }
  }, []);

  const startRecording = useCallback(
    async (preWarmAudioId = null) => {
      if (LIVEKIT_MODE && !preWarmAudioId) {
        isRecordingRef.current = true;
        console.log("🎙️ Audio: LiveKit egress active — local recorder skipped");
        return;
      }

      if (!destinationRef.current) {
        console.error("❌ Cannot start recorder — audio graph not wired");
        return;
      }
      if (isRecordingRef.current) {
        console.warn("⚠️ Already recording audio");
        return;
      }

      try {
        const stream = destinationRef.current.stream;
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        const recorder = new MediaRecorder(stream, {
          mimeType,
          audioBitsPerSecond: 128_000,
        });
        mediaRecorderRef.current = recorder;
        chunkNumberRef.current = 0;

        if (preWarmAudioId) {
          audioSessionIdRef.current = preWarmAudioId;
        } else if (socketRef?.current?.connected) {
          socketRef.current.emit("audio_recording_start", {
            audioType: "mixed_audio",
            interviewId,
            userId,
            metadata: {
              mimeType,
              audioBitsPerSecond: 128_000,
              sampleRate: SAMPLE_RATE,
            },
          });
          await new Promise((resolve) => {
            const t = setTimeout(resolve, 5000);
            socketRef.current.once("audio_recording_ready", (res) => {
              clearTimeout(t);
              audioSessionIdRef.current = res.audioId;
              resolve();
            });
          });
        }

        recorder.ondataavailable = (event) => {
          if (!event.data || event.data.size === 0) return;
          chunkNumberRef.current++;
          const chunkNum = chunkNumberRef.current;
          const reader = new FileReader();
          reader.onloadend = () => {
            if (socketRef?.current?.connected) {
              socketRef.current.emit("audio_chunk", {
                audioType: "mixed_audio",
                audioId: audioSessionIdRef.current,
                chunkNumber: chunkNum,
                chunkData: reader.result.split(",")[1],
                timestamp: Date.now(),
                interviewId,
                userId,
              });
            }
          };
          reader.readAsDataURL(event.data);
        };

        recorder.onstart = () => {
          isRecordingRef.current = true;
        };
        recorder.onstop = () => {
          isRecordingRef.current = false;
          if (socketRef?.current?.connected) {
            socketRef.current.emit("audio_recording_stop", {
              audioType: "mixed_audio",
              audioId: audioSessionIdRef.current,
              totalChunks: chunkNumberRef.current,
              interviewId,
              userId,
            });
          }
        };
        recorder.onerror = (e) =>
          console.error("❌ Audio recorder error:", e.error);
        recorder.start(CHUNK_DURATION_MS);
      } catch (err) {
        console.error("❌ Failed to start audio recording:", err);
        throw err;
      }
    },
    [socketRef, interviewId, userId],
  );

  const stopRecording = useCallback(() => {
    if (LIVEKIT_MODE && !mediaRecorderRef.current) {
      isRecordingRef.current = false;
      return;
    }
    if (!isRecordingRef.current || !mediaRecorderRef.current) return;
    try {
      if (mediaRecorderRef.current.state !== "inactive")
        mediaRecorderRef.current.stop();
    } catch (err) {
      console.error("❌ Error stopping audio recorder:", err);
    }
    if (micSourceRef.current) {
      try {
        micSourceRef.current.disconnect();
      } catch (_) {}
      micSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (isRecordingRef.current) stopRecording();
      if (micSourceRef.current) {
        try {
          micSourceRef.current.disconnect();
        } catch (_) {}
      }
    };
  }, [stopRecording]);

  return {
    setAudioContext,
    initializeAudioRecording,
    connectTTSAudio,
    connectMicrophoneAudio,
    startRecording,
    stopRecording,
    get isRecording() {
      return isRecordingRef.current;
    },
  };
};

export default useAudioRecording;
