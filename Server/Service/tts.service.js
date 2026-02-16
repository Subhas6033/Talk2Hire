const { createClient } = require("@deepgram/sdk");

/**
 * Creates a Text-to-Speech service using Deepgram API
 * Optimized for low-latency streaming audio generation
 */
function createTTSStream() {
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY is not set in environment variables");
  }

  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  return {
    /**
     * Stream audio in real-time as it's generated
     * OPTIMIZED: Streams chunks immediately without waiting for full response
     *
     * @param {string} text - Text to convert to speech
     * @param {Function} onChunk - Callback for each audio chunk (called with null when done)
     */
    speakStream: async function (text, onChunk) {
      if (!text || typeof text !== "string") {
        console.error("❌ Invalid text for TTS");
        onChunk(null);
        return;
      }

      // Trim and validate text
      const trimmedText = text.trim();
      if (trimmedText.length === 0) {
        console.error("❌ Empty text for TTS");
        onChunk(null);
        return;
      }

      const startTime = Date.now();

      try {
        console.log("🔊 Starting TTS stream...", {
          textLength: trimmedText.length,
          preview: trimmedText.substring(0, 50) + "...",
        });

        // ✅ FIX: Must await the request to get the response object
        const response = await deepgram.speak.request(
          { text: trimmedText },
          {
            model: "aura-asteria-en", // Natural female voice
            encoding: "linear16", // PCM16 format
            sample_rate: 48000, // 48kHz for high quality
            container: "none", // Raw audio, no container
          },
        );

        console.log(
          "🔍 Deepgram response received, checking for stream method...",
        );

        // ✅ FIX: Handle different SDK versions and response formats
        let stream;

        // Try different methods to get the stream
        if (typeof response.getStream === "function") {
          console.log("✅ Using response.getStream() method");
          stream = await response.getStream();
        } else if (typeof response.stream === "function") {
          console.log("✅ Using response.stream() method");
          stream = response.stream();
        } else if (response.readable || response[Symbol.asyncIterator]) {
          console.log("✅ Response itself is a readable stream");
          stream = response;
        } else if (typeof response.getAudio === "function") {
          console.log(
            "✅ Using response.getAudio() - will send as single chunk",
          );
          const audioBuffer = await response.getAudio();

          if (audioBuffer) {
            const buffer = Buffer.isBuffer(audioBuffer)
              ? audioBuffer
              : Buffer.from(audioBuffer);

            const firstChunkTime = Date.now();
            console.log(`🎵 Audio ready (${firstChunkTime - startTime}ms)`);
            console.log(`✅ TTS complete: ${buffer.length} bytes in 1 chunk`);

            onChunk(buffer);
          }

          onChunk(null);
          return;
        } else {
          // Debug: show what's available on the response
          console.error("❌ Unknown response format. Available methods:", {
            type: typeof response,
            constructor: response?.constructor?.name,
            keys: Object.keys(response || {}),
            hasGetStream: "getStream" in (response || {}),
            hasStream: "stream" in (response || {}),
            hasGetAudio: "getAudio" in (response || {}),
          });
          throw new Error(
            "Deepgram response does not have a recognized stream method. " +
              "Available keys: " +
              Object.keys(response || {}).join(", "),
          );
        }

        if (!stream) {
          console.error("❌ No audio stream returned from Deepgram");
          onChunk(null);
          return;
        }

        const streamStartTime = Date.now();
        console.log(`✅ TTS stream ready (${streamStartTime - startTime}ms)`);

        let chunkCount = 0;
        let totalBytes = 0;
        let firstChunkTime = null;

        // OPTIMIZED: Stream chunks as they arrive - no buffering
        for await (const chunk of stream) {
          if (chunk && chunk.length > 0) {
            chunkCount++;
            totalBytes += chunk.length;

            // Track first chunk latency
            if (chunkCount === 1) {
              firstChunkTime = Date.now();
              console.log(
                `🎵 First chunk received (${firstChunkTime - startTime}ms total latency)`,
              );
            }

            // Send chunk immediately to client
            onChunk(chunk);

            // Log progress every 10 chunks to avoid spam
            if (chunkCount % 10 === 0) {
              const elapsed = Date.now() - startTime;
              console.log(
                `📊 TTS Progress: ${chunkCount} chunks, ${totalBytes} bytes, ${elapsed}ms`,
              );
            }
          }
        }

        const totalTime = Date.now() - startTime;
        const avgChunkSize =
          chunkCount > 0 ? Math.round(totalBytes / chunkCount) : 0;

        console.log(`✅ TTS stream complete:`, {
          totalChunks: chunkCount,
          totalBytes,
          totalTime: `${totalTime}ms`,
          avgChunkSize: `${avgChunkSize} bytes`,
          firstChunkLatency: firstChunkTime
            ? `${firstChunkTime - startTime}ms`
            : "N/A",
        });

        // Signal end of stream
        onChunk(null);
      } catch (error) {
        console.error("❌ TTS streaming error:", {
          message: error.message,
          code: error.code,
          statusCode: error.statusCode,
          stack: error.stack, // ✅ Added stack trace for debugging
        });

        // Always signal end even on error
        onChunk(null);
      }
    },

    /**
     * Get complete audio buffer (alternative method for non-streaming use)
     * NOTE: This is slower than speakStream - only use when you need the full audio upfront
     *
     * @param {string} text - Text to convert to speech
     * @returns {Promise<Buffer>} Complete audio buffer
     */
    speakBuffer: async function (text) {
      if (!text || typeof text !== "string") {
        throw new Error("Invalid text for TTS");
      }

      const trimmedText = text.trim();
      if (trimmedText.length === 0) {
        throw new Error("Empty text for TTS");
      }

      const startTime = Date.now();

      try {
        console.log("🔊 Requesting complete TTS buffer from Deepgram...", {
          textLength: trimmedText.length,
        });

        const response = await deepgram.speak.request(
          { text: trimmedText },
          {
            model: "aura-asteria-en",
            encoding: "linear16",
            sample_rate: 48000,
            container: "none",
          },
        );

        // ✅ FIX: Handle different response formats
        let audioData;

        if (typeof response.getAudio === "function") {
          audioData = await response.getAudio();
        } else if (typeof response.getStream === "function") {
          const stream = await response.getStream();
          const chunks = [];
          for await (const chunk of stream) {
            if (chunk) chunks.push(chunk);
          }
          audioData = Buffer.concat(chunks);
        } else if (typeof response.stream === "function") {
          const stream = response.stream();
          const chunks = [];
          for await (const chunk of stream) {
            if (chunk) chunks.push(chunk);
          }
          audioData = Buffer.concat(chunks);
        } else {
          throw new Error("Unable to extract audio from Deepgram response");
        }

        const buffer = Buffer.isBuffer(audioData)
          ? audioData
          : Buffer.from(audioData);

        const totalTime = Date.now() - startTime;

        console.log(`✅ TTS buffer complete:`, {
          bytes: buffer.length,
          time: `${totalTime}ms`,
        });

        return buffer;
      } catch (error) {
        console.error("❌ TTS buffer error:", {
          message: error.message,
          code: error.code,
          stack: error.stack,
        });
        throw error;
      }
    },
  };
}

module.exports = { createTTSStream };
