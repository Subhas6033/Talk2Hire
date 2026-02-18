const { createClient } = require("@deepgram/sdk");
require("dotenv").config();
const DEEPGRAM_TTS_URL = "https://api.deepgram.com/v1/speak";
const DEEPGRAM_MODEL = "aura-asteria-en";
const SAMPLE_RATE = 48000;

function createTTSStream() {
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY is not set in environment variables");
  }

  const apiKey = process.env.DEEPGRAM_API_KEY.trim();

  return {
    /**
     * Stream TTS audio chunks as they arrive from Deepgram.
     * Calls onChunk(Buffer) for each chunk, then onChunk(null) when done.
     *
     * Uses fetch() + ReadableStream reader for genuine low-latency streaming.
     */
    speakStream: async function (text, onChunk) {
      if (!text?.trim()) {
        console.error("❌ Empty text for TTS");
        onChunk(null);
        return;
      }

      const trimmed = text.trim();
      const startTime = Date.now();
      let chunkCount = 0;
      let totalBytes = 0;

      try {
        console.log(`🔊 TTS request: "${trimmed.slice(0, 60)}…"`);

        const url = new URL(DEEPGRAM_TTS_URL);
        url.searchParams.set("model", DEEPGRAM_MODEL);
        url.searchParams.set("encoding", "linear16");
        url.searchParams.set("sample_rate", String(SAMPLE_RATE));
        url.searchParams.set("container", "none");

        const response = await fetch(url.toString(), {
          method: "POST",
          headers: {
            Authorization: `Token ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: trimmed }),
        });

        if (!response.ok) {
          const err = await response.text().catch(() => response.statusText);
          throw new Error(`Deepgram TTS HTTP ${response.status}: ${err}`);
        }

        if (!response.body) {
          throw new Error("Deepgram TTS response has no body stream");
        }

        // Read the response body as a stream of Uint8Array chunks.
        // Node 18+ fetch provides a Web Streams ReadableStream here.
        const reader = response.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value && value.length > 0) {
            chunkCount++;
            totalBytes += value.length;

            if (chunkCount === 1) {
              console.log(
                `🎵 TTS first chunk: ${Date.now() - startTime}ms, ${value.length} bytes`,
              );
            }

            // Convert Uint8Array → Buffer for Socket.IO compatibility
            onChunk(Buffer.from(value));
          }
        }

        const totalTime = Date.now() - startTime;
        console.log(
          `✅ TTS complete: ${chunkCount} chunks, ${totalBytes} bytes, ${totalTime}ms`,
        );

        onChunk(null); // signal done
      } catch (err) {
        console.error(
          `❌ TTS error after ${Date.now() - startTime}ms:`,
          err.message,
        );
        onChunk(null); // signal done even on error
      }
    },

    /**
     * Get complete audio as a single Buffer (non-streaming, for other uses).
     */
    speakBuffer: async function (text) {
      if (!text?.trim()) throw new Error("Empty text for TTS");

      const url = new URL(DEEPGRAM_TTS_URL);
      url.searchParams.set("model", DEEPGRAM_MODEL);
      url.searchParams.set("encoding", "linear16");
      url.searchParams.set("sample_rate", String(SAMPLE_RATE));
      url.searchParams.set("container", "none");

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!response.ok) {
        throw new Error(`Deepgram TTS HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    },
  };
}

module.exports = { createTTSStream };
