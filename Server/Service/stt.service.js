const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");

/**
 * Creates a Speech-to-Text session using Deepgram API
 * Handles WebSocket connection lifecycle and audio streaming
 */
function createSTTSession() {
  // Validate API key is configured
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY is not set in environment variables");
  }

  const apiKey = process.env.DEEPGRAM_API_KEY.trim();
  console.log(
    "Using Deepgram API Key:",
    apiKey.substring(0, 15) + "..." + apiKey.substring(apiKey.length - 4),
  );
  console.log("API Key length:", apiKey.length);

  const deepgram = createClient(apiKey);

  return {
    /**
     * Start live transcription session
     * @param {Object} callbacks - Event handlers for transcription events
     * @param {Function} callbacks.onTranscript - Called when final transcript is ready
     * @param {Function} callbacks.onInterim - Called for interim transcription results
     * @param {Function} callbacks.onError - Called when an error occurs
     * @param {Function} callbacks.onClose - Called when connection closes
     * @param {Function} callbacks.onIdle - Called when user is idle (no speech detected)
     */
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

      // Idle detection state
      let lastSpeechTime = Date.now();
      let idleCheckInterval = null;
      const IDLE_TIMEOUT = 10000; // 10 seconds of silence triggers idle

      // Promise to track connection opening
      let openResolve = null;
      let openReject = null;
      const openPromise = new Promise((resolve, reject) => {
        openResolve = resolve;
        openReject = reject;
      });

      try {
        isConnecting = true;
        console.log("Initiating Deepgram WebSocket connection");

        // Connection configuration
        const options = {
          model: "nova-2", // Latest Deepgram model
          language: "en", // English language
          smart_format: true, // Auto-format transcripts
          encoding: "linear16", // PCM16 audio encoding
          sample_rate: 48000, // 48kHz sample rate
          channels: 1, // Mono audio
        };

        console.log("Connection options:", JSON.stringify(options, null, 2));

        connection = deepgram.listen.live(options);

        // Set connection timeout - fail if not open within 10 seconds
        openTimeout = setTimeout(() => {
          if (!isOpen && isConnecting) {
            console.error(
              "Connection timeout - WebSocket never opened after 10 seconds",
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

            if (openReject) {
              openReject(timeoutError);
            }

            onError?.(timeoutError);
          }
        }, 10000);

        // OPTIMIZED: Start keep-alive with faster 3-second interval
        const startKeepAlive = () => {
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
          }

          // Send initial keep-alive immediately upon connection
          if (isOpen && connection) {
            try {
              console.log("Sending initial keep-alive packet");
              connection.keepAlive();
            } catch (e) {
              console.error("Initial keep-alive error:", e.message);
            }
          }

          // IMPROVED: Reduced interval from 5000ms to 3000ms for better connection stability
          keepAliveInterval = setInterval(() => {
            if (isOpen && connection) {
              try {
                console.log("Sending keep-alive packet");
                connection.keepAlive();
              } catch (e) {
                console.error("Keep-alive error:", e.message);
                // Clear interval on error to prevent spam
                if (keepAliveInterval) {
                  clearInterval(keepAliveInterval);
                  keepAliveInterval = null;
                }
              }
            } else {
              // Connection not open, clear interval
              if (keepAliveInterval) {
                clearInterval(keepAliveInterval);
                keepAliveInterval = null;
              }
            }
          }, 3000); // OPTIMIZED: 3 seconds instead of 5 seconds
        };

        // Start idle detection to notify when user stops speaking
        const startIdleDetection = () => {
          if (idleCheckInterval) {
            clearInterval(idleCheckInterval);
          }

          lastSpeechTime = Date.now();

          // Check for idle every second
          idleCheckInterval = setInterval(() => {
            if (isOpen) {
              const timeSinceLastSpeech = Date.now() - lastSpeechTime;
              if (timeSinceLastSpeech >= IDLE_TIMEOUT) {
                console.log("User idle detected (10 seconds of silence)");
                onIdle?.();
                // Reset timer after triggering idle
                lastSpeechTime = Date.now();
              }
            }
          }, 1000);
        };

        // Handle successful connection opening
        connection.on(LiveTranscriptionEvents.Open, () => {
          console.log("Deepgram WebSocket OPEN - Connection successful");
          clearTimeout(openTimeout);
          isOpen = true;
          isConnecting = false;
          hasBeenOpened = true;

          if (openResolve) {
            openResolve(true);
          }

          // IMPROVED: Start keep-alive and idle detection immediately
          startKeepAlive();
          startIdleDetection();
        });

        // Handle transcript events
        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
          const transcript = data.channel?.alternatives?.[0]?.transcript;

          if (!transcript || transcript.trim() === "") {
            return;
          }

          const isFinal = data.is_final;
          const speechFinal = data.speech_final;

          // Update last speech time when we receive any transcript
          lastSpeechTime = Date.now();

          console.log(
            `Transcript [${isFinal ? "Final" : "Interim"}${speechFinal ? " - Speech Final" : ""}]:`,
            transcript.substring(0, 50),
          );

          // Send interim transcripts for real-time display
          if (!isFinal) {
            onInterim?.(transcript, data);
          }

          // Send final transcripts when speech is complete
          if (isFinal && speechFinal) {
            console.log("Complete utterance received:", transcript);
            onTranscript?.(transcript, data);
          }
        });

        // Handle errors
        connection.on(LiveTranscriptionEvents.Error, (err) => {
          console.error("Deepgram WebSocket Error Event:", {
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

          // Reject open promise if connection never opened
          if (!hasBeenOpened && openReject) {
            openReject(err);
          }

          onError?.(err);
        });

        // Handle connection close
        connection.on(LiveTranscriptionEvents.Close, (closeEvent) => {
          console.log("Deepgram WebSocket Close Event:", {
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

          // Reject open promise if connection closed before opening
          if (!hasBeenOpened && openReject) {
            const closeError = new Error(
              `WebSocket closed before opening (code: ${closeEvent?.code || "unknown"})`,
            );
            connectionError = closeError;
            openReject(closeError);
          }

          onClose?.();
        });

        // Handle warnings
        connection.on(LiveTranscriptionEvents.Warning, (warning) => {
          console.warn("Deepgram warning:", warning);
        });

        // Handle metadata
        connection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
          console.log("Deepgram metadata:", metadata);
        });

        console.log("WebSocket connection initiated, waiting for Open event");
      } catch (error) {
        console.error("Exception creating Deepgram connection:", error);
        clearTimeout(openTimeout);
        connectionError = error;

        // Clean up intervals
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
        if (idleCheckInterval) {
          clearInterval(idleCheckInterval);
          idleCheckInterval = null;
        }

        isConnecting = false;

        if (openReject) {
          openReject(error);
        }

        onError?.(error);
      }

      // Return connection interface
      return {
        /**
         * Send audio data to Deepgram for transcription
         * @param {ArrayBuffer} chunk - Audio data chunk
         * @returns {boolean} - True if sent successfully
         */
        send(chunk) {
          if (!connection || isConnecting || !isOpen) {
            return false;
          }

          try {
            connection.send(chunk);
            return true;
          } catch (error) {
            console.error("Error sending audio chunk:", error.message);
            isOpen = false;
            return false;
          }
        },

        /**
         * Close the connection gracefully
         * @returns {boolean} - True if closed successfully
         */
        finish() {
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

          if (!connection) {
            return false;
          }

          try {
            connection.finish();
            isOpen = false;
            isConnecting = false;
            return true;
          } catch (error) {
            console.error("Error finishing connection:", error.message);
            isOpen = false;
            isConnecting = false;
            return false;
          }
        },

        /**
         * Check if connection is open
         * @returns {boolean} - True if connection is open
         */
        isConnected() {
          return isOpen;
        },

        /**
         * Get WebSocket ready state
         * @returns {number} - 0: connecting, 1: open, 3: closed
         */
        getReadyState() {
          if (isConnecting) return 0;
          return isOpen ? 1 : 3;
        },

        /**
         * Wait for connection to be ready
         * @param {number} timeout - Timeout in milliseconds
         * @returns {Promise<boolean>} - Resolves when ready or rejects on timeout
         */
        async waitForReady(timeout = 5000) {
          if (isOpen) {
            return true;
          }

          if (connectionError) {
            throw connectionError;
          }

          return Promise.race([
            openPromise,
            new Promise((_, reject) => {
              setTimeout(() => {
                reject(new Error(`waitForReady timeout after ${timeout}ms`));
              }, timeout);
            }),
          ]);
        },

        /**
         * Manually reset idle timer
         */
        resetIdleTimer() {
          lastSpeechTime = Date.now();
          console.log("Idle timer manually reset");
        },

        /**
         * Pause idle detection
         */
        pauseIdleDetection() {
          if (idleCheckInterval) {
            clearInterval(idleCheckInterval);
            idleCheckInterval = null;
            console.log("Idle detection paused");
          }
        },

        /**
         * Resume idle detection
         */
        resumeIdleDetection() {
          if (!idleCheckInterval && isOpen) {
            lastSpeechTime = Date.now();
            idleCheckInterval = setInterval(() => {
              if (isOpen) {
                const timeSinceLastSpeech = Date.now() - lastSpeechTime;
                if (timeSinceLastSpeech >= IDLE_TIMEOUT) {
                  console.log("User idle detected (10 seconds of silence)");
                  onIdle?.();
                  lastSpeechTime = Date.now();
                }
              }
            }, 1000);
            console.log("Idle detection resumed");
          }
        },
      };
    },
  };
}

module.exports = { createSTTSession };
