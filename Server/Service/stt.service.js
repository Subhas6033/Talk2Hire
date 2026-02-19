/**
 * stt.service.js — Deepgram live STT with controllable idle detection
 *
 * KEY FIX: idleDetection starts PAUSED on every new connection.
 * The server must call resumeIdleDetection() ONLY after TTS finishes
 * and the mic is genuinely open for the user. This prevents the
 * "Can I repeat the question?" firing while TTS is still playing.
 */

const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const STT_SAMPLE_RATE = 48000;
const IDLE_TIMEOUT_MS = 15000; // 15 s of real silence → idle
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

    // ── Idle state — STARTS PAUSED ────────────────────────────────────────
    let idlePaused = true; // <<< paused until resumeIdleDetection() called
    let idleTimer = null;
    let hasTranscript = false;

    const clearIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const scheduleIdle = () => {
      clearIdleTimer();
      if (idlePaused) return; // never start if paused
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

    conn.on(LiveTranscriptionEvents.Open, () => {
      wsReady = true;
      wsReadyResolve?.();
      console.log("🎙️ Deepgram STT open");
    });

    conn.on(LiveTranscriptionEvents.Error, (err) => {
      console.error("❌ Deepgram STT error:", err);
      onError?.(err);
    });

    conn.on(LiveTranscriptionEvents.Close, () => {
      console.warn("⚠️ Deepgram STT closed");
      clearIdleTimer();
      wsReady = false;
      onClose?.();
    });

    conn.on(LiveTranscriptionEvents.Transcript, (data) => {
      const alt = data?.channel?.alternatives?.[0];
      const text = alt?.transcript?.trim() ?? "";
      const isFinal = data?.is_final ?? false;
      const speech = data?.speech_final ?? false;

      if (!text) return;

      // Any speech resets the idle timer
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
      if (!hasTranscript) scheduleIdle(); // give extra grace time
    });

    conn.on(LiveTranscriptionEvents.SpeechStarted, () => {
      clearIdleTimer(); // voice → cancel idle countdown
    });

    return {
      send(buf) {
        if (!wsReady) return;
        try {
          conn.send(buf);
        } catch (e) {
          console.error("STT send:", e);
        }
      },

      finish() {
        clearIdleTimer();
        try {
          conn.finish();
        } catch (_) {}
        wsReady = false;
      },

      /** Call BEFORE TTS starts. Stops idle timer from running during playback. */
      pauseIdleDetection() {
        idlePaused = true;
        clearIdleTimer();
      },

      /** Call AFTER TTS ends and listening_enabled is emitted to the client. */
      resumeIdleDetection() {
        hasTranscript = false;
        idlePaused = false;
        scheduleIdle();
      },

      resetTranscriptState() {
        hasTranscript = false;
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
