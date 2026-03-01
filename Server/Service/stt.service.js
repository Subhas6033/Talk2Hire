const WS = require("ws");

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const STT_SAMPLE_RATE = 48000;

// How long Deepgram waits in silence before firing onIdle on the server
const IDLE_TIMEOUT_MS = 12000;

// Deepgram connection params
// utterance_end_ms: fires UtteranceEnd after this many ms of silence
const UTTERANCE_END_MS = 1500;

// KeepAlive ping to prevent Deepgram closing an idle connection
const KEEPALIVE_INTERVAL_MS = 3_000;

// How long after the silence-flush completes before we open the gate.
// Deepgram needs ~1500ms to settle its VAD after receiving silence chunks.
const ACTIVATE_DELAY_MS = 1500;

// Silence-flush parameters — drip small chunks so Deepgram VAD reads them
// as ambient silence rather than a speech burst.
const FLUSH_CHUNK_SIZE = 960; // 10ms of silence at 48kHz (960 samples × 2 bytes)
const FLUSH_CHUNK_COUNT = 30; // 30 × 10ms = 300ms total flush
const FLUSH_INTERVAL_MS = 10; // one chunk every 10ms

// ─────────────────────────────────────────────────────────────────────────────
// Deepgram streaming URL — using nova-3 (latest model as of 2025) with full
// VAD feature set. Deepgram handles ALL silence detection server-side:
//   model=nova-3             → Best accuracy, lowest WER
//   smart_format=true        → Punctuation, capitalisation, numerals
//   interim_results=true     → Low-latency partial transcripts for live UI
//   utterance_end_ms=1500    → Emit UtteranceEnd after 1500ms silence
//   vad_events=true          → SpeechStarted / UtteranceEnd events
//   endpointing=300          → speech_final after 300ms pause (fast response)
//   encoding=linear16        → matches toPCM16() on the client
//   sample_rate=48000        → matches browser AudioContext sample rate
//   channels=1               → mono mic input
// ─────────────────────────────────────────────────────────────────────────────
const STT_URL =
  `wss://api.deepgram.com/v1/listen` +
  `?model=nova-3` +
  `&language=en-US` +
  `&smart_format=true` +
  `&interim_results=true` +
  `&utterance_end_ms=${UTTERANCE_END_MS}` +
  `&vad_events=true` +
  `&endpointing=300` +
  `&encoding=linear16` +
  `&sample_rate=${STT_SAMPLE_RATE}` +
  `&channels=1`;

