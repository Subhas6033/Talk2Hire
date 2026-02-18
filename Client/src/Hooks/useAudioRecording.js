import { useRef, useCallback, useEffect } from "react";

// ─── Config ──────────────────────────────────────────────────────────────────
const SAMPLE_RATE = 48000;
const CHUNK_DURATION_MS = 20000; // 20-s chunks for FTP upload

// When true, the primary recording is handled by LiveKit composite egress.
// A local MediaRecorder only runs when preWarmAudioId is provided —
// that records the TTS+mic blend as the "mixed_audio" FTP track.
const LIVEKIT_MODE = true;

// ─── Hook ─────────────────────────────────────────────────────────────────────
const useAudioRecording = (socketRef, interviewId, userId) => {
  // WebAudio graph nodes
  const audioContextRef = useRef(null);
  const destinationRef = useRef(null);
  const ttsGainRef = useRef(null);
  const micGainRef = useRef(null);
  const micSourceRef = useRef(null);

  // Local MediaRecorder (mixed_audio – optional in LiveKit mode)
  const mediaRecorderRef = useRef(null);
  const chunkNumberRef = useRef(0);
  const audioSessionIdRef = useRef(null);
  const isRecordingRef = useRef(false); // use ref to avoid stale closure

  // ─────────────────────────────────────────────────────────────────────────
  // setAudioContext
  // Wire the entire recording graph into the SHARED AudioContext that is
  // also used for TTS playback. This must be called before startRecording.
  // ─────────────────────────────────────────────────────────────────────────
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

    console.log(" Audio recording graph wired", {
      sampleRate: sharedCtx.sampleRate,
      state: sharedCtx.state,
      livekitMode: LIVEKIT_MODE,
    });
  }, []);

  // Standalone init (fallback — useInterview normally calls setAudioContext)
  const initializeAudioRecording = useCallback(async () => {
    if (audioContextRef.current) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    await setAudioContext(ctx);
  }, [setAudioContext]);

  // ─────────────────────────────────────────────────────────────────────────
  // connectTTSAudio
  // Called by the TTS scheduler just BEFORE source.start() so each TTS
  // buffer is also captured in the mixed_audio FTP track.
  // ─────────────────────────────────────────────────────────────────────────
  const connectTTSAudio = useCallback((sourceNode) => {
    if (!ttsGainRef.current) return; // graph not ready – skip silently
    try {
      sourceNode.connect(ttsGainRef.current);
    } catch (err) {
      // InvalidStateError = node already disconnected — safe to ignore
      if (
        err.name !== "InvalidStateError" &&
        err.name !== "NotSupportedError"
      ) {
        console.error("❌ connectTTSAudio:", err);
      }
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // connectMicrophoneAudio
  // Accepts either a MediaStreamTrack (LiveKit LocalAudioTrack.mediaStreamTrack)
  // or a plain MediaStream (getUserMedia fallback).
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // startRecording
  //
  // LiveKit mode without preWarmAudioId:
  //   Egress handles everything → just flip the flag.
  //
  // LiveKit mode WITH preWarmAudioId (or legacy mode):
  //   Run a local MediaRecorder on the TTS+mic mix and upload chunks via
  //   socket as "mixed_audio" (the FTP blended track).
  // ─────────────────────────────────────────────────────────────────────────
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
        console.log("🎙️ Starting local mixed_audio MediaRecorder…");
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

        // Session ID — prefer pre-warmed, then request from server
        if (preWarmAudioId) {
          audioSessionIdRef.current = preWarmAudioId;
          console.log("♻️ Reusing pre-warmed audio session:", preWarmAudioId);
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
              console.log(" Audio session confirmed:", res.audioId);
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
          console.log(" Audio MediaRecorder started");
        };

        recorder.onstop = () => {
          isRecordingRef.current = false;
          console.log(
            `🛑 Audio MediaRecorder stopped (${chunkNumberRef.current} chunks)`,
          );
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

  // ─────────────────────────────────────────────────────────────────────────
  // stopRecording
  // ─────────────────────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (LIVEKIT_MODE && !mediaRecorderRef.current) {
      isRecordingRef.current = false;
      console.log("🛑 Audio: LiveKit egress will be stopped by server");
      return;
    }
    if (!isRecordingRef.current || !mediaRecorderRef.current) return;
    console.log("🛑 Stopping audio MediaRecorder…");
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
