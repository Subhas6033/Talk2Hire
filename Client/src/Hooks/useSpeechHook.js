import { useRef, useCallback, useEffect } from "react";

const SAMPLE_RATE = 48000; // Must match tts.service.js sample_rate
const NUM_CHANNELS = 1; // Mono
const BITS_PER_SAMPLE = 16; // linear16
const INITIAL_BUFFER_S = 0.08; // Head-start before first chunk plays (80ms)

/**
 * Wraps a raw PCM16-LE ArrayBuffer in a minimal 44-byte WAV header so that
 * AudioContext.decodeAudioData() can parse it.
 * Without this header, decodeAudioData throws "Unable to decode audio data"
 * on every chunk because it doesn't know the sample rate, channels, or encoding.
 */
function pcm16ToWav(
  pcmBuffer,
  sampleRate = SAMPLE_RATE,
  numChannels = NUM_CHANNELS,
) {
  const dataLen = pcmBuffer.byteLength;
  const wavLen = 44 + dataLen;
  const wav = new ArrayBuffer(wavLen);
  const view = new DataView(wav);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++)
      view.setUint8(offset + i, str.charCodeAt(i));
  };

  const byteRate = (sampleRate * numChannels * BITS_PER_SAMPLE) / 8;
  const blockAlign = (numChannels * BITS_PER_SAMPLE) / 8;

  writeStr(0, "RIFF");
  view.setUint32(4, wavLen - 8, true); // File size - 8
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size (PCM = 16)
  view.setUint16(20, 1, true); // AudioFormat = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeStr(36, "data");
  view.setUint32(40, dataLen, true);

  // Copy raw PCM bytes after the 44-byte header
  new Uint8Array(wav, 44).set(new Uint8Array(pcmBuffer));

  return wav;
}

