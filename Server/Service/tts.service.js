// Service/tts.service.js
const https = require("https");

// IMPORTANT: Deepgram supports these sample rates for linear16: 8000, 16000, 24000, 32000, 48000
// We use 48000 for high quality audio

exports.createTTSStream = () => {
  /**
   * Stream TTS audio from Deepgram
   * @param {string} text - Text to convert to speech
   * @param {function} onChunk - Callback function (chunk: Buffer | null)
   */
  const speakStream = (text, onChunk) => {
    if (!text || text.trim() === "") {
      console.log("⚠️ Empty text provided to TTS");
      onChunk(null);
      return;
    }

    if (!process.env.DEEPGRAM_API_KEY) {
      console.error("❌ DEEPGRAM_API_KEY not set in environment variables");
      onChunk(null);
      return;
    }

    console.log(
      "🔊 Starting TTS for text:",
      text.substring(0, 100) + (text.length > 100 ? "..." : "")
    );

    const body = JSON.stringify({ text });

    const options = {
      hostname: "api.deepgram.com",
      // CORRECTED: Use 48000 Hz (Deepgram supported rate)
      path: "/v1/speak?model=aura-orpheus-en&encoding=linear16&sample_rate=48000",
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    console.log("📡 Making TTS request to Deepgram (48kHz)...");

    const req = https.request(options, (res) => {
      console.log("✅ TTS response started, status:", res.statusCode);

      if (res.statusCode !== 200) {
        console.error("❌ TTS error, status:", res.statusCode);
        console.error("❌ Error header:", res.headers["dg-error"]);

        let errorBody = "";
        res.on("data", (chunk) => {
          errorBody += chunk.toString();
        });

        res.on("end", () => {
          console.error("❌ Error response body:", errorBody);
          onChunk(null);
        });
        return;
      }

      let totalBytes = 0;
      let chunkCount = 0;

      res.on("data", (chunk) => {
        chunkCount++;
        totalBytes += chunk.length;
        console.log(
          `📦 TTS chunk #${chunkCount}: ${chunk.length} bytes (total: ${totalBytes})`
        );

        const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        onChunk(bufferChunk);
      });

      res.on("end", () => {
        console.log(
          `✅ TTS stream complete. Total: ${totalBytes} bytes in ${chunkCount} chunks`
        );
        onChunk(null);
      });

      res.on("error", (error) => {
        console.error("❌ TTS response stream error:", error);
        onChunk(null);
      });
    });

    req.on("error", (error) => {
      console.error("❌ TTS request error:", error.message);
      onChunk(null);
    });

    req.on("timeout", () => {
      console.error("❌ TTS request timeout");
      req.destroy();
      onChunk(null);
    });

    req.setTimeout(30000);

    try {
      req.write(body);
      req.end();
      console.log("📤 TTS request sent");
    } catch (error) {
      console.error("❌ Error writing/ending request:", error);
      onChunk(null);
    }
  };

  return {
    speakStream,
  };
};
