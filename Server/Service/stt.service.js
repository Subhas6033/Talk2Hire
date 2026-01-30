const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");

function createSTTSession() {
  // Verify API key exists
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error("❌ DEEPGRAM_API_KEY is not set in environment variables");
  }

  const apiKey = process.env.DEEPGRAM_API_KEY.trim();
  console.log(
    "🔑 Using Deepgram API Key:",
    apiKey.substring(0, 15) + "..." + apiKey.substring(apiKey.length - 4)
  );
  console.log("🔑 API Key length:", apiKey.length);

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
      let openTimeout = null;
      let keepAliveInterval = null;

      // ✅ NEW: Idle detection
      let lastSpeechTime = Date.now();
      let idleCheckInterval = null;
      const IDLE_TIMEOUT = 10000; // 10 seconds

      try {
        isConnecting = true;
        console.log("🎤 Initiating Deepgram WebSocket connection...");

        // Options based on official Deepgram Flux documentation
        const options = {
          model: "nova-2",
          language: "en",
          smart_format: true,
          encoding: "linear16",
          sample_rate: 48000,
          channels: 1,
        };

        console.log("📋 Connection options:", JSON.stringify(options, null, 2));

        connection = deepgram.listen.live(options);

        // Set a timeout to detect if connection never opens
        openTimeout = setTimeout(() => {
          if (!isOpen && isConnecting) {
            console.error(
              "❌ Connection timeout - WebSocket never opened after 10 seconds"
            );
            isConnecting = false;

            if (connection) {
              try {
                connection.finish();
              } catch (e) {
                // ignore
              }
            }

            onError?.(new Error("WebSocket connection timeout"));
          }
        }, 10000);

        // Set up keep-alive interval (every 5 seconds)
        keepAliveInterval = setInterval(() => {
          if (isOpen && connection) {
            try {
              console.log("💓 Sending keep-alive");
              connection.keepAlive();
            } catch (e) {
              console.error("❌ Keep-alive error:", e);
            }
          }
        }, 5000);

        // ✅ NEW: Start idle detection interval
        idleCheckInterval = setInterval(() => {
          if (isOpen) {
            const timeSinceLastSpeech = Date.now() - lastSpeechTime;
            if (timeSinceLastSpeech >= IDLE_TIMEOUT) {
              console.log("⏰ User idle detected (10 seconds of silence)");
              onIdle?.();
              // Reset timer after triggering idle
              lastSpeechTime = Date.now();
            }
          }
        }, 1000); // Check every second

        connection.on(LiveTranscriptionEvents.Open, () => {
          console.log(
            "✅✅✅ Deepgram WebSocket OPEN - Connection successful!"
          );
          clearTimeout(openTimeout);
          isOpen = true;
          isConnecting = false;
          // ✅ Reset idle timer when connection opens
          lastSpeechTime = Date.now();
        });

        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
          const transcript = data.channel?.alternatives?.[0]?.transcript;

          if (!transcript || transcript.trim() === "") {
            return;
          }

          const isFinal = data.is_final;
          const speechFinal = data.speech_final;

          // ✅ NEW: Reset idle timer on any speech
          lastSpeechTime = Date.now();

          // Log transcript type
          console.log(
            `📝 [${isFinal ? "Final" : "Interim"}${speechFinal ? " - Speech Final" : ""}]:`,
            transcript.substring(0, 50)
          );

          // Handle interim results
          if (!isFinal) {
            onInterim?.(transcript, data);
          }

          // Handle final transcript
          // speech_final indicates the end of a speech segment
          if (isFinal && speechFinal) {
            console.log("✅ Complete utterance received:", transcript);
            onTranscript?.(transcript, data);
          }
        });

        connection.on(LiveTranscriptionEvents.Error, (err) => {
          console.error("❌ Deepgram WebSocket Error Event:", {
            message: err.message,
            statusCode: err.statusCode,
            type: err.constructor.name,
          });

          clearTimeout(openTimeout);
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
          }
          // ✅ NEW: Clear idle interval on error
          if (idleCheckInterval) {
            clearInterval(idleCheckInterval);
            idleCheckInterval = null;
          }
          isOpen = false;
          isConnecting = false;
          onError?.(err);
        });

        connection.on(LiveTranscriptionEvents.Close, (closeEvent) => {
          console.log("🔌 Deepgram WebSocket Close Event:", {
            code: closeEvent?.code,
            reason: closeEvent?.reason,
            wasClean: closeEvent?.wasClean,
          });

          clearTimeout(openTimeout);
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
          }
          // ✅ NEW: Clear idle interval on close
          if (idleCheckInterval) {
            clearInterval(idleCheckInterval);
            idleCheckInterval = null;
          }
          isOpen = false;
          isConnecting = false;
          onClose?.();
        });

        connection.on(LiveTranscriptionEvents.Warning, (warning) => {
          console.warn("⚠️ Deepgram warning:", warning);
        });

        connection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
          console.log("ℹ️ Deepgram metadata:", metadata);
        });

        console.log(
          "🔄 WebSocket connection initiated, waiting for Open event..."
        );
      } catch (error) {
        console.error("❌ Exception creating Deepgram connection:", error);
        clearTimeout(openTimeout);
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
        // ✅ NEW: Clear idle interval on exception
        if (idleCheckInterval) {
          clearInterval(idleCheckInterval);
          idleCheckInterval = null;
        }
        isConnecting = false;
        onError?.(error);
      }

      // Return connection wrapper
      return {
        send(chunk) {
          if (!connection || isConnecting || !isOpen) {
            return false;
          }

          try {
            connection.send(chunk);
            return true;
          } catch (error) {
            console.error("❌ Error sending audio chunk:", error.message);
            isOpen = false;
            return false;
          }
        },

        finish() {
          clearTimeout(openTimeout);
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
          }
          // ✅ NEW: Clear idle interval on finish
          if (idleCheckInterval) {
            clearInterval(idleCheckInterval);
            idleCheckInterval = null;
          }

          if (!connection) {
            return false;
          }

          try {
            connection.finish();
            isOpen = false;
            isConnecting = false;
            return true;
          } catch (error) {
            console.error("❌ Error finishing connection:", error.message);
            isOpen = false;
            isConnecting = false;
            return false;
          }
        },

        isConnected() {
          return isOpen;
        },

        getReadyState() {
          if (isConnecting) return 0; // CONNECTING
          return isOpen ? 1 : 3; // OPEN : CLOSED
        },

        waitForReady(timeout = 5000) {
          return new Promise((resolve, reject) => {
            if (isOpen) {
              resolve(true);
              return;
            }

            const startTime = Date.now();
            const checkInterval = setInterval(() => {
              if (isOpen) {
                clearInterval(checkInterval);
                resolve(true);
              } else if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                reject(new Error("Connection timeout"));
              }
            }, 100);
          });
        },

        // Method to reset idle timer manually
        resetIdleTimer() {
          lastSpeechTime = Date.now();
          console.log("🔄 Idle timer manually reset");
        },

        // Method to pause/resume idle detection
        pauseIdleDetection() {
          if (idleCheckInterval) {
            clearInterval(idleCheckInterval);
            idleCheckInterval = null;
            console.log("⏸️ Idle detection paused");
          }
        },

        resumeIdleDetection() {
          if (!idleCheckInterval && isOpen) {
            lastSpeechTime = Date.now();
            idleCheckInterval = setInterval(() => {
              if (isOpen) {
                const timeSinceLastSpeech = Date.now() - lastSpeechTime;
                if (timeSinceLastSpeech >= IDLE_TIMEOUT) {
                  console.log("⏰ User idle detected (10 seconds of silence)");
                  onIdle?.();
                  lastSpeechTime = Date.now();
                }
              }
            }, 1000);
            console.log("▶️ Idle detection resumed");
          }
        },
      };
    },
  };
}

module.exports = { createSTTSession };
