const { createClient } = require("@deepgram/sdk");
require("dotenv").config();

async function testDeepgramConnection() {
  console.log("🔍 Testing Deepgram API Key...");

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error("❌ DEEPGRAM_API_KEY not found in environment");
    return;
  }

  console.log(
    "✅ API Key found:",
    process.env.DEEPGRAM_API_KEY.substring(0, 10) + "..."
  );

  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    // Test with a simple pre-recorded transcription
    console.log("🧪 Testing API connection...");

    const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
      {
        url: "https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav",
      },
      {
        model: "nova-2",
      }
    );

    if (error) {
      console.error("❌ API Error:", error);
      return;
    }

    console.log("✅ API Key is VALID!");
    console.log(
      "📝 Test transcription:",
      result.results?.channels?.[0]?.alternatives?.[0]?.transcript
    );
  } catch (error) {
    console.error("❌ Connection failed:", error.message);

    if (
      error.message.includes("401") ||
      error.message.includes("unauthorized")
    ) {
      console.error("🔑 Your API key is INVALID or EXPIRED");
    } else if (error.message.includes("403")) {
      console.error("🚫 Your API key doesn't have permission for this feature");
    } else if (
      error.message.includes("network") ||
      error.message.includes("ENOTFOUND")
    ) {
      console.error(
        "🌐 Network connection issue - check your internet/firewall"
      );
    }
  }
}

testDeepgramConnection();
