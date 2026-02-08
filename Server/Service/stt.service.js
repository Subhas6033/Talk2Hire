const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");

function createSTTSession() {
  // Verify API key exists
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error("❌ DEEPGRAM_API_KEY is not set in environment variables");
  }

  const apiKey = process.env.DEEPGRAM_API_KEY.trim();
  console.log(
    "🔑 Using Deepgram API Key:",
    apiKey.substring(0, 15) + "..." + apiKey.substring(apiKey.length - 4),
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
      let hasBeenOpened = false; // ✅ Track if connection ever successfully opened
      let connectionError = null; // ✅ Store any error that occurs
      let openTimeout = null;
      let keepAliveInterval = null;

      // Idle detection
      let lastSpeechTime = Date.now();
      let idleCheckInterval = null;
      const IDLE_TIMEOUT = 10000; // 10 seconds

      // ✅ Promise resolvers for waitForReady
      let openResolve = null;
      let openReject = null;
      const openPromise = new Promise((resolve, reject) => {
        openResolve = resolve;
        openReject = reject;
      });

      try {
        isConnecting = true;
        console.log("🎤 Initiating Deepgram WebSocket connection...");

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

        // ✅ IMPROVED: Timeout that rejects the open promise
        openTimeout = setTimeout(() => {
          if (!isOpen && isConnecting) {
            console.error(
              "❌ Connection timeout - WebSocket never opened after 10 seconds",
            );
            isConnecting = false;
            const timeoutError = new Error(
              "WebSocket connection timeout - never opened",
            );
            connectionError = timeoutError;

            if (connection) {
              try {
                connection.finish();
              } catch (e) {
                console.error(
                  "Error finishing connection on timeout:",
                  e.message,
                );
              }
              connection = null;
            }

            // ✅ Reject the open promise
            if (openReject) {
              openReject(timeoutError);
            }

            onError?.(timeoutError);
          }
        }, 10000);

        // ✅ IMPROVED: Set up keep-alive ONLY after connection opens
        const startKeepAlive = () => {
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
          }

          keepAliveInterval = setInterval(() => {
            if (isOpen && connection) {
              try {
                console.log("💓 Sending keep-alive");
                connection.keepAlive();
              } catch (e) {
                console.error("❌ Keep-alive error:", e.message);
                // Stop keep-alive on error
                if (keepAliveInterval) {
                  clearInterval(keepAliveInterval);
                  keepAliveInterval = null;
                }
              }
            } else {
              // Stop keep-alive if connection is no longer open
              if (keepAliveInterval) {
                clearInterval(keepAliveInterval);
                keepAliveInterval = null;
              }
            }
          }, 5000);
        };

        // ✅ IMPROVED: Start idle detection ONLY after connection opens
        const startIdleDetection = () => {
          if (idleCheckInterval) {
            clearInterval(idleCheckInterval);
          }

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
        };

        connection.on(LiveTranscriptionEvents.Open, () => {
          console.log(
            "✅✅✅ Deepgram WebSocket OPEN - Connection successful!",
          );
          clearTimeout(openTimeout);
          isOpen = true;
          isConnecting = false;
          hasBeenOpened = true;

          // ✅ Resolve the open promise
          if (openResolve) {
            openResolve(true);
          }

          // ✅ Start keep-alive and idle detection NOW
          startKeepAlive();
          startIdleDetection();
        });

        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
          const transcript = data.channel?.alternatives?.[0]?.transcript;

          if (!transcript || transcript.trim() === "") {
            return;
          }

          const isFinal = data.is_final;
          const speechFinal = data.speech_final;

          // Reset idle timer on any speech
          lastSpeechTime = Date.now();

          // Log transcript type
          console.log(
            `📝 [${isFinal ? "Final" : "Interim"}${speechFinal ? " - Speech Final" : ""}]:`,
            transcript.substring(0, 50),
          );

          // Handle interim results
          if (!isFinal) {
            onInterim?.(transcript, data);
          }

          // Handle final transcript
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
          connectionError = err;

          // Clean up intervals
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

          // ✅ Reject the open promise if connection never opened
          if (!hasBeenOpened && openReject) {
            openReject(err);
          }

          onError?.(err);
        });

        connection.on(LiveTranscriptionEvents.Close, (closeEvent) => {
          console.log("🔌 Deepgram WebSocket Close Event:", {
            code: closeEvent?.code,
            reason: closeEvent?.reason,
            wasClean: closeEvent?.wasClean,
          });

          clearTimeout(openTimeout);

          // Clean up intervals
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

          // ✅ If connection never opened, reject the promise
          if (!hasBeenOpened && openReject) {
            const closeError = new Error(
              `WebSocket closed before opening (code: ${closeEvent?.code || "unknown"})`,
            );
            connectionError = closeError;
            openReject(closeError);
          }

          onClose?.();
        });

        connection.on(LiveTranscriptionEvents.Warning, (warning) => {
          console.warn("⚠️ Deepgram warning:", warning);
        });

        connection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
          console.log("ℹ️ Deepgram metadata:", metadata);
        });

        console.log(
          "🔄 WebSocket connection initiated, waiting for Open event...",
        );
      } catch (error) {
        console.error("❌ Exception creating Deepgram connection:", error);
        clearTimeout(openTimeout);
        connectionError = error;

        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
        if (idleCheckInterval) {
          clearInterval(idleCheckInterval);
          idleCheckInterval = null;
        }

        isConnecting = false;

        // ✅ Reject the open promise
        if (openReject) {
          openReject(error);
        }

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

        // ✅ IMPROVED: Use the promise-based approach
        async waitForReady(timeout = 5000) {
          // If already open, resolve immediately
          if (isOpen) {
            return true;
          }

          // If there was already an error, reject immediately
          if (connectionError) {
            throw connectionError;
          }

          // Race between the open promise and a timeout
          return Promise.race([
            openPromise,
            new Promise((_, reject) => {
              setTimeout(() => {
                reject(new Error(`waitForReady timeout after ${timeout}ms`));
              }, timeout);
            }),
          ]);
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
