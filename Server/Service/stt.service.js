const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const STT_SAMPLE_RATE = 48000;
const IDLE_TIMEOUT_MS = 15000;
const UTTERANCE_END_MS = 1500;

function createSTTSession() {
  const deepgram = createClient(DEEPGRAM_API_KEY);

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

    // ── Connection identity ──────────────────────────────────────────────────
    // FIX: Each connection instance gets a unique ID. When onClose fires, we ONLY
    // nullify if the closing connection matches the current one. This prevents
    // old connection's onClose from killing a fresh connection.
    const connectionId = Symbol("STT_CONN");

    // ── Idle state — STARTS PAUSED ────────────────────────────────────────
    let idlePaused = true;
    let idleTimer = null;
    let hasTranscript = false;
    let audioChunkCount = 0;

    const clearIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
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

    // ── Deepgram WebSocket ─────────────────────────────────────────────────
    const conn = deepgram.listen.live({
      model: "nova-2",
      language: "en-US",
      smart_format: true,
      interim_results: true,
      utterance_end_ms: String(UTTERANCE_END_MS),
      vad_events: true,
      endpointing: 300,
      encoding: "linear16",
      sample_rate: STT_SAMPLE_RATE,
      channels: 1,
    });

    // FIX: Tag this connection with its unique ID
    conn.__connectionId = connectionId;

    conn.on(LiveTranscriptionEvents.Open, () => {
      wsReady = true;
      wsReadyResolve?.();
      console.log(
        `🎙️ Deepgram STT open (connectionId: ${connectionId.toString()})`,
      );
    });

    conn.on(LiveTranscriptionEvents.Error, (err) => {
      console.error("❌ Deepgram STT error:", err);
      onError?.(err);
    });

    conn.on(LiveTranscriptionEvents.Close, () => {
      console.warn(
        `⚠️ Deepgram STT closed (connectionId: ${connectionId.toString()})`,
      );
      clearIdleTimer();
      wsReady = false;
      // FIX: Pass connectionId to onClose so handler can verify it's the right connection
      onClose?.(connectionId);
    });

    conn.on(LiveTranscriptionEvents.Transcript, (data) => {
      const alt = data?.channel?.alternatives?.[0];
      const text = alt?.transcript?.trim() ?? "";
      const isFinal = data?.is_final ?? false;
      const speech = data?.speech_final ?? false;

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
    });

    conn.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      if (!hasTranscript) scheduleIdle();
    });

    conn.on(LiveTranscriptionEvents.SpeechStarted, () => {
      clearIdleTimer();
    });

    return {
      connectionId,

      send(buf) {
        if (!wsReady) {
          console.warn(
            `⚠️ STT not ready (connectionId: ${connectionId.toString()}) - audio dropped`,
          );
          return;
        }
        audioChunkCount++;
        if (audioChunkCount % 100 === 0) {
          console.log(
            `🎙️ STT: ${audioChunkCount} chunks sent (connectionId: ${connectionId.toString().slice(0, 20)}...)`,
          );
        }
        try {
          conn.send(buf);
        } catch (e) {
          console.error("❌ STT send error:", e.message);
        }
      },

      finish() {
        clearIdleTimer();
        try {
          conn.finish();
        } catch (_) {}
        wsReady = false;
        console.log(
          `✅ STT connection finished (connectionId: ${connectionId.toString().slice(0, 20)}...)`,
        );
      },

      pauseIdleDetection() {
        idlePaused = true;
        clearIdleTimer();
        console.log(
          `⏸️ STT idle detection paused (connectionId: ${connectionId.toString().slice(0, 20)}...)`,
        );
      },

      resumeIdleDetection() {
        // FIX: ALWAYS reset hasTranscript when resuming
        hasTranscript = false;
        idlePaused = false;
        scheduleIdle();
        console.log(
          `▶️ STT idle detection resumed (connectionId: ${connectionId.toString().slice(0, 20)}...)`,
        );
      },

      resetTranscriptState() {
        hasTranscript = false;
        audioChunkCount = 0;
        console.log(
          `🔄 STT transcript state reset (connectionId: ${connectionId.toString().slice(0, 20)}...)`,
        );
      },

      isConnected() {
        return wsReady;
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
