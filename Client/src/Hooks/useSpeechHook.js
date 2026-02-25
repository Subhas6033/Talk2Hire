import { useRef, useCallback, useEffect } from "react";

const TTS_SAMPLE_RATE = 48000;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const INITIAL_BUFFER_S = 0.002;

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
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
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

/**
 * useTTS — PCM16 audio playback hook
 *
 * Usage (wire these up in your component):
 *   const { enqueueTTSChunk, flushTTS, resetTTS } = useTTS({ onPlayStart, onPlayEnd });
 *   socket.on("tts_audio", ({ audio }) => enqueueTTSChunk(audio));
 *   socket.on("tts_end",   ()          => flushTTS(() => socket.emit("playback_done")));
 *
 * flushTTS(onDone) — fires onDone() when Web Audio queue fully drains,
 * OR after a 5s safety timeout if Web Audio never fires onended
 * (e.g. AudioContext suspended by browser autoplay policy).
 */
export function useTTS({ onPlayStart, onPlayEnd }) {
  const ttsCtxRef = useRef(null);
  const decodedQueueRef = useRef([]);
  const pendingDecodeRef = useRef([]);
  const isDecodingRef = useRef(false);
  const nextStartTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const activeSourcesRef = useRef(new Set());
  const onDoneRef = useRef(null);
  const flushRequestedRef = useRef(false);
  const doneCalledRef = useRef(false); // guards against double-fire
  const fallbackTimerRef = useRef(null);

  // ── AudioContext ────────────────────────────────────────────────────────
  const getTTSCtx = useCallback(() => {
    if (ttsCtxRef.current && ttsCtxRef.current.state !== "closed")
      return ttsCtxRef.current;
    const ctx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: "interactive",
      sampleRate: TTS_SAMPLE_RATE,
    });
    ttsCtxRef.current = ctx;
    return ctx;
  }, []);

  const ensureTTSCtxRunning = useCallback(async () => {
    const ctx = getTTSCtx();
    // Must resume BEFORE scheduling audio — suspended context won't fire onended
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (_) {}
    }
    return ctx;
  }, [getTTSCtx]);

  // ── fireDone — called exactly once when playback is complete ───────────
  const fireDone = useCallback(() => {
    if (doneCalledRef.current) return;
    doneCalledRef.current = true;

    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    isPlayingRef.current = false;
    nextStartTimeRef.current = 0;
    flushRequestedRef.current = false;

    const cb = onDoneRef.current;
    onDoneRef.current = null;

    console.log("🔊 TTS playback complete → firing onDone callback");
    try {
      cb?.();
    } catch (e) {
      console.error("❌ onDone callback error:", e);
    }

    onPlayEnd?.();
  }, [onPlayEnd]);

  // ── scheduleNext ────────────────────────────────────────────────────────
  const scheduleNext = useCallback(() => {
    if (decodedQueueRef.current.length === 0) return;
    const ctx = ttsCtxRef.current;
    if (!ctx || ctx.state === "closed") return;

    // If context is still suspended here, audio won't play — resume it
    if (ctx.state === "suspended") {
      ctx
        .resume()
        .then(() => scheduleNext())
        .catch(() => {});
      return;
    }

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
      if (flushRequestedRef.current) fireDone();
    };

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
  }, [onPlayStart, fireDone]);

  // ── drainDecodeQueue ────────────────────────────────────────────────────
  const drainDecodeQueue = useCallback(async () => {
    if (isDecodingRef.current || pendingDecodeRef.current.length === 0) return;
    isDecodingRef.current = true;

    while (pendingDecodeRef.current.length > 0) {
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

      results.forEach((buf) => {
        if (buf) {
          decodedQueueRef.current.push(buf);
          scheduleNext();
        }
      });
    }

    isDecodingRef.current = false;

    // Edge case: flush requested, all decoded/failed, nothing playing
    if (
      flushRequestedRef.current &&
      decodedQueueRef.current.length === 0 &&
      activeSourcesRef.current.size === 0
    ) {
      fireDone();
    }
  }, [ensureTTSCtxRunning, scheduleNext, fireDone]);

  // ── enqueueTTSChunk ─────────────────────────────────────────────────────
  const enqueueTTSChunk = useCallback(
    (base64) => {
      if (!base64) return;
      pendingDecodeRef.current.push(base64);
      drainDecodeQueue();
    },
    [drainDecodeQueue],
  );

  // ── flushTTS ────────────────────────────────────────────────────────────
  /**
   * Call on tts_end. onDone fires when audio fully plays.
   * 5s fallback fires onDone if Web Audio never calls onended
   * (AudioContext blocked by browser autoplay, tab hidden, etc.)
   *
   * socket.on("tts_end", () => flushTTS(() => socket.emit("playback_done")));
   */
  const flushTTS = useCallback(
    (onDone) => {
      // Cancel previous fallback timer FIRST, then reset the double-fire guard.
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      doneCalledRef.current = false;
      onDoneRef.current = onDone ?? null;
      flushRequestedRef.current = true;

      // FIX: Reduced from 30s to 5s
      // 30 seconds is WAY too long. The fallback should fire quickly if normal
      // playback tracking fails. This was causing Q1's fallback to still be
      // running when Q2 TTS started, causing timing confusion.
      //
      // 5 seconds gives the browser plenty of time to report playback completion
      // via onended callbacks, while not hanging the interview if those callbacks
      // fail due to browser autoplay policies, tab hiding, etc.
      fallbackTimerRef.current = setTimeout(() => {
        if (!doneCalledRef.current) {
          console.warn(
            "⚠️ TTS playback fallback timer fired (5s) — forcing done",
          );
          fireDone();
        }
      }, 5_000); // Changed from 30_000 to 5_000

      const nothingPending =
        pendingDecodeRef.current.length === 0 && !isDecodingRef.current;
      const nothingQueued = decodedQueueRef.current.length === 0;
      const nothingPlaying = activeSourcesRef.current.size === 0;

      if (nothingPending && nothingQueued && nothingPlaying) {
        // No audio received at all — fire immediately
        console.log("🔊 No audio in queue, firing playback_done immediately");
        fireDone();
      }
    },
    [fireDone],
  );

  // ── resetTTS ────────────────────────────────────────────────────────────
  const resetTTS = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
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
    onDoneRef.current = null;
    doneCalledRef.current = false;
  }, []);

  // ── Resume AudioContext on user interaction ─────────────────────────────
  useEffect(() => {
    const resume = () => {
      const ctx = ttsCtxRef.current;
      if (ctx?.state === "suspended") ctx.resume().catch(() => {});
    };
    document.addEventListener("click", resume);
    document.addEventListener("keydown", resume);
    document.addEventListener("touchstart", resume);
    return () => {
      document.removeEventListener("click", resume);
      document.removeEventListener("keydown", resume);
      document.removeEventListener("touchstart", resume);
    };
  }, []);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
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
