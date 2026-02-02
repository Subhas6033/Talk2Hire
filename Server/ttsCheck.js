// advanced-deepgram-diagnostics.js
require("dotenv").config();
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");

console.log("🔍 Advanced Deepgram Diagnostics\n");
console.log("=".repeat(60));

// Step 1: Check environment
console.log("\n📋 Step 1: Environment Check");
console.log("-".repeat(60));

if (!process.env.DEEPGRAM_API_KEY) {
  console.error("❌ DEEPGRAM_API_KEY not found in environment");
  console.log("💡 Make sure you have a .env file with DEEPGRAM_API_KEY set");
  process.exit(1);
}

const apiKey = process.env.DEEPGRAM_API_KEY.trim();

console.log(`✅ API Key found`);
console.log(`   Length: ${apiKey.length} chars`);
console.log(
  `   Preview: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
);
console.log(`   Contains spaces: ${apiKey.includes(" ") ? "⚠️ YES" : "✅ NO"}`);
console.log(
  `   Contains newlines: ${/[\r\n]/.test(apiKey) ? "⚠️ YES" : "✅ NO"}`
);
console.log(
  `   Valid format: ${/^[a-zA-Z0-9_-]+$/.test(apiKey) ? "✅ YES" : "⚠️ NO"}`
);

// Step 2: Test TTS (REST API)
console.log("\n🎤 Step 2: Testing TTS REST API");
console.log("-".repeat(60));

async function testTTS() {
  try {
    const deepgram = createClient(apiKey);

    console.log("Requesting TTS...");
    const response = await deepgram.speak.request(
      { text: "Test" },
      {
        model: "aura-asteria-en",
        encoding: "linear16",
        sample_rate: 24000,
      }
    );

    const stream = await response.getStream();
    let chunkCount = 0;

    for await (const chunk of stream) {
      if (chunk) chunkCount++;
      if (chunkCount >= 1) break; // Just need to verify we get data
    }

    if (chunkCount > 0) {
      console.log("✅ TTS API working - received audio data");
      console.log(`   Chunks received: ${chunkCount}`);
      return true;
    } else {
      console.log("⚠️ TTS responded but no audio data");
      return false;
    }
  } catch (error) {
    console.error("❌ TTS API failed");
    console.error(`   Status: ${error.status || "unknown"}`);
    console.error(`   Message: ${error.message}`);

    if (error.status === 401) {
      console.error("\n🚨 AUTHENTICATION FAILED");
      console.error("   Your API key is INVALID or EXPIRED");
      console.error(
        "   Action: Get a new key from https://console.deepgram.com/"
      );
    }
    return false;
  }
}

// Step 3: Test STT WebSocket with detailed logging
console.log("\n🎧 Step 3: Testing STT WebSocket Connection");
console.log("-".repeat(60));

async function testSTTWebSocket() {
  return new Promise((resolve) => {
    const deepgram = createClient(apiKey);

    let opened = false;
    let errorReceived = false;
    let closeCode = null;
    let closeReason = null;

    console.log("Creating WebSocket connection...");
    console.log("URL: wss://api.deepgram.com/v1/listen");
    console.log("Parameters:");
    console.log("  - model: nova-2");
    console.log("  - language: en");
    console.log("  - encoding: linear16");
    console.log("  - sample_rate: 48000");

    const connection = deepgram.listen.live({
      model: "nova-2",
      language: "en",
      smart_format: true,
      encoding: "linear16",
      sample_rate: 48000,
      channels: 1,
    });

    const timeout = setTimeout(() => {
      if (!opened) {
        console.error("❌ Connection timeout (10s)");
        console.error("   WebSocket never opened");
        if (closeCode) {
          console.error(`   Close code: ${closeCode}`);
          console.error(`   Close reason: ${closeReason || "none provided"}`);
        }
        connection.finish();
        resolve(false);
      }
    }, 10000);

    connection.on(LiveTranscriptionEvents.Open, () => {
      console.log("✅ WebSocket OPENED successfully!");
      opened = true;
      clearTimeout(timeout);
      connection.finish();

      setTimeout(() => {
        resolve(true);
      }, 100);
    });

    connection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error("❌ WebSocket ERROR event received");
      console.error(`   Type: ${error.constructor.name}`);
      console.error(`   Message: ${error.message}`);
      console.error(`   Status Code: ${error.statusCode || "none"}`);
      console.error(`   Ready State: ${error.readyState || "unknown"}`);

      if (error.statusCode === 401 || error.message.includes("401")) {
        console.error("\n🚨 AUTHENTICATION ERROR");
        console.error("   The API key was rejected by Deepgram");
      } else if (!error.statusCode) {
        console.error("\n🚨 CONNECTION FAILED");
        console.error("   Possible causes:");
        console.error("   1. Network connectivity issue");
        console.error("   2. Firewall blocking WebSocket connections");
        console.error(
          "   3. Invalid API key (rejected before status code returned)"
        );
        console.error("   4. Deepgram service issue");
      }

      errorReceived = true;
      clearTimeout(timeout);
    });

    connection.on(LiveTranscriptionEvents.Close, (event) => {
      closeCode = event?.code || "unknown";
      closeReason = event?.reason || "";

      console.log(`🔌 WebSocket CLOSE event received`);
      console.log(`   Code: ${closeCode}`);
      console.log(`   Reason: ${closeReason || "none provided"}`);
      console.log(`   Was clean: ${event?.wasClean ? "yes" : "no"}`);

      if (closeCode === 1006) {
        console.error("\n⚠️ Close code 1006 = Abnormal closure");
        console.error("   This usually means:");
        console.error("   1. Authentication failed (invalid API key)");
        console.error("   2. Network error (connection dropped)");
        console.error("   3. Server rejected the connection");
      }

      if (!opened && !errorReceived) {
        clearTimeout(timeout);
        resolve(false);
      }
    });

    connection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
      console.log("ℹ️ Metadata received:", metadata);
    });

    connection.on(LiveTranscriptionEvents.Warning, (warning) => {
      console.warn("⚠️ Warning received:", warning);
    });
  });
}

// Step 4: Network connectivity test
console.log("\n🌐 Step 4: Network Connectivity Test");
console.log("-".repeat(60));

async function testNetworkConnectivity() {
  try {
    const https = require("https");

    console.log("Testing HTTPS connection to api.deepgram.com...");

    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: "api.deepgram.com",
          port: 443,
          path: "/v1/projects",
          method: "GET",
          headers: {
            Authorization: `Token ${apiKey}`,
          },
        },
        (res) => {
          console.log(`✅ HTTPS connection successful`);
          console.log(`   Status: ${res.statusCode}`);

          if (res.statusCode === 401) {
            console.error("   ⚠️ But authentication failed (401)");
            console.error("   Your API key is INVALID");
          } else if (res.statusCode === 200) {
            console.log("   ✅ Authentication successful");
          }

          resolve(res.statusCode === 200);
        }
      );

      req.on("error", (error) => {
        console.error("❌ Network connection failed");
        console.error(`   Error: ${error.message}`);
        console.error("\n   Possible causes:");
        console.error("   1. No internet connection");
        console.error("   2. Firewall blocking HTTPS");
        console.error("   3. DNS resolution failure");
        resolve(false);
      });

      req.setTimeout(5000, () => {
        console.error("❌ Connection timeout");
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  } catch (error) {
    console.error("❌ Network test failed:", error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  const ttsWorking = await testTTS();
  console.log();

  const networkWorking = await testNetworkConnectivity();
  console.log();

  const sttWorking = await testSTTWebSocket();

  console.log("\n" + "=".repeat(60));
  console.log("📊 DIAGNOSTIC SUMMARY");
  console.log("=".repeat(60));
  console.log(
    `TTS REST API:        ${ttsWorking ? "✅ WORKING" : "❌ FAILED"}`
  );
  console.log(
    `Network Connection:  ${networkWorking ? "✅ WORKING" : "❌ FAILED"}`
  );
  console.log(
    `STT WebSocket:       ${sttWorking ? "✅ WORKING" : "❌ FAILED"}`
  );

  console.log("\n🔍 DIAGNOSIS:");

  if (!ttsWorking && !networkWorking && !sttWorking) {
    console.log("❌ INVALID API KEY");
    console.log("\n📝 ACTION REQUIRED:");
    console.log("1. Go to https://console.deepgram.com/");
    console.log("2. Generate a NEW API key");
    console.log("3. Update your .env file:");
    console.log("   DEEPGRAM_API_KEY=your_new_key_here");
    console.log("4. Restart your server");
  } else if (ttsWorking && networkWorking && !sttWorking) {
    console.log("⚠️ REST API works but WebSocket fails");
    console.log("\n📝 POSSIBLE CAUSES:");
    console.log("1. Firewall blocking WebSocket connections (wss://)");
    console.log("2. Network proxy issues");
    console.log("3. Rate limiting on WebSocket connections");
    console.log("\n💡 TRY:");
    console.log("1. Check firewall settings");
    console.log("2. Test from different network");
    console.log("3. Contact Deepgram support");
  } else if (!networkWorking) {
    console.log("❌ NETWORK CONNECTIVITY ISSUE");
    console.log("\n📝 ACTION REQUIRED:");
    console.log("1. Check internet connection");
    console.log("2. Check firewall settings");
    console.log("3. Try from different network");
  } else if (ttsWorking && sttWorking) {
    console.log("✅ ALL TESTS PASSED!");
    console.log("\nYour Deepgram credentials are working correctly.");
    console.log("If your app still has issues, check application logs.");
  }

  console.log("\n" + "=".repeat(60));
}

runAllTests().catch((error) => {
  console.error("\n❌ Unexpected error during diagnostics:", error);
  process.exit(1);
});
