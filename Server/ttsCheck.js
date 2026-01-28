require("dotenv").config();
const https = require("https");

console.log("=".repeat(60));
console.log("DEEPGRAM TTS STREAMING TEST (CORRECTED)");
console.log("=".repeat(60));

// Check environment
console.log("\n1. Environment Check:");
console.log("   API Key exists:", !!process.env.DEEPGRAM_API_KEY);
if (process.env.DEEPGRAM_API_KEY) {
  console.log(
    "   API Key prefix:",
    process.env.DEEPGRAM_API_KEY.substring(0, 10) + "..."
  );
  console.log("   API Key length:", process.env.DEEPGRAM_API_KEY.length);
} else {
  console.error("   ❌ DEEPGRAM_API_KEY not found in environment!");
  console.log("   Set it in .env file or export DEEPGRAM_API_KEY=your_key");
  process.exit(1);
}

// Test text
const testText =
  "Hello, this is a test of the Deepgram text to speech streaming API.";
console.log("\n2. Test Parameters:");
console.log("   Text:", testText);
console.log("   Model: aura-orpheus-en");
console.log("   Encoding: linear16");
console.log("   Sample Rate: 48000 (CORRECTED)");

// Make request
console.log("\n3. Making TTS Request...");

const body = JSON.stringify({ text: testText });

const options = {
  hostname: "api.deepgram.com",
  // CORRECTED: Changed from 44100 to 48000
  path: "/v1/speak?model=aura-orpheus-en&encoding=linear16&sample_rate=48000",
  method: "POST",
  headers: {
    Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  },
};

let totalBytes = 0;
let chunkCount = 0;
const startTime = Date.now();

const req = https.request(options, (res) => {
  console.log("\n4. Response Received:");
  console.log("   Status Code:", res.statusCode);
  console.log("   Status Message:", res.statusMessage);
  console.log("   Headers:", JSON.stringify(res.headers, null, 2));

  if (res.statusCode !== 200) {
    console.error("\n❌ ERROR: Non-200 status code!");

    let errorBody = "";
    res.on("data", (chunk) => {
      errorBody += chunk.toString();
    });

    res.on("end", () => {
      console.error("   Error Response Body:", errorBody);
      console.log("\n" + "=".repeat(60));
      console.log("TEST FAILED");
      console.log("=".repeat(60));
      process.exit(1);
    });
    return;
  }

  console.log("\n5. Streaming Audio Data:");

  res.on("data", (chunk) => {
    chunkCount++;
    totalBytes += chunk.length;

    console.log(`   Chunk #${chunkCount}:`);
    console.log(`     - Size: ${chunk.length} bytes`);
    console.log(`     - Type: ${chunk.constructor.name}`);
    console.log(`     - Is Buffer: ${Buffer.isBuffer(chunk)}`);
    console.log(`     - Total so far: ${totalBytes} bytes`);

    // Show first chunk's first few bytes
    if (chunkCount === 1) {
      console.log(
        `     - First 20 bytes: [${Array.from(chunk.slice(0, 20)).join(", ")}]`
      );
    }
  });

  res.on("end", () => {
    const duration = Date.now() - startTime;

    console.log("\n6. Stream Complete:");
    console.log(`   ✅ SUCCESS!`);
    console.log(`   - Total chunks: ${chunkCount}`);
    console.log(`   - Total bytes: ${totalBytes}`);
    console.log(`   - Duration: ${duration}ms`);
    console.log(
      `   - Audio length: ~${(totalBytes / 2 / 48000).toFixed(2)} seconds`
    );

    if (totalBytes === 0) {
      console.log("\n   ⚠️  WARNING: No audio data received!");
      console.log("   This might indicate:");
      console.log("   - Empty response from Deepgram");
      console.log("   - API key issues");
      console.log("   - Service problems");
    } else {
      console.log("\n   🎉 TTS is working correctly!");
      console.log("   You can now use this in your application.");
    }

    console.log("\n" + "=".repeat(60));
    console.log("TEST COMPLETED SUCCESSFULLY");
    console.log("=".repeat(60));
    process.exit(0);
  });

  res.on("error", (error) => {
    console.error("\n❌ Response Stream Error:", error.message);
    console.error("   Full error:", error);
    process.exit(1);
  });
});

req.on("error", (error) => {
  console.error("\n❌ Request Error:", error.message);
  console.error("   Full error:", error);

  if (error.code === "ENOTFOUND") {
    console.log("\n   Possible causes:");
    console.log("   - No internet connection");
    console.log("   - DNS resolution failure");
    console.log("   - Firewall blocking api.deepgram.com");
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST FAILED");
  console.log("=".repeat(60));
  process.exit(1);
});

req.on("timeout", () => {
  console.error("\n❌ Request Timeout (30s)");
  req.destroy();
  process.exit(1);
});

req.setTimeout(30000);

try {
  req.write(body);
  req.end();
  console.log("   Request sent successfully");
} catch (error) {
  console.error("\n❌ Error sending request:", error);
  process.exit(1);
}

// Overall timeout
setTimeout(() => {
  console.error("\n❌ Overall test timeout (35s)");
  console.log("   No response received from Deepgram");
  process.exit(1);
}, 35000);
