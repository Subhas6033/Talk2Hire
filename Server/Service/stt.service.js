const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");

/**
 * Creates a Speech-to-Text session using Deepgram API
 * Optimized for low-latency real-time transcription
 * Handles WebSocket connection lifecycle and audio streaming
 */
function createSTTSession() {
  // Validate API key is configured
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY is not set in environment variables");
  }

  const apiKey = process.env.DEEPGRAM_API_KEY.trim();
  console.log(
    "🔑 Using Deepgram API Key:",
    apiKey.substring(0, 15) + "..." + apiKey.substring(apiKey.length - 4),
  );

  const deepgram = createClient(apiKey);

  return {
    /**
     * Start live transcription session with optimized settings
     *
     * @param {Object} callbacks - Event handlers for transcription events
     * @param {Function} callbacks.onTranscript - Called when final transcript is ready
     * @param {Function} callbacks.onInterim - Called for interim transcription results
     * @param {Function} callbacks.onError - Called when an error occurs
     * @param {Function} callbacks.onClose - Called when connection closes
     * @param {Function} callbacks.onIdle - Called when user is idle (no speech detected)
     * @returns {Object} Connection interface with control methods
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

      // ✅ FIXED: Idle detection state with better control
      let lastSpeechTime = Date.now();
      let idleCheckInterval = null;
      let idleAlreadyTriggered = false; // ✅ NEW: Prevent multiple idle triggers
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
        console.log("🎤 Initiating Deepgram WebSocket connection");

        // OPTIMIZED: Connection configuration for low latency
        const options = {
          model: "nova-2", // Latest Deepgram model with best accuracy
          language: "en", // English language
          smart_format: true, // Auto-format transcripts (punctuation, capitalization)
          encoding: "linear16", // PCM16 audio encoding
          sample_rate: 48000, // 48kHz sample rate (matches client)
          channels: 1, // Mono audio
          interim_results: true, // Enable interim results for real-time feedback
          endpointing: 300, // OPTIMIZED: 300ms silence detection (faster than default 500ms)
          utterance_end_ms: 1000, // OPTIMIZED: 1s utterance end detection (faster than default 1500ms)
          vad_events: true, // Voice Activity Detection events
        };

        console.log("⚙️ Connection options:", JSON.stringify(options, null, 2));

        connection = deepgram.listen.live(options);

        // OPTIMIZED: Connection timeout - fail fast if not open within 8 seconds
        openTimeout = setTimeout(() => {
          if (!isOpen && isConnecting) {
            console.error(
              "❌ Connection timeout - WebSocket never opened after 8 seconds",
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
        }, 8000); // OPTIMIZED: 8 seconds instead of 10

        /**
         * OPTIMIZED: Fast keep-alive with error recovery
         * Sends keep-alive packets every 2 seconds to prevent connection drops
         */
        const startKeepAlive = () => {
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
          }

          let failureCount = 0;
          const MAX_FAILURES = 3;

          // Send initial keep-alive immediately upon connection
          if (isOpen && connection) {
            try {
              console.log("📡 Sending initial keep-alive packet");
              connection.keepAlive();
            } catch (e) {
              console.error("❌ Initial keep-alive error:", e.message);
            }
          }

          // OPTIMIZED: 2-second interval for better stability (was 3s, original was 5s)
          keepAliveInterval = setInterval(() => {
            if (isOpen && connection) {
              try {
                connection.keepAlive();
                failureCount = 0; // Reset on success
              } catch (e) {
                failureCount++;
                console.error(
                  `❌ Keep-alive error (${failureCount}/${MAX_FAILURES}):`,
                  e.message,
                );

                // Stop trying after too many failures to prevent spam
                if (failureCount >= MAX_FAILURES) {
                  console.error("❌ Too many keep-alive failures, stopping");
                  if (keepAliveInterval) {
                    clearInterval(keepAliveInterval);
                    keepAliveInterval = null;
                  }
                }
              }
            } else {
              // Connection not open, clear interval
              if (keepAliveInterval) {
                clearInterval(keepAliveInterval);
                keepAliveInterval = null;
              }
            }
          }, 2000); // OPTIMIZED: 2 seconds for best performance
        };

        /**
         * ✅ FIXED: Start idle detection to notify when user stops speaking
         * Now prevents multiple idle triggers with idleAlreadyTriggered flag
         */
        const startIdleDetection = () => {
          if (idleCheckInterval) {
            clearInterval(idleCheckInterval);
          }

          lastSpeechTime = Date.now();
          idleAlreadyTriggered = false; // ✅ Reset flag

          // ✅ OPTIMIZED: Check every 2 seconds instead of 1 (reduces CPU usage)
          idleCheckInterval = setInterval(() => {
            if (isOpen && !idleAlreadyTriggered) {
              const timeSinceLastSpeech = Date.now() - lastSpeechTime;
              if (timeSinceLastSpeech >= IDLE_TIMEOUT) {
                console.log("⏰ User idle detected (10 seconds of silence)");

                // ✅ CRITICAL: Set flag and pause detection to prevent multiple triggers
                idleAlreadyTriggered = true;

                if (idleCheckInterval) {
                  clearInterval(idleCheckInterval);
                  idleCheckInterval = null;
                }

                onIdle?.();
              }
            }
          }, 2000); // ✅ Changed from 1000ms to 2000ms
        };

        // ================================================================
        // EVENT HANDLERS
        // ================================================================

        /**
         * Handle successful connection opening
         */
        connection.on(LiveTranscriptionEvents.Open, () => {
          console.log("✅ Deepgram WebSocket OPEN - Connection successful");
          clearTimeout(openTimeout);
          isOpen = true;
          isConnecting = false;
          hasBeenOpened = true;

          if (openResolve) {
            openResolve(true);
          }

          // Start keep-alive and idle detection immediately
          startKeepAlive();
          startIdleDetection();
        });

        /**
         * Handle transcript events (both interim and final)
         */
        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
          const transcript = data.channel?.alternatives?.[0]?.transcript;

          if (!transcript || transcript.trim() === "") {
            return;
          }

          const isFinal = data.is_final;
          const speechFinal = data.speech_final;

          // ✅ Update last speech time and reset idle flag when we receive any transcript
          lastSpeechTime = Date.now();
          idleAlreadyTriggered = false;

          // Log transcript with type indicator
          const transcriptPreview =
            transcript.length > 50
              ? transcript.substring(0, 50) + "..."
              : transcript;

          console.log(
            `📝 Transcript [${isFinal ? "Final" : "Interim"}${speechFinal ? " - Speech Final" : ""}]:`,
            transcriptPreview,
          );

          // Send interim transcripts for real-time display
          if (!isFinal) {
            onInterim?.(transcript, data);
          }

          // Send final transcripts when speech is complete
          if (isFinal && speechFinal) {
            console.log("✅ Complete utterance received:", transcript);
            onTranscript?.(transcript, data);
          }
        });

        /**
         * Handle errors
         */
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

          // Reject open promise if connection never opened
          if (!hasBeenOpened && openReject) {
            openReject(err);
          }

          onError?.(err);
        });

        /**
         * Handle connection close
         */
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

        /**
         * Handle warnings (non-fatal issues)
         */
        connection.on(LiveTranscriptionEvents.Warning, (warning) => {
          console.warn("⚠️ Deepgram warning:", warning);
        });

        /**
         * Handle metadata (connection info, model info, etc.)
         */
        connection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
          console.log("ℹ️ Deepgram metadata:", {
            requestId: metadata.request_id,
            model: metadata.model_info?.name,
            version: metadata.model_info?.version,
          });
        });

        console.log(
          "🔄 WebSocket connection initiated, waiting for Open event",
        );
      } catch (error) {
        console.error("❌ Exception creating Deepgram connection:", error);
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

      // ================================================================
      // RETURN CONNECTION INTERFACE
      // ================================================================

      return {
        /**
         * Send audio data to Deepgram for transcription
         *
         * @param {ArrayBuffer} chunk - Audio data chunk (PCM16 format)
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
            console.error("❌ Error sending audio chunk:", error.message);
            isOpen = false;
            return false;
          }
        },

        /**
         * Close the connection gracefully
         * Sends any remaining audio and waits for final transcripts
         *
         * @returns {boolean} - True if closed successfully
         */
        finish() {
          console.log("🛑 Finishing Deepgram connection");
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
            console.log("✅ Deepgram connection finished");
            return true;
          } catch (error) {
            console.error("❌ Error finishing connection:", error.message);
            isOpen = false;
            isConnecting = false;
            return false;
          }
        },

        /**
         * Check if connection is open and ready
         *
         * @returns {boolean} - True if connection is open
         */
        isConnected() {
          return isOpen;
        },

        /**
         * Get WebSocket ready state
         *
         * @returns {number} - 0: connecting, 1: open, 3: closed
         */
        getReadyState() {
          if (isConnecting) return 0;
          return isOpen ? 1 : 3;
        },

        /**
         * Wait for connection to be ready
         * Useful for ensuring connection is open before sending audio
         *
         * @param {number} timeout - Timeout in milliseconds (default 5000)
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
         * Useful when you know user is active but not speaking
         */
        resetIdleTimer() {
          lastSpeechTime = Date.now();
          idleAlreadyTriggered = false; // ✅ Reset flag
          console.log("🔄 Idle timer manually reset");
        },

        /**
         * ✅ FIXED: Pause idle detection
         * Useful when you don't want idle callbacks during certain periods
         */
        pauseIdleDetection() {
          if (idleCheckInterval) {
            clearInterval(idleCheckInterval);
            idleCheckInterval = null;
            console.log("⏸️ Idle detection paused");
          }
          // ✅ Also set flag to prevent trigger during pause
          idleAlreadyTriggered = true;
        },

        /**
         * ✅ FIXED: Resume idle detection
         * Restarts idle detection after it was paused
         */
        resumeIdleDetection() {
          if (!idleCheckInterval && isOpen) {
            lastSpeechTime = Date.now();
            idleAlreadyTriggered = false; // ✅ Reset flag

            idleCheckInterval = setInterval(() => {
              if (isOpen && !idleAlreadyTriggered) {
                const timeSinceLastSpeech = Date.now() - lastSpeechTime;
                if (timeSinceLastSpeech >= IDLE_TIMEOUT) {
                  console.log("⏰ User idle detected (10 seconds of silence)");

                  // Set flag and pause to prevent multiple triggers
                  idleAlreadyTriggered = true;

                  if (idleCheckInterval) {
                    clearInterval(idleCheckInterval);
                    idleCheckInterval = null;
                  }

                  onIdle?.();
                }
              }
            }, 2000); // ✅ 2 second interval

            console.log("▶️ Idle detection resumed");
          }
        },
      };
    },
  };
}

module.exports = { createSTTSession };
