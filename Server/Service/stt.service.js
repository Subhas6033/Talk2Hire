const WS = require("ws");

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const STT_SAMPLE_RATE = 48000;

const IDLE_TIMEOUT_MS = 12000;

const UTTERANCE_END_MS = 1500;
const KEEPALIVE_INTERVAL_MS = 3_000;

const ACTIVATE_DELAY_MS = 1500;

const FLUSH_CHUNK_SIZE = 960; // 10ms of silence at 48kHz (960 samples × 2 bytes)
const FLUSH_CHUNK_COUNT = 30; // 30 × 10ms = 300ms total flush duration
const FLUSH_INTERVAL_MS = 10; // one chunk every 10ms

const STT_URL =
  `wss://api.deepgram.com/v1/listen` +
  `?model=nova-2` +
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
    let flushIntervalRef = null; // tracks the drip-silence interval so enterStandby can cancel it

    // standby=true  → audio dropped, Deepgram events ignored (during TTS)
    // standby=false → audio flows, events processed (listening window)
    let standby = true;

    // FIX 3: Track whether the gate has fully opened after activate().
    // Even with standby=false, we ignore Deepgram events until gateOpen=true
    // so that the silence-flush response from Deepgram doesn't trigger idle.
    let gateOpen = false;

    // Partial transcript accumulator
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
      // FIX 4: Also guard on gateOpen — don't start idle countdown until the
      // gate is fully open, otherwise the activate delay counts against the
      // user's speaking window.
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

    const conn = new WS(STT_URL, {
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
      },
    });

    conn.on("open", () => {
      wsReady = true;
      wsReadyResolve?.();
      console.log(`🎙️ Deepgram STT open`);

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

    conn.on("message", (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const type = data?.type;
      console.log(`📨 STT message type: ${type}`);

      // Drop all Deepgram events while in standby
      if (standby) {
        console.log(`🔇 STT standby — ignoring event: ${type}`);
        return;
      }

      // FIX 5: Also drop events during the activate settle window.
      // Deepgram sends Results/SpeechStarted in response to the silence flush;
      // these must be discarded or they trigger idle/transcript callbacks
      // before the user has had a chance to speak.
      if (!gateOpen) {
        console.log(`🔇 STT gate not open — ignoring event: ${type}`);
        return;
      }

      if (type === "SpeechStarted") {
        console.log("🗣️ SpeechStarted detected");
        clearIdleTimer();
        return;
      }

      if (type === "UtteranceEnd") {
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
          if (text) {
            scheduleIdle();
            onInterim?.(text);
          }
          return;
        }

        if (text) {
          partialFinals.push(text);
          if (!speech) scheduleIdle();
        }

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

    return {
      connectionId,

      send(buf) {
        if (standby) return;

        if (!wsReady || conn.readyState !== WS.OPEN) {
          console.warn(`⚠️ STT not ready - audio dropped`);
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

      activate() {
        if (!wsReady || conn.readyState !== WS.OPEN) {
          console.warn("⚠️ STT activate called but connection not ready");
          standby = false;
          gateOpen = true;
          return;
        }

        // Reset accumulators
        hasTranscript = false;
        audioChunkCount = 0;
        partialFinals = [];

        // Keep both gates closed during the entire flush + settle window.
        // standby=false allows silence chunks to reach Deepgram via the WS,
        // but gateOpen=false drops all Deepgram events during this window.
        standby = false;
        gateOpen = false;

        if (activateTimer) clearTimeout(activateTimer);

        // FIX: Send silence as small 10ms chunks dripped over 300ms instead of
        // one large buffer. Sending 28800 bytes at once looks like an audio
        // burst to Deepgram's VAD and triggers SpeechStarted on the flush.
        // Dripping small chunks trains the VAD to read this as ambient silence.
        const silenceChunk = Buffer.alloc(FLUSH_CHUNK_SIZE, 0);
        let chunksSent = 0;
        console.log(
          `✅ STT activating — dripping ${FLUSH_CHUNK_COUNT} silence chunks over ${FLUSH_CHUNK_COUNT * FLUSH_INTERVAL_MS}ms, gate opens ${ACTIVATE_DELAY_MS}ms after last chunk`,
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
