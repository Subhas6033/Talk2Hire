import { useRef, useCallback, useEffect } from "react";

const SAMPLE_RATE = 48000;
const CHUNK_DURATION_MS = 20000;

/**
 * Audio recording hook — captures TTS + mic into a single mixed stream.
 *
 * ROOT-CAUSE FIX (TTS lag / recording desync):
 *
 * Previously this hook created its OWN AudioContext internally. The scheduler
 * in useInterviewHook created a SECOND AudioContext. Two AudioContext instances
 * have independent clocks — passing `startAt` from one clock to the other is
 * meaningless and causes drift/silence in the recording mix.
 *
 * Fix: the hook no longer owns an AudioContext. useInterviewHook creates ONE
 * context and immediately calls audioRecording.setAudioContext(ctx). Both
 * hooks now share a single clock.
 *
 * connectTTSAudio — new signature:
 *   Receives the ALREADY-STARTED BufferSourceNode from the scheduler (not an
 *   AudioBuffer). We simply connect that same node to the ttsGainNode so the
 *   recording mix gets the audio at exactly the right time. Zero extra sources,
 *   zero drift, zero duplicate playback.
 */
const useAudioRecording = (socketRef, interviewId, userId) => {
  const audioContextRef = useRef(null); // shared — injected via setAudioContext
  const destinationRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  const ttsGainNodeRef = useRef(null);
  const micGainNodeRef = useRef(null);
  const micSourceRef = useRef(null);

  const chunkNumberRef = useRef(0);
  const isRecordingRef = useRef(false);
  const audioSessionIdRef = useRef(null);

  /**
   * Wire up the recording graph into the caller's shared AudioContext.
   * Called once by useInterviewHook immediately after it creates its ctx.
   */
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
    ttsGainNodeRef.current = ttsGain;
    micGainNodeRef.current = micGain;

    ttsGain.connect(destination);
    micGain.connect(destination);

    console.log("✅ Audio recording graph wired into shared AudioContext", {
      sampleRate: sharedCtx.sampleRate,
      state: sharedCtx.state,
    });
  }, []);

  /**
   * Legacy init — no-op if setAudioContext() already ran, fallback otherwise.
   */
  const initializeAudioRecording = useCallback(async () => {
    if (audioContextRef.current) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    await setAudioContext(ctx);
  }, [setAudioContext]);

  /**
   * connectTTSAudio — ROOT-CAUSE FIX
   *
   * @param {AudioBufferSourceNode} sourceNode
   *   The node the scheduler already created and started. We just tap into it.
   *
   * Do NOT call source.start() here — the scheduler already did that.
   * Connecting an already-started node to a new destination is valid and
   * causes no audible change; the destination simply starts receiving the
   * in-progress audio from that point forward, which is exactly what we want
   * for the recording mix.
   */
  const connectTTSAudio = useCallback((sourceNode) => {
    if (!ttsGainNodeRef.current) {
      console.warn(
        "⚠️ ttsGainNode not ready — TTS chunk not routed to recording",
      );
      return;
    }
    try {
      sourceNode.connect(ttsGainNodeRef.current);
    } catch (err) {
      if (
        err.name !== "InvalidStateError" &&
        err.name !== "NotSupportedError"
      ) {
        console.error("❌ connectTTSAudio error:", err);
      }
    }
  }, []);

  /**
   * Connect microphone stream to the recording mix.
   */
  const connectMicrophoneAudio = useCallback(async (micStream) => {
    if (!audioContextRef.current || !micGainNodeRef.current) {
      console.warn("⚠️ Audio context not ready for mic connection");
      return;
    }
    try {
      if (micSourceRef.current) micSourceRef.current.disconnect();
      const micSource =
        audioContextRef.current.createMediaStreamSource(micStream);
      micSource.connect(micGainNodeRef.current);
      micSourceRef.current = micSource;
      console.log("🎤 Microphone audio connected to recording mix");
    } catch (error) {
      console.error("❌ Failed to connect microphone audio:", error);
    }
  }, []);

  /**
   * Start recording the mixed audio stream.
   *
   * @param {string|null} preWarmAudioId
   *   Session ID pre-registered during InterviewSetup step 7.
   *   When provided, skips the audio_recording_start round-trip entirely.
   */
  const startRecording = useCallback(
    async (preWarmAudioId = null) => {
      if (!destinationRef.current) {
        console.error(
          "❌ Cannot start recording — destination not initialized",
        );
        return;
      }
      if (isRecordingRef.current) {
        console.warn("⚠️ Already recording");
        return;
      }

      try {
        console.log("🎙️ Starting audio recording...");

        const stream = destinationRef.current.stream;
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          audioBitsPerSecond: 128000,
        });

        mediaRecorderRef.current = mediaRecorder;
        chunkNumberRef.current = 0;

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
              audioBitsPerSecond: 128000,
              sampleRate: SAMPLE_RATE,
            },
          });
          await new Promise((resolve) => {
            const timeout = setTimeout(resolve, 5000);
            socketRef.current.once("audio_recording_ready", (response) => {
              clearTimeout(timeout);
              audioSessionIdRef.current = response.audioId;
              console.log("✅ Audio session confirmed:", response.audioId);
              resolve();
            });
          });
        }

        mediaRecorder.ondataavailable = (event) => {
          if (!event.data || event.data.size === 0) return;
          chunkNumberRef.current++;
          const currentChunk = chunkNumberRef.current;
          const reader = new FileReader();
          reader.onloadend = () => {
            if (socketRef?.current?.connected) {
              socketRef.current.emit("audio_chunk", {
                audioType: "mixed_audio",
                audioId: audioSessionIdRef.current,
                chunkNumber: currentChunk,
                chunkData: reader.result.split(",")[1],
                timestamp: Date.now(),
                interviewId,
                userId,
              });
            }
          };
          reader.readAsDataURL(event.data);
        };

        mediaRecorder.onstart = () => {
          console.log("✅ Audio recording started");
          isRecordingRef.current = true;
        };

        mediaRecorder.onstop = () => {
          console.log("🛑 Audio recording stopped");
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

        mediaRecorder.onerror = (e) =>
          console.error("❌ Audio recorder error:", e.error);

        mediaRecorder.start(CHUNK_DURATION_MS);
        console.log(
          `✅ Audio MediaRecorder started (${CHUNK_DURATION_MS}ms chunks)`,
        );
      } catch (error) {
        console.error("❌ Failed to start audio recording:", error);
        throw error;
      }
    },
    [socketRef, interviewId, userId],
  );

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current || !mediaRecorderRef.current) return;
    console.log("🛑 Stopping audio recording...");
    try {
      if (mediaRecorderRef.current.state !== "inactive")
        mediaRecorderRef.current.stop();
      if (micSourceRef.current) {
        micSourceRef.current.disconnect();
        micSourceRef.current = null;
      }
    } catch (error) {
      console.error("❌ Error stopping audio recording:", error);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (isRecordingRef.current) stopRecording();
      if (micSourceRef.current) micSourceRef.current.disconnect();
      // Do NOT close the AudioContext — it is owned by useInterviewHook
    };
  }, [stopRecording]);

  return {
    setAudioContext, // ← new: call this first with the shared ctx
    initializeAudioRecording, // ← kept for compatibility / standalone use
    connectTTSAudio, // ← now takes a BufferSourceNode, not a buffer
    connectMicrophoneAudio,
    startRecording,
    stopRecording,
    isRecording: isRecordingRef.current,
  };
};

export default useAudioRecording;