function createSTTSession() {
  function startLiveTranscription({
    onTranscript,
    onInterim,
    onError,
    onClose,
    onIdle,
  }) {
    let wsReady = false;
    let wsReadyResolve = null;
    const wsReadyPromise = new Promise((res) => {
      wsReadyResolve = res;
    });
    const connectionId = Symbol("STT_CONN");

    let idlePaused = true;
    let idleTimer = null;
    let hasTranscript = false;
    let audioChunkCount = 0;
    let keepAliveTimer = null;
    let activateTimer = null;
    let flushIntervalRef = null;

    // standby=true  → during TTS playback — audio and events both dropped
    // standby=false → during listening window — audio flows, events processed
    let standby = true;

    // gateOpen=false → settle window after silence-flush — events dropped
    // gateOpen=true  → fully open, all Deepgram events processed normally
    let gateOpen = false;

    // Accumulates partial is_final results until speech_final or UtteranceEnd
    let partialFinals = [];

    const clearIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const stopKeepAlive = () => {
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
    };

    const scheduleIdle = () => {
      clearIdleTimer();
      if (idlePaused) return;
      if (!gateOpen) return;
      idleTimer = setTimeout(() => {
        if (!idlePaused && !hasTranscript && gateOpen) {
          console.log(`⏱️ STT idle after ${IDLE_TIMEOUT_MS}ms`);
          onIdle?.();
        }
      }, IDLE_TIMEOUT_MS);
    };

    const flushPartials = (reason) => {
      const text = partialFinals.join(" ").trim();
      partialFinals = [];
      if (!text) return false;
      console.log(`🗣️ Transcript flushed (${reason}): "${text}"`);
      hasTranscript = true;
      clearIdleTimer();
      onTranscript?.(text);
      return true;
    };

    // ── Open WebSocket to Deepgram ──────────────────────────────────────────
    const conn = new WS(STT_URL, {
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
      },
    });

    conn.on("open", () => {
      wsReady = true;
      wsReadyResolve?.();
      console.log(`🎙️ Deepgram STT open`);

      // Send KeepAlive every 3s so Deepgram doesn't close an idle connection
      keepAliveTimer = setInterval(() => {
        if (wsReady && conn.readyState === WS.OPEN) {
          try {
            conn.send(JSON.stringify({ type: "KeepAlive" }));
          } catch (e) {
            console.warn("⚠️ STT keepAlive failed:", e.message);
          }
        }
      }, KEEPALIVE_INTERVAL_MS);
    });

    conn.on("error", (err) => {
      console.error("❌ Deepgram STT error:", err.message);
      onError?.(err);
    });

    conn.on("close", (code, reason) => {
      console.warn(
        `⚠️ Deepgram STT closed — code=${code} reason=${reason?.toString()}`,
      );
      clearIdleTimer();
      stopKeepAlive();
      if (activateTimer) {
        clearTimeout(activateTimer);
        activateTimer = null;
      }
      wsReady = false;
      onClose?.(connectionId);
    });

    // ── Handle messages from Deepgram ───────────────────────────────────────
    conn.on("message", (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const type = data?.type;
      console.log(`📨 STT message type: ${type}`);

      // Drop everything while TTS is playing (standby mode)
      if (standby) {
        console.log(`🔇 STT standby — ignoring: ${type}`);
        return;
      }

      // Drop events during the post-flush settle window (gate not open yet)
      if (!gateOpen) {
        console.log(`🔇 STT gate not open — ignoring: ${type}`);
        return;
      }

      if (type === "SpeechStarted") {
        // User has started speaking — cancel any pending idle timer
        console.log("🗣️ SpeechStarted detected");
        clearIdleTimer();
        return;
      }

      if (type === "UtteranceEnd") {
        // Deepgram detected end of utterance after utterance_end_ms silence
        console.log(
          `🔚 UtteranceEnd — hasTranscript=${hasTranscript} partials=${partialFinals.length}`,
        );
        if (!hasTranscript) {
          const flushed = flushPartials("UtteranceEnd");
          if (!flushed) scheduleIdle();
        }
        return;
      }

      if (type === "Results") {
        const alt = data?.channel?.alternatives?.[0];
        const text = alt?.transcript?.trim() ?? "";
        const isFinal = data?.is_final ?? false;
        const speech = data?.speech_final ?? false;

        console.log(
          `📝 Results: "${text}" | is_final=${isFinal} | speech_final=${speech}`,
        );

        if (!isFinal) {
          // Interim result — update live UI, reset idle timer
          if (text) {
            scheduleIdle();
            onInterim?.(text);
          }
          return;
        }

        // is_final=true — accumulate into partials
        if (text) {
          partialFinals.push(text);
          if (!speech) scheduleIdle();
        }

        // speech_final=true — natural speech endpoint detected, flush now
        if (speech) {
          const flushed = flushPartials("speech_final");
          if (!flushed && !hasTranscript) {
            scheduleIdle();
          }
        }

        return;
      }

      if (!["Metadata"].includes(type)) {
        console.log(
          `📨 STT unexpected message type: ${type}`,
          JSON.stringify(data).slice(0, 100),
        );
      }
    });

    // ── Public interface ────────────────────────────────────────────────────
    return {
      connectionId,

      // Send a PCM16 audio buffer to Deepgram
      send(buf) {
        if (standby) return;

        if (!wsReady || conn.readyState !== WS.OPEN) {
          console.warn(`⚠️ STT not ready — audio dropped`);
          return;
        }

        let toSend;
        if (Buffer.isBuffer(buf)) {
          toSend = buf;
        } else if (buf instanceof ArrayBuffer) {
          toSend = Buffer.from(buf);
        } else if (ArrayBuffer.isView(buf)) {
          toSend = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
        } else {
          console.warn("⚠️ STT send: unknown buffer type:", typeof buf);
          return;
        }

        audioChunkCount++;
        if (audioChunkCount % 100 === 0) {
          console.log(
            `🎙️ STT: ${audioChunkCount} chunks sent | last size=${toSend.length}b`,
          );
        }

        try {
          conn.send(toSend);
        } catch (e) {
          console.error("❌ STT send error:", e.message);
        }
      },

      // Called when TTS starts playing — mute Deepgram to ignore speaker bleed
      enterStandby() {
        standby = true;
        gateOpen = false;
        idlePaused = true;
        clearIdleTimer();
        if (activateTimer) {
          clearTimeout(activateTimer);
          activateTimer = null;
        }
        if (flushIntervalRef) {
          clearInterval(flushIntervalRef);
          flushIntervalRef = null;
        }
        hasTranscript = false;
        audioChunkCount = 0;
        partialFinals = [];
        console.log(`💤 STT entering standby (TTS playing)`);
      },

      // Called when TTS fetch completes — drip silence to prime Deepgram VAD,
      // then open the gate after the settle window (ACTIVATE_DELAY_MS).
      activate() {
        if (!wsReady || conn.readyState !== WS.OPEN) {
          console.warn("⚠️ STT activate called but connection not ready");
          standby = false;
          gateOpen = true;
          return;
        }

        hasTranscript = false;
        audioChunkCount = 0;
        partialFinals = [];

        // standby=false lets silence chunks flow through to Deepgram,
        // gateOpen=false still blocks event callbacks until settled.
        standby = false;
        gateOpen = false;

        if (activateTimer) clearTimeout(activateTimer);

        // Drip 300ms of silence in 10ms chunks.
        // Sending a large silence buffer at once triggers Deepgram's VAD
        // as if it were speech. Small chunks train the VAD as ambient silence.
        const silenceChunk = Buffer.alloc(FLUSH_CHUNK_SIZE, 0);
        let chunksSent = 0;
        console.log(
          `✅ STT activating — dripping ${FLUSH_CHUNK_COUNT} silence chunks over ` +
            `${FLUSH_CHUNK_COUNT * FLUSH_INTERVAL_MS}ms, ` +
            `gate opens ${ACTIVATE_DELAY_MS}ms after last chunk`,
        );

        const flushInterval = setInterval(() => {
          if (chunksSent >= FLUSH_CHUNK_COUNT) {
            clearInterval(flushInterval);
            flushIntervalRef = null;
            activateTimer = setTimeout(() => {
              activateTimer = null;
              gateOpen = true;
              console.log(`🎙️ STT active — ready for speech`);
            }, ACTIVATE_DELAY_MS);
            return;
          }
          if (!wsReady || conn.readyState !== WS.OPEN) {
            clearInterval(flushInterval);
            return;
          }
          try {
            conn.send(silenceChunk);
            chunksSent++;
          } catch (e) {
            clearInterval(flushInterval);
            console.error("❌ STT silence chunk failed:", e.message);
          }
        }, FLUSH_INTERVAL_MS);
        flushIntervalRef = flushInterval;
      },

      // Cleanly close the Deepgram connection
      finish() {
        clearIdleTimer();
        stopKeepAlive();
        if (activateTimer) {
          clearTimeout(activateTimer);
          activateTimer = null;
        }
        if (flushIntervalRef) {
          clearInterval(flushIntervalRef);
          flushIntervalRef = null;
        }
        try {
          if (conn.readyState === WS.OPEN) {
            conn.send(JSON.stringify({ type: "CloseStream" }));
            setTimeout(() => {
              try {
                conn.close();
              } catch (_) {}
            }, 500);
          }
        } catch (_) {}
        wsReady = false;
        console.log(`✅ STT connection finished`);
      },

      pauseIdleDetection() {
        idlePaused = true;
        clearIdleTimer();
        console.log(`⏸️ STT idle detection paused`);
      },

      resumeIdleDetection() {
        hasTranscript = false;
        partialFinals = [];
        idlePaused = false;
        scheduleIdle();
        console.log(`▶️ STT idle detection resumed`);
      },

      resetTranscriptState() {
        hasTranscript = false;
        audioChunkCount = 0;
        partialFinals = [];
      },

      isConnected() {
        return wsReady && conn.readyState === WS.OPEN;
      },

      waitForReady(ms = 8000) {
        return Promise.race([
          wsReadyPromise,
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error("Deepgram ready timeout")), ms),
          ),
        ]);
      },
    };
  }

  return { startLiveTranscription };
}

module.exports = { createSTTSession };
