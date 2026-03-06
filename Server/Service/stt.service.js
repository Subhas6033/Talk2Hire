const WS = require("ws");

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
if (!DEEPGRAM_API_KEY) {
  console.error("❌ DEEPGRAM_API_KEY is not set in environment variables");
}

const STT_SAMPLE_RATE = 48000;
const IDLE_TIMEOUT_MS = 8000;
const UTTERANCE_END_MS = 500;
const KEEPALIVE_INTERVAL_MS = 3_000;
const FLUSH_CHUNK_SIZE = 960;
const FLUSH_CHUNK_COUNT = 4;
const FLUSH_INTERVAL_MS = 10;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 1000;
const MAX_QUEUE_SIZE = 1000;

const STT_URL =
  `wss://api.deepgram.com/v1/listen` +
  `?model=nova-3` +
  `&language=en-US` +
  `&smart_format=true` +
  `&interim_results=true` +
  `&vad_events=true` +
  `&endpointing=200` +
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
    let wsReadyReject = null;
    const wsReadyPromise = new Promise((res, rej) => {
      wsReadyResolve = res;
      wsReadyReject = rej;
    });

    const connectionId = Symbol("STT_CONN");
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let isClosing = false;

    let idlePaused = true;
    let idleTimer = null;
    let hasTranscript = false;
    let audioChunkCount = 0;
    let keepAliveTimer = null;
    let activateTimer = null;
    let flushIntervalRef = null;
    let messageQueue = [];
    const mountedRef = { current: true };

    let standby = true;
    let gateOpen = false;
    let partialFinals = [];
    let lastSpeechTime = null;
    let connectionHealthy = true;
    let pingInterval = null;

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
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
    };

    const scheduleIdle = () => {
      clearIdleTimer();
      if (idlePaused) return;
      if (!gateOpen) return;

      idleTimer = setTimeout(() => {
        if (!idlePaused && !hasTranscript && gateOpen && connectionHealthy) {
          const now = Date.now();
          if (lastSpeechTime && now - lastSpeechTime < IDLE_TIMEOUT_MS) {
            scheduleIdle();
            return;
          }
          console.log(`⏱️ STT idle after ${IDLE_TIMEOUT_MS}ms`);
          onIdle?.();
        }
      }, IDLE_TIMEOUT_MS);
    };

    const flushPartials = (reason) => {
      const text = partialFinals.join(" ").trim();
      partialFinals = [];
      if (!text) return false;

      console.log(
        `🗣️ Transcript flushed (${reason}): "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}"`,
      );
      hasTranscript = true;
      lastSpeechTime = Date.now();
      clearIdleTimer();
      onTranscript?.(text);
      return true;
    };

    const processMessageQueue = () => {
      if (messageQueue.length > 0 && conn?.readyState === WS.OPEN) {
        console.log(`📨 Processing ${messageQueue.length} queued messages`);
        while (messageQueue.length > 0) {
          const msg = messageQueue.shift();
          try {
            conn.send(msg);
          } catch (err) {
            console.warn("⚠️ Failed to send queued message:", err.message);
          }
        }
      }
    };

    const startHealthCheck = () => {
      pingInterval = setInterval(() => {
        if (conn?.readyState === WS.OPEN) {
          connectionHealthy = true;
          try {
            if (conn.ping) conn.ping();
          } catch (e) {
            connectionHealthy = false;
          }
        } else {
          connectionHealthy = false;
        }
      }, 5000);
    };

    let conn = null;
    console.log("🔗 Connecting to STT URL:", STT_URL);
    const createConnection = () => {
      if (isClosing) return null;

      const ws = new WS(STT_URL, {
        headers: {
          Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        },
        handshakeTimeout: 10000,
      });

      ws.on("open", () => {
        if (isClosing || !mountedRef.current) {
          ws.close();
          return;
        }

        wsReady = true;
        connectionHealthy = true;
        reconnectAttempts = 0;
        wsReadyResolve?.();
        console.log(`🎙️ Deepgram STT open (ID: ${connectionId.toString()})`);

        processMessageQueue();

        keepAliveTimer = setInterval(() => {
          if (wsReady && conn?.readyState === WS.OPEN) {
            try {
              conn.send(JSON.stringify({ type: "KeepAlive" }));
            } catch (e) {
              console.warn("⚠️ STT keepAlive failed:", e.message);
            }
          }
        }, KEEPALIVE_INTERVAL_MS);

        startHealthCheck();
      });

      ws.on("error", (err) => {
        console.error(
          `❌ Deepgram STT error (${connectionId.toString()}):`,
          err.message,
        );

        if (
          !isClosing &&
          mountedRef.current &&
          reconnectAttempts < MAX_RECONNECT_ATTEMPTS
        ) {
          reconnectAttempts++;
          console.log(
            `🔄 Reconnecting STT (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`,
          );

          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            if (!isClosing && mountedRef.current) {
              conn = createConnection(); // ✅ legal — outer `let conn`
            }
          }, RECONNECT_DELAY_MS * reconnectAttempts);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          onError?.(
            new Error(
              `STT connection failed after ${MAX_RECONNECT_ATTEMPTS} attempts`,
            ),
          );
        }
      });

      ws.on("close", (code, reason) => {
        const reasonStr = reason?.toString() || "unknown";
        console.warn(
          `⚠️ Deepgram STT closed — code=${code} reason=${reasonStr} (${connectionId.toString()})`,
        );

        wsReady = false;
        connectionHealthy = false;
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

        if (isClosing || !mountedRef.current) {
          onClose?.(connectionId);
          return;
        }

        if (
          code !== 1000 &&
          code !== 1001 &&
          reconnectAttempts < MAX_RECONNECT_ATTEMPTS
        ) {
          reconnectAttempts++;
          console.log(
            `🔄 Reconnecting STT (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`,
          );

          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            if (!isClosing && mountedRef.current) {
              conn = createConnection(); // ✅ legal — outer `let conn`
            }
          }, RECONNECT_DELAY_MS * reconnectAttempts);
        } else {
          onClose?.(connectionId);
        }
      });

      ws.on("message", (raw) => {
        let data;
        try {
          data = JSON.parse(raw.toString());
        } catch (err) {
          console.warn("⚠️ Failed to parse STT message:", err.message);
          return;
        }

        const type = data?.type;

        if (standby) return;
        if (!gateOpen) return;

        if (type === "SpeechStarted") {
          console.log("🗣️ SpeechStarted detected");
          lastSpeechTime = Date.now();
          clearIdleTimer();
          return;
        }

        if (type === "UtteranceEnd") {
          console.log(`🔚 UtteranceEnd — partials=${partialFinals.length}`);
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
          const confidence = alt?.confidence ?? 0;

          if (text && confidence > 0.3) {
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
          }
          return;
        }
      });

      return ws;
    };

    // Initial connection — assign to outer `let conn`
    conn = createConnection();

    return {
      connectionId,

      send(buf) {
        if (standby) return;
        if (!gateOpen) return;

        if (!wsReady || conn?.readyState !== WS.OPEN) {
          if (messageQueue.length < MAX_QUEUE_SIZE) {
            messageQueue.push(buf);
          }
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
        if (audioChunkCount % 500 === 0) {
          console.log(
            `🎙️ STT: ${audioChunkCount} chunks sent | queue=${messageQueue.length}`,
          );
        }

        try {
          conn.send(toSend);
        } catch (e) {
          console.error("❌ STT send error:", e.message);
          if (messageQueue.length < MAX_QUEUE_SIZE) {
            messageQueue.push(toSend);
          }
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
        messageQueue = [];
        lastSpeechTime = null;

        console.log(`💤 STT entering standby (TTS playing)`);
      },

      activate() {
        if (!wsReady || conn?.readyState !== WS.OPEN) {
          console.warn("⚠️ STT activate called but connection not ready");
          standby = false;
          gateOpen = true;
          return;
        }

        hasTranscript = false;
        audioChunkCount = 0;
        partialFinals = [];
        lastSpeechTime = null;

        standby = false;
        gateOpen = false;

        if (activateTimer) clearTimeout(activateTimer);
        if (flushIntervalRef) clearInterval(flushIntervalRef);

        const silenceChunk = Buffer.alloc(FLUSH_CHUNK_SIZE, 0);
        let chunksSent = 0;

        console.log(
          `✅ STT activating — dripping ${FLUSH_CHUNK_COUNT} silence chunks then opening gate`,
        );

        const flushInterval = setInterval(() => {
          if (chunksSent >= FLUSH_CHUNK_COUNT) {
            clearInterval(flushInterval);
            flushIntervalRef = null;
            gateOpen = true;
            console.log(`🎙️ STT active — gate open, ready for speech`);
            return;
          }

          if (!wsReady || conn?.readyState !== WS.OPEN) {
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
        isClosing = true;
        mountedRef.current = false;

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
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        try {
          if (conn?.readyState === WS.OPEN) {
            conn.send(JSON.stringify({ type: "CloseStream" }));
            setTimeout(() => {
              try {
                conn.close(1000, "Normal closure");
              } catch (_) {}
            }, 500);
          } else if (conn) {
            conn.close();
          }
        } catch (_) {}

        wsReady = false;
        messageQueue = [];
        console.log(`✅ STT connection finished (${connectionId.toString()})`);
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
        messageQueue = [];
        lastSpeechTime = null;
      },

      isConnected() {
        return wsReady && conn?.readyState === WS.OPEN && connectionHealthy;
      },

      getStats() {
        return {
          connectionId: connectionId.toString(),
          connected: wsReady && conn?.readyState === WS.OPEN,
          audioChunks: audioChunkCount,
          queueLength: messageQueue.length,
          hasTranscript,
          gateOpen,
          standby,
          reconnectAttempts,
        };
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
