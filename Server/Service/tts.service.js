const { createClient } = require("@deepgram/sdk");
require("dotenv").config();

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

      const trimmedText = text.trim();
      if (trimmedText.length === 0) {
        console.error("❌ Empty text for TTS");
        onChunk(null);
        return;
      }

      const startTime = Date.now();
      let requestSentTime = null;
      let responseReceivedTime = null;
      let streamReadyTime = null;
      let firstChunkTime = null;

      try {
        console.log("🔊 Starting TTS request...", {
          textLength: trimmedText.length,
          preview: trimmedText.substring(0, 50) + "...",
        });

        //  OPTIMIZED: Start request and track timing
        requestSentTime = Date.now();
        console.log(
          `⏱️  [T+${requestSentTime - startTime}ms] Request sent to Deepgram`,
        );

        const response = await deepgram.speak.request(
          { text: trimmedText },
          {
            model: "aura-asteria-en",
            encoding: "linear16",
            sample_rate: 48000,
            container: "none",
          },
        );

        responseReceivedTime = Date.now();
        console.log(
          `⏱️  [T+${responseReceivedTime - startTime}ms] Response received (${responseReceivedTime - requestSentTime}ms network latency)`,
        );

        //  Get stream method
        let stream;

        if (typeof response.getStream === "function") {
          console.log(" Using response.getStream() method");
          const streamStartGet = Date.now();
          stream = await response.getStream();
          streamReadyTime = Date.now();
          console.log(
            `⏱️  [T+${streamReadyTime - startTime}ms] Stream ready (getStream took ${streamReadyTime - streamStartGet}ms)`,
          );
        } else if (typeof response.stream === "function") {
          console.log(" Using response.stream() method");
          stream = response.stream();
          streamReadyTime = Date.now();
          console.log(`⏱️  [T+${streamReadyTime - startTime}ms] Stream ready`);
        } else if (response.readable || response[Symbol.asyncIterator]) {
          console.log(" Response itself is a readable stream");
          stream = response;
          streamReadyTime = Date.now();
          console.log(`⏱️  [T+${streamReadyTime - startTime}ms] Stream ready`);
        } else if (typeof response.getAudio === "function") {
          console.log(
            "⚠️  Using response.getAudio() - single chunk mode (not streaming)",
          );
          const audioStartTime = Date.now();
          const audioBuffer = await response.getAudio();
          const audioReadyTime = Date.now();

          console.log(
            `⏱️  [T+${audioReadyTime - startTime}ms] Audio ready (getAudio took ${audioReadyTime - audioStartTime}ms)`,
          );

          if (audioBuffer) {
            const buffer = Buffer.isBuffer(audioBuffer)
              ? audioBuffer
              : Buffer.from(audioBuffer);

            console.log(
              ` TTS complete: ${buffer.length} bytes in 1 chunk (${audioReadyTime - startTime}ms total)`,
            );
            onChunk(buffer);
          }

          onChunk(null);
          return;
        } else {
          console.error("❌ Unknown response format. Available methods:", {
            keys: Object.keys(response || {}),
          });
          throw new Error(
            "Deepgram response does not have a recognized stream method",
          );
        }

        if (!stream) {
          console.error("❌ No audio stream returned from Deepgram");
          onChunk(null);
          return;
        }

        let chunkCount = 0;
        let totalBytes = 0;

        //  Stream chunks as they arrive
        for await (const chunk of stream) {
          if (chunk && chunk.length > 0) {
            chunkCount++;
            totalBytes += chunk.length;

            if (chunkCount === 1) {
              firstChunkTime = Date.now();
              const networkLatency = responseReceivedTime - requestSentTime;
              const processingLatency = firstChunkTime - responseReceivedTime;

              console.log(
                `🎵 FIRST CHUNK RECEIVED [T+${firstChunkTime - startTime}ms]`,
              );
              console.log(`   📊 Breakdown:`);
              console.log(`      - Network latency: ${networkLatency}ms`);
              console.log(`      - Processing latency: ${processingLatency}ms`);
              console.log(`      - Total: ${firstChunkTime - startTime}ms`);
              console.log(`      - Chunk size: ${chunk.length} bytes`);
            }

            //  Send immediately - NO buffering
            onChunk(chunk);

            // Log every 10 chunks
            if (chunkCount % 10 === 0) {
              const elapsed = Date.now() - startTime;
              console.log(
                `📊 [T+${elapsed}ms] Progress: ${chunkCount} chunks, ${totalBytes} bytes`,
              );
            }
          }
        }

        const totalTime = Date.now() - startTime;
        const avgChunkSize =
          chunkCount > 0 ? Math.round(totalBytes / chunkCount) : 0;

        console.log(` TTS STREAM COMPLETE:`);
        console.log(`   📊 Summary:`);
        console.log(`      - Total chunks: ${chunkCount}`);
        console.log(`      - Total bytes: ${totalBytes}`);
        console.log(`      - Total time: ${totalTime}ms`);
        console.log(`      - Avg chunk size: ${avgChunkSize} bytes`);
        console.log(
          `      - First chunk latency: ${firstChunkTime ? firstChunkTime - startTime : "N/A"}ms`,
        );
        console.log(
          `      - Throughput: ${Math.round(totalBytes / (totalTime / 1000))} bytes/sec`,
        );

        onChunk(null);
      } catch (error) {
        const errorTime = Date.now();
        console.error(`❌ TTS ERROR [T+${errorTime - startTime}ms]:`, {
          message: error.message,
          code: error.code,
          statusCode: error.statusCode,
        });
        console.error("Stack trace:", error.stack);
        onChunk(null);
      }
    },

    /**
     * Get complete audio buffer (alternative method for non-streaming use)
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
        console.log("🔊 Requesting TTS buffer...", {
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

        console.log(
          ` TTS buffer complete: ${buffer.length} bytes in ${totalTime}ms`,
        );

        return buffer;
      } catch (error) {
        console.error("❌ TTS buffer error:", {
          message: error.message,
          stack: error.stack,
        });
        throw error;
      }
    },
  };
}

module.exports = { createTTSStream };
