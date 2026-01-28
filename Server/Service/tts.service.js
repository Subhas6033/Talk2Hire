// Service/tts.service.js
const { createClient } = require("@deepgram/sdk");

function createTTSStream() {
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  return {
    /**
     * Stream TTS audio chunks via callback
     * @param {string} text - Text to convert to speech
     * @param {function} onChunk - Callback (chunk) => void, called with null when done
     */
    speakStream: async function (text, onChunk) {
      if (!text || typeof text !== "string") {
        console.error("❌ Invalid text for TTS");
        onChunk(null);
        return;
      }

      try {
        console.log("🔊 Requesting TTS from Deepgram...");
        console.log("📝 Text length:", text.length, "characters");

        const response = await deepgram.speak.request(
          { text },
          {
            model: "aura-asteria-en",
            encoding: "linear16",
            sample_rate: 48000,
            container: "none",
          }
        );

        const stream = await response.getStream();

        if (!stream) {
          console.error("❌ No audio stream returned from Deepgram");
          onChunk(null);
          return;
        }

        console.log("✅ TTS stream started");

        let chunkCount = 0;
        let totalBytes = 0;

        // Process stream chunks
        for await (const chunk of stream) {
          if (chunk && chunk.length > 0) {
            chunkCount++;
            totalBytes += chunk.length;

            // Send chunk to callback
            onChunk(chunk);
          }
        }

        console.log(
          `✅ TTS streaming complete: ${totalBytes} bytes in ${chunkCount} chunks`
        );

        // Signal end of stream
        onChunk(null);
      } catch (error) {
        console.error("❌ TTS streaming error:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
        });

        // Signal end even on error
        onChunk(null);
      }
    },

    /**
     * Get complete audio buffer (alternative method)
     * @param {string} text - Text to convert to speech
     * @returns {Promise<Buffer>} Complete audio buffer
     */
    speakBuffer: async function (text) {
      if (!text || typeof text !== "string") {
        throw new Error("Invalid text for TTS");
      }

      try {
        console.log("🔊 Requesting complete TTS buffer from Deepgram...");

        const response = await deepgram.speak.request(
          { text },
          {
            model: "aura-asteria-en",
            encoding: "linear16",
            sample_rate: 48000,
            container: "none",
          }
        );

        const stream = await response.getStream();

        if (!stream) {
          throw new Error("No audio stream returned from Deepgram");
        }

        const chunks = [];
        for await (const chunk of stream) {
          if (chunk) {
            chunks.push(chunk);
          }
        }

        const buffer = Buffer.concat(chunks);
        console.log(`✅ TTS buffer complete: ${buffer.length} bytes`);

        return buffer;
      } catch (error) {
        console.error("❌ TTS buffer error:", error);
        throw error;
      }
    },
  };
}

module.exports = { createTTSStream };
