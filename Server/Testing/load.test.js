/**
 * Deepgram TTS + STT Load Test
 * Run: node deepgram.test.js
 *
 * Tests both TTS and STT directly against Deepgram — no server involved.
 * Simulates N simultaneous interview sessions, each doing:
 *   1. TTS: send text → receive audio stream → measure latency + errors
 *   2. STT: open WebSocket → stream raw PCM → measure transcript latency + errors
 *
 * Requirements:
 *   npm install ws node-fetch
 *   DEEPGRAM_API_KEY=your_key node deepgram.test.js
 */

const WS = require("ws");
const https = require("https");
const http = require("http");

// ─── Config ──────────────────────────────────────────────────────────────────
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
if (!DEEPGRAM_API_KEY) {
  console.error("❌ Set DEEPGRAM_API_KEY env variable before running");
  process.exit(1);
}

const CONCURRENT_SESSIONS = 5; // simulate 5 simultaneous interview users
const TTS_TEXTS = [
  "Tell me about yourself and your background in software engineering.",
  "What is your greatest strength and how has it helped you in your career?",
  "Describe a challenging project you worked on and how you handled it.",
  "Where do you see yourself in five years?",
  "Why do you want to work at our company?",
];

// Raw PCM silence at 48kHz mono 16-bit — mimics what STT receives from mic
// 48000 samples/sec × 2 bytes × 0.5s = 48000 bytes of silence
const SILENCE_DURATION_MS = 500;
const SAMPLE_RATE = 48000;
const SILENCE_CHUNK = Buffer.alloc(
  Math.floor((SAMPLE_RATE * 2 * SILENCE_DURATION_MS) / 1000),
  0,
);

// Thresholds — anything above these is a problem
const TTS_TTFB_WARN_MS = 500; // first audio byte should arrive in < 500ms
const TTS_TTFB_FAIL_MS = 1500; // above 1500ms is a hard failure
const STT_CONNECT_WARN_MS = 2000; // WebSocket open should happen in < 2s
const STT_CONNECT_FAIL_MS = 5000; // above 5s is a hard failure

// ─── Results collector ────────────────────────────────────────────────────────
const results = {
  tts: {
    attempts: 0,
    success: 0,
    errors: [],
    ttfb: [], // time-to-first-byte (ms)
    totalTime: [], // full stream duration (ms)
    totalBytes: [], // audio bytes received
  },
  stt: {
    attempts: 0,
    success: 0,
    errors: [],
    connectTime: [], // WebSocket open latency (ms)
    closed: 0,
  },
};

