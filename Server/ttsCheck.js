// test-deepgram.js
const { createClient } = require("@deepgram/sdk");
require("dotenv").config();

async function testDeepgram() {
  try {
    console.log("Testing Deepgram API key...");
    console.log(
      "API Key:",
      process.env.DEEPGRAM_API_KEY?.substring(0, 15) + "..."
    );

    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    // Test with a simple pre-recorded audio URL
    const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
      {
        url: "https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav",
      },
      {
        model: "nova-2",
        smart_format: true,
      }
    );

    if (error) {
      console.error("❌ Deepgram Error:", error);
      return;
    }

    console.log("✅ Deepgram API Key is valid!");
    console.log(
      "Transcript:",
      result.results.channels[0].alternatives[0].transcript
    );
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Full error:", error);
  }
}

testDeepgram();
