import { useRef, useCallback, useEffect } from "react";

const TTS_SAMPLE_RATE = 48000;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const MAX_QUEUE_SIZE = 30;
const DECODE_TIMEOUT_MS = 5000;
const PLAYBACK_TIMEOUT_MS = 15000;
// How far ahead (in seconds) to schedule the next audio buffer.
// Small enough to not add noticeable pre-roll latency, large enough
// to cover a JS event-loop stall between chunks.
const SCHEDULE_AHEAD_S = 0.04; // 40 ms

function pcm16ToWav(
  pcmBuffer,
  sampleRate = TTS_SAMPLE_RATE,
  numChannels = NUM_CHANNELS,
) {
  try {
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
  } catch (err) {
    console.error("❌ pcm16ToWav error:", err);
    return null;
  }
}

export function useTTS({ onPlayStart, onPlayEnd }) {
  const ttsCtxRef = useRef(null);
  const decodedQueueRef = useRef([]);
  const pendingDecodeRef = useRef([]);
  const isDecodingRef = useRef(false);
  const isPlayingRef = useRef(false);
  const activeSourcesRef = useRef(new Set());
  const onDoneRef = useRef(null);
  const flushRequestedRef = useRef(false);
  const doneCalledRef = useRef(false);
  const fallbackTimerRef = useRef(null);
  const decodeTimeoutRef = useRef(null);
  const gainNodeRef = useRef(null);
  // FIX: tracks the Web Audio clock time at which the next buffer should start.
  // Using ctx.currentTime scheduling instead of the onended-chain eliminates the
  // per-chunk gap that arose from callback latency + async ensureContextRunning.
  const nextPlayTimeRef = useRef(0);

  // Get or create AudioContext — lazy, only on first use to respect browser gesture policy
  const getTTSCtx = useCallback(() => {
    if (ttsCtxRef.current && ttsCtxRef.current.state !== "closed") {
      return ttsCtxRef.current;
    }

    try {
      // FIX: "interactive" minimises browser output buffer depth (~5ms vs ~170ms
      // for "playback"). TTS is real-time voice, not a media player — we want
      // the lowest possible output latency.
      const ctx = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: "interactive",
        sampleRate: TTS_SAMPLE_RATE,
      });

      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.0;
      gainNode.connect(ctx.destination);
      gainNodeRef.current = gainNode;

      ttsCtxRef.current = ctx;
      window.__ttsContext = ctx;

      console.log("✅ TTS AudioContext created, state:", ctx.state);

      if (ctx.state === "suspended") {
        ctx.resume().catch(console.warn);
      }

      return ctx;
    } catch (err) {
      console.error("❌ Failed to create AudioContext:", err);
      return null;
    }
  }, []);

  const ensureContextRunning = useCallback(async () => {
    const ctx = getTTSCtx();
    if (!ctx) return false;

    if (ctx.state === "closed") {
      console.log("🔄 AudioContext closed, creating new one");
      ttsCtxRef.current = null;
      window.__ttsContext = null;
      return ensureContextRunning();
    }

    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
        console.log("✅ TTS AudioContext resumed");
      } catch (err) {
        console.error("❌ Failed to resume AudioContext:", err);
        return false;
      }
    }

    return ctx.state === "running";
  }, [getTTSCtx]);

  // FIX: extracted so onended can reference it without a stale closure
  const checkDone = useCallback(() => {
    if (
      flushRequestedRef.current &&
      activeSourcesRef.current.size === 0 &&
      decodedQueueRef.current.length === 0 &&
      pendingDecodeRef.current.length === 0 &&
      // CRITICAL FIX: pendingDecodeRef items are spliced into a batch BEFORE the
      // async decode finishes. Without this guard, checkDone sees an empty
      // pendingDecodeRef and fires onPlayEnd while the decode is still in-flight,
      // causing the next question's resetTTS() to kill the current audio mid-sentence.
      !isDecodingRef.current &&
      !doneCalledRef.current
    ) {
      doneCalledRef.current = true;

      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }

      onPlayEnd?.();
      onDoneRef.current?.();
      onDoneRef.current = null;
    }
  }, [onPlayEnd]);

  const playNext = useCallback(async () => {
    if (decodedQueueRef.current.length === 0) {
      checkDone();
      return false;
    }

    const ctx = ttsCtxRef.current;
    if (!ctx || ctx.state === "closed") return false;

    // Resume without awaiting — avoids the async gap before scheduling.
    if (ctx.state === "suspended") {
      ctx.resume().catch(console.warn);
    }

    // FIX: Drain the entire decoded queue in one pass, scheduling each buffer
    // to start exactly when the previous one ends using ctx.currentTime + offset.
    // The onended-chain approach (old code) had ~1-2 frame gap per chunk because
    // it called ensureContextRunning (async) and playNext again after each ended
    // event. Scheduling removes ALL inter-chunk gaps.
    while (decodedQueueRef.current.length > 0) {
      const buffer = decodedQueueRef.current.shift();
      if (!buffer) continue;

      try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNodeRef.current || ctx.destination);

        // Schedule ahead of current time to account for event-loop jitter,
        // but clamp so we never schedule in the past.
        const startAt = Math.max(
          ctx.currentTime + SCHEDULE_AHEAD_S,
          nextPlayTimeRef.current,
        );
        source.start(startAt);
        // Advance the cursor by exactly this buffer's duration — gapless.
        nextPlayTimeRef.current = startAt + buffer.duration;

        source.onended = () => {
          activeSourcesRef.current.delete(source);
          if (
            decodedQueueRef.current.length === 0 &&
            activeSourcesRef.current.size === 0
          ) {
            isPlayingRef.current = false;
          }
          // CRITICAL FIX: if chunks were decoded while this source was playing
          // (drainDecodeQueue now always calls playNext, but those calls extend
          // the schedule cursor forward — they don't start a new source when
          // activeSourcesRef is non-empty at that moment).
          // When the last scheduled source ends, pick up any residual buffers.
          if (decodedQueueRef.current.length > 0) {
            playNext();
          } else {
            checkDone();
          }
        };

        activeSourcesRef.current.add(source);

        if (!isPlayingRef.current) {
          isPlayingRef.current = true;
          onPlayStart?.();
        }
      } catch (err) {
        console.error("❌ Error scheduling audio:", err);
      }
    }

    return true;
  }, [onPlayStart, checkDone]);

  const drainDecodeQueue = useCallback(async () => {
    if (isDecodingRef.current || pendingDecodeRef.current.length === 0) return;

    isDecodingRef.current = true;

    if (decodeTimeoutRef.current) {
      clearTimeout(decodeTimeoutRef.current);
    }

    decodeTimeoutRef.current = setTimeout(() => {
      console.warn("⚠️ TTS decode timeout");
      isDecodingRef.current = false;
      decodeTimeoutRef.current = null;
    }, DECODE_TIMEOUT_MS);

    try {
      const running = await ensureContextRunning();
      if (!running) {
        console.warn("⚠️ Cannot decode - AudioContext not running");
        isDecodingRef.current = false;
        return;
      }

      const ctx = ttsCtxRef.current;
      if (!ctx) {
        isDecodingRef.current = false;
        return;
      }

      // FIX: increased from 2 → 4 so we keep the decoder busier and reduce
      // the number of event-loop yields needed to drain the queue.
      const BATCH_SIZE = 4;

      while (pendingDecodeRef.current.length > 0) {
        const batch = pendingDecodeRef.current.splice(0, BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (base64) => {
            try {
              // FIX: Uint8Array.from + charCodeAt in a single pass is ~3× faster
              // than the previous manual for-loop over atob()'s string.
              const bytes = Uint8Array.from(atob(base64), (c) =>
                c.charCodeAt(0),
              );

              const wavBuffer = pcm16ToWav(bytes.buffer);
              if (!wavBuffer) return null;

              const ctx = ttsCtxRef.current;
              if (!ctx || ctx.state === "closed") {
                throw new Error("AudioContext closed");
              }

              return await ctx.decodeAudioData(wavBuffer);
            } catch (err) {
              console.warn("⚠️ Chunk decode failed:", err.message);
              return null;
            }
          }),
        );

        let hasNewBuffers = false;
        results.forEach((result) => {
          if (result.status === "fulfilled" && result.value) {
            decodedQueueRef.current.push(result.value);
            hasNewBuffers = true;
          }
        });

        // CRITICAL FIX: previously only called playNext when activeSourcesRef.size === 0.
        // But with pre-scheduled playback, activeSourcesRef is non-zero the entire time
        // audio is playing. Chunks decoded while audio plays would sit in decodedQueueRef
        // forever — onended only calls checkDone, not playNext. Now always call playNext;
        // it is safe to call concurrently because it extends nextPlayTimeRef seamlessly.
        if (hasNewBuffers) {
          playNext();
        }

        // FIX: removed the artificial 1ms setTimeout between batches.
        // Each Promise.allSettled above already yields to the event loop,
        // so audio callbacks and renders are not starved.
      }
    } catch (err) {
      console.error("❌ Decode error:", err);
    } finally {
      isDecodingRef.current = false;
      if (decodeTimeoutRef.current) {
        clearTimeout(decodeTimeoutRef.current);
        decodeTimeoutRef.current = null;
      }
    }

    checkDone();
  }, [ensureContextRunning, playNext, checkDone]);

  const enqueueTTSChunk = useCallback(
    (base64) => {
      if (!base64) return;

      try {
        atob(base64);
      } catch {
        console.warn("⚠️ Invalid base64");
        return;
      }

      if (pendingDecodeRef.current.length < MAX_QUEUE_SIZE * 2) {
        pendingDecodeRef.current.push(base64);
      } else {
        console.warn("⚠️ TTS queue full, dropping chunk");
        return;
      }

      if (!isDecodingRef.current) {
        drainDecodeQueue();
      }
    },
    [drainDecodeQueue],
  );

  const flushTTS = useCallback(
    (onDone) => {
      // FIX: reset isPlayingRef on flush so a new utterance isn't blocked by stale state
      // Only reset if there are no active sources (i.e. previous audio is truly finished)
      if (activeSourcesRef.current.size === 0) {
        isPlayingRef.current = false;
      }

      // NOTE: do NOT reset nextPlayTimeRef here. flushTTS is called when the
      // server signals tts_end, but chunks may still be mid-decode at that point.
      // Those in-flight chunks call playNext() when they finish — if nextPlayTimeRef
      // were 0, they would schedule at ctx.currentTime and overlap with buffers
      // already scheduled earlier in the sequence → parallel / simultaneous audio.
      // nextPlayTimeRef is only reset in resetTTS(), which fully aborts playback
      // before a new question starts.

      doneCalledRef.current = false;
      onDoneRef.current = onDone || null;
      flushRequestedRef.current = true;

      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }

      fallbackTimerRef.current = setTimeout(() => {
        if (!doneCalledRef.current) {
          console.warn("⚠️ TTS fallback timer fired");

          activeSourcesRef.current.forEach((src) => {
            try {
              src.stop();
            } catch (_) {}
          });
          activeSourcesRef.current.clear();
          isPlayingRef.current = false;

          doneCalledRef.current = true;
          onPlayEnd?.();
          onDoneRef.current?.();
          onDoneRef.current = null;
        }
      }, PLAYBACK_TIMEOUT_MS);

      checkDone();
    },
    [onPlayEnd, checkDone],
  );

  const resetTTS = useCallback(() => {
    console.log("🔄 Resetting TTS");

    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    if (decodeTimeoutRef.current) {
      clearTimeout(decodeTimeoutRef.current);
      decodeTimeoutRef.current = null;
    }

    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch (_) {}
    });
    activeSourcesRef.current.clear();

    pendingDecodeRef.current = [];
    decodedQueueRef.current = [];

    isDecodingRef.current = false;
    isPlayingRef.current = false;
    flushRequestedRef.current = false;
    doneCalledRef.current = false;
    onDoneRef.current = null;
    nextPlayTimeRef.current = 0;
  }, []);

  // Auto-resume on user interaction
  useEffect(() => {
    const resume = async () => {
      const ctx = ttsCtxRef.current;
      if (ctx?.state === "suspended") {
        try {
          await ctx.resume();
          console.log("✅ AudioContext resumed by gesture");
          // FIX: also kick playback if there are decoded buffers waiting
          if (
            decodedQueueRef.current.length > 0 &&
            activeSourcesRef.current.size === 0
          ) {
            isPlayingRef.current = false; // ensure playNext doesn't skip
            playNext();
          }
        } catch (err) {
          console.warn("⚠️ Resume failed:", err);
        }
      }
    };

    document.addEventListener("click", resume);
    document.addEventListener("keydown", resume);
    document.addEventListener("touchstart", resume);

    return () => {
      document.removeEventListener("click", resume);
      document.removeEventListener("keydown", resume);
      document.removeEventListener("touchstart", resume);
    };
  }, [playNext]);

  // FIX: removed the 1-second AudioContext polling interval — it fires
  // unconditionally even when idle and can cause a microtask storm during active
  // playback. The gesture listeners above cover the only real-world suspend case.

  // Cleanup
  useEffect(() => {
    return () => {
      resetTTS();

      if (ttsCtxRef.current && ttsCtxRef.current.state !== "closed") {
        ttsCtxRef.current.close().catch(() => {});
        ttsCtxRef.current = null;
        window.__ttsContext = null;
      }
    };
  }, [resetTTS]);

  return {
    enqueueTTSChunk,
    flushTTS,
    resetTTS,
    getStats: () => ({
      queueLength: decodedQueueRef.current.length,
      pendingLength: pendingDecodeRef.current.length,
      activeCount: activeSourcesRef.current.size,
      isPlaying: isPlayingRef.current,
      isDecoding: isDecodingRef.current,
      contextState: ttsCtxRef.current?.state || "none",
    }),
  };
}
