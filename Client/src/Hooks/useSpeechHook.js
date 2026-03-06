import { useRef, useCallback, useEffect } from "react";

const TTS_SAMPLE_RATE = 48000;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const MAX_QUEUE_SIZE = 30;
// FIX: Reduced decode timeout — 5s is too long for interactive use
const DECODE_TIMEOUT_MS = 3000;
const PLAYBACK_TIMEOUT_MS = 15000;
// FIX: Small lookahead so we schedule slightly ahead of currentTime, eliminating
// the gap between chunks that "onended chaining" introduces.
const SCHEDULE_AHEAD_SEC = 0.02; // 20ms lookahead for gapless scheduling

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
  // FIX: Track the wall-clock time when the next chunk should start playing.
  // Scheduling chunks at ctx.currentTime + buffer.duration instead of relying on
  // the onended callback eliminates the ~2-20ms gap between consecutive chunks
  // that caused audible clicks/stutters in the previous implementation.
  const nextStartTimeRef = useRef(0);

  // FIX: Use "interactive" latency hint instead of "playback".
  // "playback" optimises for throughput (large output buffer, 100-400ms latency).
  // "interactive" minimises latency (5-20ms output buffer) — critical for TTS.
  const getTTSCtx = useCallback(() => {
    if (ttsCtxRef.current && ttsCtxRef.current.state !== "closed") {
      return ttsCtxRef.current;
    }

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: "interactive", // FIX: was "playback" — saves 80-380ms of output latency
        sampleRate: TTS_SAMPLE_RATE,
      });

      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.0;
      gainNode.connect(ctx.destination);
      gainNodeRef.current = gainNode;

      ttsCtxRef.current = ctx;
      window.__ttsContext = ctx;

      console.log(
        "✅ TTS AudioContext created — state:",
        ctx.state,
        "baseLatency:",
        ctx.baseLatency?.toFixed(3),
        "outputLatency:",
        ctx.outputLatency?.toFixed(3),
      );

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

  const checkDone = useCallback(() => {
    if (
      flushRequestedRef.current &&
      activeSourcesRef.current.size === 0 &&
      decodedQueueRef.current.length === 0 &&
      pendingDecodeRef.current.length === 0 &&
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

  // FIX: Gapless scheduled playback.
  // Instead of starting a buffer immediately and relying on the "onended" event
  // to chain to the next one (which introduces a scheduling gap on every chunk),
  // we maintain nextStartTimeRef — a monotonically-advancing AudioContext clock
  // position. Each buffer is scheduled at that position, and the position is
  // advanced by the buffer's duration before the buffer starts playing.
  // Result: zero-gap, glitch-free streaming TTS audio.
  const scheduleBuffer = useCallback(
    (buffer) => {
      const ctx = ttsCtxRef.current;
      if (!ctx || !buffer) return false;

      try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNodeRef.current || ctx.destination);

        // Pick the later of "now + small lookahead" and the previously scheduled
        // end time so we never schedule in the past.
        const startAt = Math.max(
          ctx.currentTime + SCHEDULE_AHEAD_SEC,
          nextStartTimeRef.current,
        );
        nextStartTimeRef.current = startAt + buffer.duration;

        source.onended = () => {
          activeSourcesRef.current.delete(source);

          if (
            decodedQueueRef.current.length === 0 &&
            activeSourcesRef.current.size === 0
          ) {
            isPlayingRef.current = false;
          }

          // No longer call playNext here — buffers are pre-scheduled so there
          // is no onended chain. Just check if we're done.
          checkDone();
        };

        activeSourcesRef.current.add(source);
        source.start(startAt);

        if (!isPlayingRef.current) {
          isPlayingRef.current = true;
          onPlayStart?.();
        }

        return true;
      } catch (err) {
        console.error("❌ Error scheduling audio buffer:", err);
        return false;
      }
    },
    [onPlayStart, checkDone],
  );

  // FIX: Drain the decoded queue by scheduling ALL available buffers in one pass.
  // Previously only one buffer was scheduled per onended event, creating a
  // scheduling gap. Now every decoded buffer is pre-scheduled immediately.
  const drainDecodedQueue = useCallback(() => {
    if (decodedQueueRef.current.length === 0) {
      checkDone();
      return;
    }

    while (decodedQueueRef.current.length > 0) {
      const buffer = decodedQueueRef.current.shift();
      scheduleBuffer(buffer);
    }
  }, [scheduleBuffer, checkDone]);

  // Keep playNext as a thin alias so external callers still work
  const playNext = useCallback(async () => {
    const running = await ensureContextRunning();
    if (!running) return false;
    drainDecodedQueue();
    return true;
  }, [ensureContextRunning, drainDecodedQueue]);

  // FIX: Decode pipeline overhaul.
  // Old: batch of 2, yield via setTimeout(1) between batches → slow queue drain.
  // New: decode ALL pending chunks in one Promise.allSettled call, schedule
  //      every resulting buffer immediately. No artificial yielding.
  const drainDecodeQueue = useCallback(async () => {
    if (isDecodingRef.current || pendingDecodeRef.current.length === 0) return;

    isDecodingRef.current = true;

    if (decodeTimeoutRef.current) clearTimeout(decodeTimeoutRef.current);
    decodeTimeoutRef.current = setTimeout(() => {
      console.warn("⚠️ TTS decode timeout");
      isDecodingRef.current = false;
      decodeTimeoutRef.current = null;
    }, DECODE_TIMEOUT_MS);

    try {
      const running = await ensureContextRunning();
      if (!running) {
        console.warn("⚠️ Cannot decode — AudioContext not running");
        isDecodingRef.current = false;
        return;
      }

      const ctx = ttsCtxRef.current;
      if (!ctx) {
        isDecodingRef.current = false;
        return;
      }

      // FIX: Drain ALL pending at once rather than in batches of 2.
      // Each chunk is ~85ms of audio (8KB at 48kHz mono 16-bit).
      // Decoding all concurrently is fine — decodeAudioData runs off-thread.
      while (pendingDecodeRef.current.length > 0) {
        const batch = pendingDecodeRef.current.splice(0); // take ALL pending

        const results = await Promise.allSettled(
          batch.map(async (base64) => {
            try {
              const binary = atob(base64);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }

              const wavBuffer = pcm16ToWav(bytes.buffer);
              if (!wavBuffer) return null;

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

        // FIX: Schedule all newly decoded buffers immediately instead of waiting
        // for the currently-playing source to fire onended.
        if (hasNewBuffers) {
          drainDecodedQueue();
        }

        // FIX: Removed setTimeout(r, 1) yield — it was adding 1ms+ per batch
        // and preventing the next batch from starting quickly.
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
  }, [ensureContextRunning, drainDecodedQueue, checkDone]);

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
      if (activeSourcesRef.current.size === 0) {
        isPlayingRef.current = false;
      }

      doneCalledRef.current = false;
      onDoneRef.current = onDone || null;
      flushRequestedRef.current = true;

      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);

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

    // FIX: Reset the scheduler clock so the next utterance starts from now,
    // not from an old future timestamp that could cause a long silent gap.
    nextStartTimeRef.current = 0;
  }, []);

  // Auto-resume on user interaction
  useEffect(() => {
    const resume = async () => {
      const ctx = ttsCtxRef.current;
      if (ctx?.state === "suspended") {
        try {
          await ctx.resume();
          console.log("✅ AudioContext resumed by gesture");
          if (
            decodedQueueRef.current.length > 0 &&
            activeSourcesRef.current.size === 0
          ) {
            isPlayingRef.current = false;
            drainDecodedQueue();
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
  }, [drainDecodedQueue]);

  // Periodic context check — less frequent since interactive mode stays running
  useEffect(() => {
    const interval = setInterval(() => {
      const ctx = ttsCtxRef.current;
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

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
    playNext, // kept for backward compat
    getStats: () => ({
      queueLength: decodedQueueRef.current.length,
      pendingLength: pendingDecodeRef.current.length,
      activeCount: activeSourcesRef.current.size,
      isPlaying: isPlayingRef.current,
      isDecoding: isDecodingRef.current,
      contextState: ttsCtxRef.current?.state || "none",
      nextStartTime: nextStartTimeRef.current,
      contextTime: ttsCtxRef.current?.currentTime,
    }),
  };
}
