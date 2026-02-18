const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");

function createSTTSession() {
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY is not set in environment variables");
  }

  const apiKey = process.env.DEEPGRAM_API_KEY.trim();
  console.log(
    "🔑 Using Deepgram API Key:",
    apiKey.substring(0, 15) + "..." + apiKey.slice(-4),
  );

  const deepgram = createClient(apiKey);

  return {
    startLiveTranscription({
      onTranscript,
      onInterim,
      onError,
      onClose,
      onIdle,
    }) {
      let connection = null;
      let isOpen = false;
      let isConnecting = false;
      let hasBeenOpened = false;
      let connectionError = null;
      let openTimeout = null;
      let keepAliveInterval = null;

      let lastSpeechTime = Date.now();
      let idleCheckInterval = null;
      let idleAlreadyTriggered = false;
      const IDLE_TIMEOUT = 10000;

      let openResolve = null;
      let openReject = null;
      const openPromise = new Promise((resolve, reject) => {
        openResolve = resolve;
        openReject = reject;
      });

      try {
        isConnecting = true;
        console.log("🎤 Initiating Deepgram WebSocket connection");

        const options = {
          model: "nova-2",
          language: "en",
          smart_format: true,
          encoding: "linear16",
          sample_rate: 48000, // matches mic AudioContext at 48kHz
          channels: 1,
          interim_results: true,
          endpointing: 300,
          utterance_end_ms: 1000,
          vad_events: true,
        };

        console.log("⚙️ STT options:", JSON.stringify(options));
        connection = deepgram.listen.live(options);

        openTimeout = setTimeout(() => {
          if (!isOpen && isConnecting) {
            console.error("❌ Deepgram connection timeout after 8s");
            isConnecting = false;
            const timeoutError = new Error("WebSocket connection timeout");
            connectionError = timeoutError;
            try {
              connection?.finish();
            } catch (_) {}
            connection = null;
            openReject?.(timeoutError);
            onError?.(timeoutError);
          }
        }, 8000);

        const startKeepAlive = () => {
          if (keepAliveInterval) clearInterval(keepAliveInterval);
          let failureCount = 0;
          try {
            connection?.keepAlive();
          } catch (_) {}

          keepAliveInterval = setInterval(() => {
            if (isOpen && connection) {
              try {
                connection.keepAlive();
                failureCount = 0;
              } catch (e) {
                failureCount++;
                if (failureCount >= 3) {
                  clearInterval(keepAliveInterval);
                  keepAliveInterval = null;
                }
              }
            } else {
              clearInterval(keepAliveInterval);
              keepAliveInterval = null;
            }
          }, 2000);
        };

        const startIdleDetection = () => {
          if (idleCheckInterval) clearInterval(idleCheckInterval);
          lastSpeechTime = Date.now();
          idleAlreadyTriggered = false;

          idleCheckInterval = setInterval(() => {
            if (isOpen && !idleAlreadyTriggered) {
              if (Date.now() - lastSpeechTime >= IDLE_TIMEOUT) {
                console.log("⏰ User idle detected (10s silence)");
                idleAlreadyTriggered = true;
                clearInterval(idleCheckInterval);
                idleCheckInterval = null;
                onIdle?.();
              }
            }
          }, 2000);
        };

        connection.on(LiveTranscriptionEvents.Open, () => {
          console.log("✅ Deepgram WebSocket OPEN");
          clearTimeout(openTimeout);
          isOpen = true;
          isConnecting = false;
          hasBeenOpened = true;
          openResolve?.(true);
          startKeepAlive();
          startIdleDetection();
        });

        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
          const transcript = data.channel?.alternatives?.[0]?.transcript;
          if (!transcript?.trim()) return;

          lastSpeechTime = Date.now();
          idleAlreadyTriggered = false;

          const isFinal = data.is_final;
          const speechFinal = data.speech_final;
          const preview =
            transcript.length > 50
              ? transcript.slice(0, 50) + "..."
              : transcript;

          console.log(
            `📝 [${isFinal ? "Final" : "Interim"}${speechFinal ? " - SpeechFinal" : ""}]: ${preview}`,
          );

          if (!isFinal) onInterim?.(transcript, data);
          if (isFinal && speechFinal) {
            console.log("✅ Complete utterance:", transcript);
            onTranscript?.(transcript, data);
          }
        });

        connection.on(LiveTranscriptionEvents.Error, (err) => {
          console.error("❌ Deepgram Error:", {
            message: err.message,
            statusCode: err.statusCode,
          });
          clearTimeout(openTimeout);
          connectionError = err;
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
          }
          if (idleCheckInterval) {
            clearInterval(idleCheckInterval);
            idleCheckInterval = null;
          }
          isOpen = false;
          isConnecting = false;
          if (!hasBeenOpened) openReject?.(err);
          onError?.(err);
        });

        connection.on(LiveTranscriptionEvents.Close, (closeEvent) => {
          console.log("🔌 Deepgram Close:", {
            code: closeEvent?.code,
            reason: closeEvent?.reason,
            wasClean: closeEvent?.wasClean,
          });
          clearTimeout(openTimeout);
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
          }
          if (idleCheckInterval) {
            clearInterval(idleCheckInterval);
            idleCheckInterval = null;
          }

          const wasOpen = isOpen;
          isOpen = false;
          isConnecting = false;

          if (!hasBeenOpened) {
            const closeError = new Error(
              `WebSocket closed before opening (code: ${closeEvent?.code})`,
            );
            connectionError = closeError;
            openReject?.(closeError);
          }

          // Only fire onClose for unexpected drops, not deliberate finish()
          // finish() sets isOpen=false BEFORE calling connection.finish()
          // so wasOpen will be false here and onClose won't fire
          if (wasOpen) onClose?.();
        });

        connection.on(LiveTranscriptionEvents.Warning, (w) =>
          console.warn("⚠️ Deepgram warning:", w),
        );
        connection.on(LiveTranscriptionEvents.Metadata, (m) => {
          console.log("ℹ️ Deepgram metadata:", {
            requestId: m.request_id,
            model: m.model_info?.name,
          });
        });

        console.log("🔄 Deepgram WebSocket initiated, waiting for Open...");
      } catch (error) {
        console.error("❌ Exception creating Deepgram connection:", error);
        clearTimeout(openTimeout);
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
        if (idleCheckInterval) {
          clearInterval(idleCheckInterval);
          idleCheckInterval = null;
        }
        isConnecting = false;
        connectionError = error;
        openReject?.(error);
        onError?.(error);
      }

      return {
        send(chunk) {
          if (!connection || !isOpen) return false;
          try {
            connection.send(chunk);
            return true;
          } catch (e) {
            console.error("❌ Deepgram send error:", e.message);
            isOpen = false;
            return false;
          }
        },

        finish() {
          console.log("🛑 Finishing Deepgram connection");
          clearTimeout(openTimeout);
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
          }
          if (idleCheckInterval) {
            clearInterval(idleCheckInterval);
            idleCheckInterval = null;
          }
          if (!connection) return false;
          try {
            // Set isOpen=false BEFORE finish() so Close handler sees wasOpen=false
            // and does NOT fire onClose — prevents spurious reconnect on deliberate end
            isOpen = false;
            connection.finish();
            console.log("✅ Deepgram finished");
            return true;
          } catch (e) {
            console.error("❌ Error finishing Deepgram:", e.message);
            return false;
          }
        },

        isConnected() {
          return isOpen;
        },

        getReadyState() {
          if (isConnecting) return 0;
          return isOpen ? 1 : 3;
        },

        async waitForReady(timeout = 5000) {
          if (isOpen) return true;
          if (connectionError) throw connectionError;
          return Promise.race([
            openPromise,
            new Promise((_, reject) =>
              setTimeout(
                () =>
                  reject(new Error(`waitForReady timeout after ${timeout}ms`)),
                timeout,
              ),
            ),
          ]);
        },

        resetIdleTimer() {
          lastSpeechTime = Date.now();
          idleAlreadyTriggered = false;
        },

        pauseIdleDetection() {
          if (idleCheckInterval) {
            clearInterval(idleCheckInterval);
            idleCheckInterval = null;
            console.log("⏸️ Idle detection paused");
          }
          idleAlreadyTriggered = true;
        },

        resumeIdleDetection() {
          if (!idleCheckInterval && isOpen) {
            lastSpeechTime = Date.now();
            idleAlreadyTriggered = false;
            idleCheckInterval = setInterval(() => {
              if (isOpen && !idleAlreadyTriggered) {
                if (Date.now() - lastSpeechTime >= IDLE_TIMEOUT) {
                  console.log("⏰ User idle detected (10s silence)");
                  idleAlreadyTriggered = true;
                  clearInterval(idleCheckInterval);
                  idleCheckInterval = null;
                  onIdle?.();
                }
              }
            }, 2000);
            console.log("▶️ Idle detection resumed");
          }
        },

        resetTranscriptState() {
          // Overwritten by socket controller after creation
        },
      };
    },
  };
}

module.exports = { createSTTSession };
