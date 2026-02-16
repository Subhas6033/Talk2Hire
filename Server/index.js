const http = require("http");
const app = require("./app.js");
const { pool } = require("./Config/database.config.js");
const createAllTables = require("./Utils/db.utils.js");
const {
  initInterviewSocket,
} = require("./Controllers/interviewSocket.controller.js");

const PORT = process.env.PORT;

// Create HTTP server
const server = http.createServer(app);

async function testDeepgramLatency() {
  console.log("\n=================================================");
  console.log("🌐 TESTING DEEPGRAM API CONNECTIVITY");
  console.log("=================================================\n");

  const tests = [
    {
      name: "Deepgram API Health",
      url: "https://api.deepgram.com",
      method: "HEAD",
    },
    {
      name: "Deepgram STT Endpoint",
      url: "https://api.deepgram.com/v1/listen",
      method: "HEAD",
    },
    {
      name: "Deepgram TTS Endpoint",
      url: "https://api.deepgram.com/v1/speak",
      method: "HEAD",
    },
  ];

  for (const test of tests) {
    try {
      const start = Date.now();
      const response = await fetch(test.url, {
        method: test.method,
        headers: {
          Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        },
      });
      const latency = Date.now() - start;

      const status =
        latency < 100
          ? "✅ EXCELLENT"
          : latency < 200
            ? "✅ GOOD"
            : latency < 500
              ? "⚠️  FAIR"
              : "❌ POOR";

      console.log(`${status} ${test.name}: ${latency}ms (${response.status})`);

      if (latency > 300) {
        console.warn(
          `   ⚠️  Warning: High latency detected. This will affect TTS performance.`,
        );
      }
    } catch (error) {
      console.error(`❌ FAILED ${test.name}:`, error.message);
    }
  }

  console.log("\n=================================================\n");
}

pool
  .getConnection()
  .then(async (connection) => {
    connection.release();
    console.log("✅ Connected to DB");
    app.get("/", (req, res) => {
      res.send(
        "Welcome to the Quantamhash Corporation AI Interview Platform Server",
      );
    });

    // Initialize Socket.IO
    initInterviewSocket(server);

    // Start server
    server.listen(PORT, async () => {
      try {
        await createAllTables(pool);
        await testDeepgramLatency();
        console.log(`🚀 Server running at ${PORT}`);
        console.log(`🔌 Socket.IO ready`);
      } catch (error) {
        console.error("❌ Error creating tables:", error);
        throw error;
      }
    });
  })
  .catch((err) => {
    console.error("❌ Error while connecting to DB:", err);
    process.exit(1);
  });