// ─── TTS Test ─────────────────────────────────────────────────────────────────
async function testTTS(sessionId, text) {
  results.tts.attempts++;
  const label = `[TTS S${sessionId}]`;

  return new Promise((resolve) => {
    const t0 = Date.now();
    let firstByteTime = null;
    let totalBytes = 0;
    let statusCode = null;

    const url = new URL("https://api.deepgram.com/v1/speak");
    url.searchParams.set("model", "aura-asteria-en");
    url.searchParams.set("encoding", "linear16");
    url.searchParams.set("sample_rate", "48000");
    url.searchParams.set("container", "none");

    const body = JSON.stringify({ text });

    const req = https.request(
      {
        hostname: "api.deepgram.com",
        path: `/v1/speak?${url.searchParams.toString()}`,
        method: "POST",
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 30000,
      },
      (res) => {
        statusCode = res.statusCode;

        if (res.statusCode !== 200) {
          let errBody = "";
          res.on("data", (d) => (errBody += d));
          res.on("end", () => {
            const msg = `HTTP ${res.statusCode}: ${errBody.slice(0, 200)}`;
            console.error(`${label} ❌ ${msg}`);
            results.tts.errors.push({ sessionId, msg });
            resolve({ success: false });
          });
          return;
        }

        const contentType = res.headers["content-type"] || "";
        if (contentType.includes("application/json")) {
          let errBody = "";
          res.on("data", (d) => (errBody += d));
          res.on("end", () => {
            const msg = `Unexpected JSON response: ${errBody.slice(0, 200)}`;
            console.error(`${label} ❌ ${msg}`);
            results.tts.errors.push({ sessionId, msg });
            resolve({ success: false });
          });
          return;
        }

        res.on("data", (chunk) => {
          if (firstByteTime === null) {
            firstByteTime = Date.now() - t0;
            const warn = firstByteTime > TTS_TTFB_WARN_MS ? "⚠️ SLOW" : "✅";
            console.log(
              `${label} ${warn} First audio byte: ${firstByteTime}ms (${chunk.length} bytes)`,
            );
          }
          totalBytes += chunk.length;
        });

        res.on("end", () => {
          const totalTime = Date.now() - t0;
          console.log(
            `${label} ✅ Complete: TTFB=${firstByteTime}ms total=${totalTime}ms bytes=${(totalBytes / 1024).toFixed(1)}KB`,
          );
          results.tts.success++;
          results.tts.ttfb.push(firstByteTime ?? 9999);
          results.tts.totalTime.push(totalTime);
          results.tts.totalBytes.push(totalBytes);
          resolve({
            success: true,
            ttfb: firstByteTime,
            totalTime,
            totalBytes,
          });
        });

        res.on("error", (err) => {
          console.error(`${label} ❌ Stream error: ${err.message}`);
          results.tts.errors.push({ sessionId, msg: err.message });
          resolve({ success: false });
        });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      const msg = "Request timeout (30s)";
      console.error(`${label} ❌ ${msg}`);
      results.tts.errors.push({ sessionId, msg });
      resolve({ success: false });
    });

    req.on("error", (err) => {
      console.error(`${label} ❌ Request error: ${err.message}`);
      results.tts.errors.push({ sessionId, msg: err.message });
      resolve({ success: false });
    });

    req.write(body);
    req.end();
  });
}

// ─── STT Test ─────────────────────────────────────────────────────────────────
async function testSTT(sessionId) {
  results.stt.attempts++;
  const label = `[STT S${sessionId}]`;

  return new Promise((resolve) => {
    const t0 = Date.now();
    let connectTime = null;
    let resolved = false;

    const sttUrl =
      `wss://api.deepgram.com/v1/listen` +
      `?model=nova-3` +
      `&language=en-US` +
      `&smart_format=true` +
      `&interim_results=true` +
      `&vad_events=true` +
      `&endpointing=200` +
      `&encoding=linear16` +
      `&sample_rate=48000` +
      `&channels=1`;

    const done = (success, extra = {}) => {
      if (resolved) return;
      resolved = true;
      resolve({ success, connectTime, ...extra });
    };

    const connectTimeout = setTimeout(() => {
      console.error(`${label} ❌ Connect timeout (${STT_CONNECT_FAIL_MS}ms)`);
      results.stt.errors.push({ sessionId, msg: "Connect timeout" });
      ws.terminate();
      done(false);
    }, STT_CONNECT_FAIL_MS);

    const ws = new WS(sttUrl, {
      headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
      handshakeTimeout: STT_CONNECT_FAIL_MS,
    });

    ws.on("open", () => {
      clearTimeout(connectTimeout);
      connectTime = Date.now() - t0;
      const warn = connectTime > STT_CONNECT_WARN_MS ? "⚠️ SLOW" : "✅";
      console.log(`${label} ${warn} WebSocket open: ${connectTime}ms`);
      results.stt.connectTime.push(connectTime);

      // Send 3 seconds worth of silence chunks to simulate real audio
      // This verifies the connection accepts audio without crashing
      let chunksSent = 0;
      const totalChunks = Math.ceil(3000 / SILENCE_DURATION_MS);

      const sendInterval = setInterval(() => {
        if (chunksSent >= totalChunks) {
          clearInterval(sendInterval);
          // Send CloseStream and close gracefully
          try {
            ws.send(JSON.stringify({ type: "CloseStream" }));
          } catch (_) {}
          setTimeout(() => {
            ws.close(1000);
          }, 500);
          return;
        }
        try {
          ws.send(SILENCE_CHUNK);
          chunksSent++;
        } catch (e) {
          clearInterval(sendInterval);
          console.error(`${label} ❌ Send error: ${e.message}`);
        }
      }, SILENCE_DURATION_MS);
    });

    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        const type = data?.type;
        // Log any meaningful events — silence won't produce transcripts
        // but we want to see if the connection is alive and responding
        if (type === "Metadata") {
          console.log(
            `${label} 📋 Metadata received (connection confirmed healthy)`,
          );
        }
        if (type === "Results") {
          const text = data?.channel?.alternatives?.[0]?.transcript?.trim();
          if (text) console.log(`${label} 📝 Transcript: "${text}"`);
        }
        if (type === "error") {
          console.error(
            `${label} ❌ Deepgram error event:`,
            JSON.stringify(data),
          );
          results.stt.errors.push({ sessionId, msg: JSON.stringify(data) });
        }
      } catch (_) {}
    });

    ws.on("close", (code, reason) => {
      results.stt.closed++;
      const ok = code === 1000 || code === 1001;
      console.log(
        `${label} ${ok ? "✅" : "⚠️"} Closed — code=${code} reason=${reason?.toString() || "none"}`,
      );
      if (ok) results.stt.success++;
      else
        results.stt.errors.push({ sessionId, msg: `Closed with code ${code}` });
      done(ok);
    });

    ws.on("error", (err) => {
      clearTimeout(connectTimeout);
      console.error(`${label} ❌ WebSocket error: ${err.message}`);
      results.stt.errors.push({ sessionId, msg: err.message });
      done(false);
    });
  });
}