export function useTTS({ onPlayStart, onPlayEnd }) {
  // Isolated AudioContext — never shared with recording/mic graph → no echo
  const ttsCtxRef = useRef(null);

  // Decoded AudioBuffers ready to be scheduled
  const decodedQueueRef = useRef([]);

  // Incoming base64 raw-PCM chunks waiting to be decoded
  const pendingDecodeRef = useRef([]);

  // Decoder is busy
  const isDecodingRef = useRef(false);

  // Next scheduled start time in AudioContext timeline
  const nextStartTimeRef = useRef(0);

  // Whether any source node is currently scheduled/playing
  const isPlayingRef = useRef(false);

  // Whether tts_end has been received (signals no more chunks coming)
  const flushRequestedRef = useRef(false);

  // All live BufferSourceNodes — so resetTTS() can stop them immediately
  const activeSourcesRef = useRef(new Set());

  // ── Create / reuse the TTS AudioContext ─────────────────────────────────────
  const getTTSCtx = useCallback(() => {
    if (ttsCtxRef.current && ttsCtxRef.current.state !== "closed")
      return ttsCtxRef.current;

    const ctx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: "interactive",
      sampleRate: SAMPLE_RATE, // 48kHz — must match tts.service.js
    });
    ttsCtxRef.current = ctx;
    return ctx;
  }, []);

  const ensureTTSCtxRunning = useCallback(async () => {
    const ctx = getTTSCtx();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx;
  }, [getTTSCtx]);

  // ── Schedule the next decoded AudioBuffer ────────────────────────────────────
  const scheduleNext = useCallback(() => {
    if (decodedQueueRef.current.length === 0) return;

    const ctx = ttsCtxRef.current;
    if (!ctx || ctx.state === "closed") return;

    const buffer = decodedQueueRef.current.shift();

    if (!isPlayingRef.current) {
      // First chunk: anchor the timeline with a small head-start
      nextStartTimeRef.current = ctx.currentTime + INITIAL_BUFFER_S;
      isPlayingRef.current = true;
      onPlayStart?.();
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination); // Speaker output only — not recording graph
    activeSourcesRef.current.add(source);

    source.onended = () => {
      activeSourcesRef.current.delete(source);

      // More decoded buffers ready → schedule immediately (zero gap)
      if (decodedQueueRef.current.length > 0) {
        scheduleNext();
        return;
      }

      // Still decoding — decoder will call scheduleNext when it has a buffer
      if (pendingDecodeRef.current.length > 0 || isDecodingRef.current) return;

      // Fully drained
      if (flushRequestedRef.current) {
        isPlayingRef.current = false;
        nextStartTimeRef.current = 0;
        flushRequestedRef.current = false;
        onPlayEnd?.();
      }
    };

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
  }, [onPlayStart, onPlayEnd]);

  // ── Decode pending base64 chunks → AudioBuffers ──────────────────────────────
  const drainDecodeQueue = useCallback(async () => {
    if (isDecodingRef.current) return;
    if (pendingDecodeRef.current.length === 0) return;

    isDecodingRef.current = true;

    while (pendingDecodeRef.current.length > 0) {
      const base64 = pendingDecodeRef.current.shift();

      try {
        const ctx = await ensureTTSCtxRunning();

        // base64 → Uint8Array of raw PCM16 bytes
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        // ⬇ THE KEY FIX: wrap raw PCM16 in WAV container before decoding
        const wavBuffer = pcm16ToWav(bytes.buffer);
        const audioBuffer = await ctx.decodeAudioData(wavBuffer);

        decodedQueueRef.current.push(audioBuffer);
        scheduleNext();
      } catch (err) {
        console.warn("⚠️ TTS chunk decode failed (skipped):", err.message);
      }
    }

    isDecodingRef.current = false;

    // Edge case: flush requested but nothing ever played (e.g. all chunks bad)
    if (
      flushRequestedRef.current &&
      decodedQueueRef.current.length === 0 &&
      activeSourcesRef.current.size === 0
    ) {
      isPlayingRef.current = false;
      nextStartTimeRef.current = 0;
      flushRequestedRef.current = false;
      onPlayEnd?.();
    }
  }, [ensureTTSCtxRunning, scheduleNext, onPlayEnd]);

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Called for every tts_audio socket event.
   * Pushes the base64 raw-PCM16 chunk into the decode queue.
   */
  const enqueueTTSChunk = useCallback(
    (base64) => {
      if (!base64) return;
      pendingDecodeRef.current.push(base64);
      drainDecodeQueue();
    },
    [drainDecodeQueue],
  );

  /**
   * Called on tts_end — signals no more chunks.
   * Playback drains naturally; onPlayEnd fires after last source ends.
   */
  const flushTTS = useCallback(() => {
    flushRequestedRef.current = true;

    // Nothing was queued at all — fire end immediately
    if (
      !isPlayingRef.current &&
      !isDecodingRef.current &&
      pendingDecodeRef.current.length === 0 &&
      decodedQueueRef.current.length === 0
    ) {
      onPlayEnd?.();
    }
  }, [onPlayEnd]);

  /**
   * Hard stop — call when a new question arrives or on disconnect.
   */
  const resetTTS = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (_) {}
    });
    activeSourcesRef.current.clear();
    pendingDecodeRef.current = [];
    decodedQueueRef.current = [];
    isDecodingRef.current = false;
    isPlayingRef.current = false;
    nextStartTimeRef.current = 0;
    flushRequestedRef.current = false;
  }, []);

  // Resume TTS context after browser autoplay policy suspends it
  useEffect(() => {
    const resume = () => {
      const ctx = ttsCtxRef.current;
      if (ctx?.state === "suspended") ctx.resume();
    };
    document.addEventListener("click", resume);
    document.addEventListener("keydown", resume);
    return () => {
      document.removeEventListener("click", resume);
      document.removeEventListener("keydown", resume);
    };
  }, []);

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      resetTTS();
      if (ttsCtxRef.current && ttsCtxRef.current.state !== "closed") {
        ttsCtxRef.current.close().catch(() => {});
        ttsCtxRef.current = null;
      }
    };
  }, [resetTTS]);

  return { enqueueTTSChunk, flushTTS, resetTTS };
}
