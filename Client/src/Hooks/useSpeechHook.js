import { useRef, useCallback, useEffect } from "react";

const TTS_SAMPLE_RATE = 48000;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const INITIAL_BUFFER_S = 0.05; // 50ms head-start — reduced from 80ms for lower latency

/**
 * Wrap raw PCM16-LE bytes in a WAV header so decodeAudioData() can parse them.
 * Without this header the browser throws "Unable to decode audio data" because
 * it doesn't know sample rate, channel count, or encoding.
 */
function pcm16ToWav(
  pcmBuffer,
  sampleRate = TTS_SAMPLE_RATE,
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
  view.setUint32(4, wavLen - 8, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // AudioFormat = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeStr(36, "data");
  view.setUint32(40, dataLen, true);
  new Uint8Array(wav, 44).set(new Uint8Array(pcmBuffer));

  return wav;
}

export function useTTS({ onPlayStart, onPlayEnd }) {
  const ttsCtxRef = useRef(null);
  const decodedQueueRef = useRef([]);
  const pendingDecodeRef = useRef([]);
  const isDecodingRef = useRef(false);
  const nextStartTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const flushRequestedRef = useRef(false);
  const activeSourcesRef = useRef(new Set());

  const getTTSCtx = useCallback(() => {
    if (ttsCtxRef.current && ttsCtxRef.current.state !== "closed")
      return ttsCtxRef.current;

    const ctx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: "interactive",
      sampleRate: TTS_SAMPLE_RATE, // 48kHz — must match tts.service.js
    });
    ttsCtxRef.current = ctx;
    return ctx;
  }, []);

  const ensureTTSCtxRunning = useCallback(async () => {
    const ctx = getTTSCtx();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx;
  }, [getTTSCtx]);

  const scheduleNext = useCallback(() => {
    if (decodedQueueRef.current.length === 0) return;
    const ctx = ttsCtxRef.current;
    if (!ctx || ctx.state === "closed") return;

    const buffer = decodedQueueRef.current.shift();

    if (!isPlayingRef.current) {
      nextStartTimeRef.current = ctx.currentTime + INITIAL_BUFFER_S;
      isPlayingRef.current = true;
      onPlayStart?.();
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    activeSourcesRef.current.add(source);

    source.onended = () => {
      activeSourcesRef.current.delete(source);

      if (decodedQueueRef.current.length > 0) {
        scheduleNext();
        return;
      }
      if (pendingDecodeRef.current.length > 0 || isDecodingRef.current) return;

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

  // Batch-decode all pending chunks in parallel — key fix for linear16 lag
  const drainDecodeQueue = useCallback(async () => {
    if (isDecodingRef.current || pendingDecodeRef.current.length === 0) return;
    isDecodingRef.current = true;

    while (pendingDecodeRef.current.length > 0) {
      // Grab all currently pending chunks and decode them simultaneously
      const batch = pendingDecodeRef.current.splice(0);
      const ctx = await ensureTTSCtxRunning();

      const results = await Promise.all(
        batch.map(async (base64) => {
          try {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++)
              bytes[i] = binary.charCodeAt(i);

            const wavBuffer = pcm16ToWav(bytes.buffer);
            return await ctx.decodeAudioData(wavBuffer);
          } catch (err) {
            console.warn("⚠️ TTS chunk decode failed (skipped):", err.message);
            return null;
          }
        }),
      );

      // Push decoded buffers in order, schedule each one
      results.forEach((buf) => {
        if (buf) {
          decodedQueueRef.current.push(buf);
          scheduleNext();
        }
      });
    }

    isDecodingRef.current = false;

    // Edge case: flush requested but all chunks failed decode
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

  const enqueueTTSChunk = useCallback(
    (base64) => {
      if (!base64) return;
      pendingDecodeRef.current.push(base64);
      drainDecodeQueue();
    },
    [drainDecodeQueue],
  );

  const flushTTS = useCallback(() => {
    flushRequestedRef.current = true;
    if (
      !isPlayingRef.current &&
      !isDecodingRef.current &&
      pendingDecodeRef.current.length === 0 &&
      decodedQueueRef.current.length === 0
    ) {
      onPlayEnd?.();
    }
  }, [onPlayEnd]);

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