// ─── Percentile helper ────────────────────────────────────────────────────────
function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function avg(arr) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

// ─── Run all sessions concurrently ───────────────────────────────────────────
async function runSession(sessionId) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`🚀 Session ${sessionId} starting`);

  const text = TTS_TEXTS[sessionId % TTS_TEXTS.length];

  // Run TTS and STT in parallel — same as a real interview (AI speaks while
  // mic is open)
  const [ttsResult, sttResult] = await Promise.all([
    testTTS(sessionId, text),
    testSTT(sessionId),
  ]);

  console.log(
    `✅ Session ${sessionId} done — TTS:${ttsResult.success ? "OK" : "FAIL"} STT:${sttResult.success ? "OK" : "FAIL"}`,
  );
}

async function main() {
  console.log("=".repeat(60));
  console.log(`🧪 Deepgram TTS + STT Load Test`);
  console.log(`   Concurrent sessions: ${CONCURRENT_SESSIONS}`);
  console.log(`   API key: ${DEEPGRAM_API_KEY.slice(0, 8)}...`);
  console.log("=".repeat(60));

  const t0 = Date.now();

  // Launch all sessions simultaneously
  await Promise.all(
    Array.from({ length: CONCURRENT_SESSIONS }, (_, i) => runSession(i + 1)),
  );

  const totalTime = Date.now() - t0;

  // ─── Print report ────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("📊 RESULTS");
  console.log("=".repeat(60));

  console.log("\n── TTS ──────────────────────────────────────────────────");
  console.log(`  Attempts  : ${results.tts.attempts}`);
  console.log(
    `  Success   : ${results.tts.success} (${Math.round((results.tts.success / results.tts.attempts) * 100)}%)`,
  );
  console.log(`  Errors    : ${results.tts.errors.length}`);
  if (results.tts.ttfb.length) {
    console.log(
      `  TTFB avg  : ${avg(results.tts.ttfb)}ms   (warn > ${TTS_TTFB_WARN_MS}ms, fail > ${TTS_TTFB_FAIL_MS}ms)`,
    );
    console.log(`  TTFB p50  : ${percentile(results.tts.ttfb, 50)}ms`);
    console.log(`  TTFB p95  : ${percentile(results.tts.ttfb, 95)}ms`);
    console.log(`  TTFB max  : ${Math.max(...results.tts.ttfb)}ms`);
    console.log(`  Duration avg : ${avg(results.tts.totalTime)}ms`);
    console.log(
      `  Bytes avg : ${Math.round(avg(results.tts.totalBytes) / 1024)}KB`,
    );
  }
  if (results.tts.errors.length) {
    console.log("\n  TTS Errors:");
    results.tts.errors.forEach((e) =>
      console.log(`    Session ${e.sessionId}: ${e.msg}`),
    );
  }

  console.log("\n── STT ──────────────────────────────────────────────────");
  console.log(`  Attempts  : ${results.stt.attempts}`);
  console.log(
    `  Success   : ${results.stt.success} (${Math.round((results.stt.success / results.stt.attempts) * 100)}%)`,
  );
  console.log(`  Errors    : ${results.stt.errors.length}`);
  if (results.stt.connectTime.length) {
    console.log(
      `  Connect avg : ${avg(results.stt.connectTime)}ms   (warn > ${STT_CONNECT_WARN_MS}ms, fail > ${STT_CONNECT_FAIL_MS}ms)`,
    );
    console.log(`  Connect p50 : ${percentile(results.stt.connectTime, 50)}ms`);
    console.log(`  Connect p95 : ${percentile(results.stt.connectTime, 95)}ms`);
    console.log(`  Connect max : ${Math.max(...results.stt.connectTime)}ms`);
  }
  if (results.stt.errors.length) {
    console.log("\n  STT Errors:");
    results.stt.errors.forEach((e) =>
      console.log(`    Session ${e.sessionId}: ${e.msg}`),
    );
  }

  console.log("\n── Summary ──────────────────────────────────────────────");
  console.log(`  Total wall time : ${totalTime}ms`);

  const ttsOk =
    results.tts.success === results.tts.attempts &&
    percentile(results.tts.ttfb, 95) < TTS_TTFB_FAIL_MS;
  const sttOk =
    results.stt.success === results.stt.attempts &&
    percentile(results.stt.connectTime, 95) < STT_CONNECT_FAIL_MS;

  console.log(`  TTS verdict : ${ttsOk ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  STT verdict : ${sttOk ? "✅ PASS" : "❌ FAIL"}`);

  if (!ttsOk || !sttOk) {
    console.log("\n⚠️  What the failures mean:");
    if (
      results.tts.errors.some(
        (e) => e.msg.includes("404") || e.msg.includes("401"),
      )
    ) {
      console.log(
        "   TTS 404/401 → API key is wrong or the aura-asteria-en model is not enabled on your plan",
      );
    }
    if (results.tts.errors.some((e) => e.msg.includes("405"))) {
      console.log(
        "   TTS 405 → Wrong HTTP method or endpoint — check TTS_API_URL",
      );
    }
    if (results.stt.errors.some((e) => e.msg.includes("401"))) {
      console.log(
        "   STT 401 → API key rejected by Deepgram WebSocket endpoint",
      );
    }
    if (results.stt.errors.some((e) => e.msg.includes("timeout"))) {
      console.log(
        "   STT timeout → Network connectivity issue to api.deepgram.com from your server",
      );
    }
    if (percentile(results.tts.ttfb, 95) > TTS_TTFB_WARN_MS) {
      console.log(
        `   TTS slow TTFB (${percentile(results.tts.ttfb, 95)}ms p95) → high latency to Deepgram from your location (Siliguri). Consider a VPN or proxy closer to Deepgram's servers (US East).`,
      );
    }
  }

  console.log("=".repeat(60));
  process.exit(ttsOk && sttOk ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
