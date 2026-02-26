const WS = require("ws");

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const STT_SAMPLE_RATE = 48000;
const IDLE_TIMEOUT_MS = 8000;
const UTTERANCE_END_MS = 1500;
const KEEPALIVE_INTERVAL_MS = 8_000;

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
      idleTimer = setTimeout(() => {
        if (!idlePaused && !hasTranscript) {
          console.log(`⏱️ STT idle after ${IDLE_TIMEOUT_MS}ms`);
          onIdle?.();
        }
      }, IDLE_TIMEOUT_MS);
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

      if (type === "SpeechStarted") {
        console.log("🗣️ SpeechStarted detected");
        clearIdleTimer();
        return;
      }

      if (type === "UtteranceEnd") {
        console.log(`🔚 UtteranceEnd — hasTranscript=${hasTranscript}`);
        if (!hasTranscript) scheduleIdle();
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

        if (!text) return;

        scheduleIdle();

        if (!isFinal) {
          onInterim?.(text);
          return;
        }

        if (speech || isFinal) {
          hasTranscript = true;
          clearIdleTimer();
          onTranscript?.(text);
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
        if (!wsReady || conn.readyState !== WS.OPEN) {
          console.warn(`⚠️ STT not ready - audio dropped`);
          return;
        }

        // Normalize to Buffer — ArrayBuffer from browser must be converted
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

      finish() {
        clearIdleTimer();
        stopKeepAlive();
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
        idlePaused = false;
        scheduleIdle();
        console.log(`▶️ STT idle detection resumed`);
      },

      resetTranscriptState() {
        hasTranscript = false;
        audioChunkCount = 0;
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
