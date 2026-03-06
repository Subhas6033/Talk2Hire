/**
 * Deepgram STT Connection Tester
 *
 * Run with:  node deepgram-test.js
 *
 * Tests:
 *   1. API key validity (REST ping)
 *   2. nova-2 WebSocket connection
 *   3. nova-3 WebSocket connection (to confirm it fails)
 *   4. Sends 1 second of silence — confirms Deepgram accepts audio
 */

const WS = require("ws");
const https = require("https");
require("dotenv").config()
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

if (!DEEPGRAM_API_KEY) {
  console.error("\n❌  DEEPGRAM_API_KEY is not set.");
  console.error(
    "    Run:  DEEPGRAM_API_KEY=your_key_here node deepgram-test.js\n",
  );
  process.exit(1);
}

console.log(
  `\n🔑  Key loaded: ${DEEPGRAM_API_KEY.slice(0, 8)}${"*".repeat(20)}`,
);
console.log("─".repeat(60));

/* ── 1. REST ping: validate key + list available models ─────────────────── */
function restPing() {
  return new Promise((resolve) => {
    console.log("\n[TEST 1] REST API ping — checking key validity...");

    const options = {
      hostname: "api.deepgram.com",
      path: "/v1/projects",
      method: "GET",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => {
        if (res.statusCode === 200) {
          const json = JSON.parse(body);
          const projectName = json?.projects?.[0]?.name ?? "unknown";
          console.log(
            `✅  REST OK — HTTP ${res.statusCode} | Project: ${projectName}`,
          );
          resolve(true);
        } else {
          console.error(`❌  REST FAILED — HTTP ${res.statusCode}`);
          try {
            const json = JSON.parse(body);
            console.error("    Response:", JSON.stringify(json, null, 2));
          } catch (_) {
            console.error("    Body:", body.slice(0, 200));
          }
          resolve(false);
        }
      });
    });

    req.on("error", (e) => {
      console.error("❌  REST request error:", e.message);
      resolve(false);
    });

    req.end();
  });
}

/* ── 2. WebSocket connection test ────────────────────────────────────────── */
function testWebSocket(model, sendAudio = false) {
  return new Promise((resolve) => {
    const label = `[TEST ${sendAudio ? "3" : "2"}] WebSocket model=${model}`;
    console.log(`\n${label} — connecting...`);

    const url =
      `wss://api.deepgram.com/v1/listen` +
      `?model=${model}` +
      `&encoding=linear16` +
      `&sample_rate=16000` +
      `&channels=1` +
      `&interim_results=true` +
      `&utterance_end_ms=500` +
      `&endpointing=200` +
      `&no_delay=true`;

    const ws = new WS(url, {
      headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
      handshakeTimeout: 10000,
    });

    let opened = false;
    let messageReceived = false;
    const startTime = Date.now();

    const done = (success, reason) => {
      clearTimeout(timeout);
      try {
        ws.close();
      } catch (_) {}
      const ms = Date.now() - startTime;
      if (success) {
        console.log(`✅  ${label} PASSED (${ms}ms) — ${reason}`);
      } else {
        console.error(`❌  ${label} FAILED (${ms}ms) — ${reason}`);
      }
      resolve(success);
    };

    const timeout = setTimeout(() => {
      done(false, "timeout after 10s — no response from Deepgram");
    }, 10000);

    ws.on("open", () => {
      opened = true;
      console.log(`   ↳ WebSocket opened (${Date.now() - startTime}ms)`);

      if (sendAudio) {
        // Send 1 second of 16kHz mono silence (16-bit PCM = 32000 bytes)
        const silence = Buffer.alloc(32000, 0);
        ws.send(silence);
        console.log(`   ↳ Sent 1s of silence (32000 bytes)`);

        // Send CloseStream so Deepgram flushes any results
        setTimeout(() => {
          try {
            ws.send(JSON.stringify({ type: "CloseStream" }));
          } catch (_) {}
        }, 500);
      } else {
        // Just opening was enough — success
        done(true, "connected successfully, no audio needed");
      }
    });

    ws.on("message", (raw) => {
      const data = JSON.parse(raw.toString());
      const type = data?.type;
      console.log(`   ↳ Message received: type=${type}`);

      if (
        type === "Results" ||
        type === "Metadata" ||
        type === "UtteranceEnd"
      ) {
        messageReceived = true;
        done(true, `received type=${type} from Deepgram`);
      }
    });

    ws.on("error", (err) => {
      done(false, err.message);
    });

    ws.on("close", (code, reason) => {
      if (!opened) {
        done(
          false,
          `closed before open — code=${code} reason=${reason?.toString() || "unknown"}`,
        );
      } else if (sendAudio && !messageReceived) {
        done(false, `closed without any message — code=${code}`);
      }
    });
  });
}

/* ── 4. Check available models ───────────────────────────────────────────── */
function checkModels() {
  return new Promise((resolve) => {
    console.log("\n[TEST 4] Checking available models on your account...");

    const options = {
      hostname: "api.deepgram.com",
      path: "/v1/models",
      method: "GET",
      headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(body);
            const sttModels = (json?.stt ?? []).map(
              (m) => m.name ?? m.model_id,
            );
            if (sttModels.length > 0) {
              console.log(`✅  Available STT models: ${sttModels.join(", ")}`);
            } else {
              console.log(
                `ℹ️   Models endpoint returned no STT models (may not be supported on this plan)`,
              );
            }
          } catch (_) {
            console.log(`ℹ️   Could not parse models response`);
          }
        } else {
          console.log(
            `ℹ️   Models endpoint returned HTTP ${res.statusCode} — skipping`,
          );
        }
        resolve();
      });
    });

    req.on("error", () => resolve());
    req.end();
  });
}

/* ── Run all tests ───────────────────────────────────────────────────────── */
(async () => {
  const restOk = await restPing();
  const nova2Ok = await testWebSocket("nova-2", false);
  const nova2AudioOk = await testWebSocket("nova-2", true);
  const nova3Ok = await testWebSocket("nova-3", false);
  await checkModels();

  console.log("\n" + "═".repeat(60));
  console.log("📋  SUMMARY");
  console.log("─".repeat(60));
  console.log(`  REST API key valid :  ${restOk ? "✅ YES" : "❌ NO"}`);
  console.log(`  nova-2 connects    :  ${nova2Ok ? "✅ YES" : "❌ NO"}`);
  console.log(`  nova-2 + audio     :  ${nova2AudioOk ? "✅ YES" : "❌ NO"}`);
  console.log(
    `  nova-3 connects    :  ${nova3Ok ? "✅ YES (available)" : "❌ NO (not on this plan)"}`,
  );
  console.log("─".repeat(60));

  if (!restOk) {
    console.log(
      "\n💡  Your API key is invalid or expired. Check DEEPGRAM_API_KEY.",
    );
  } else if (!nova2Ok) {
    console.log("\n💡  nova-2 WebSocket failed. Possible causes:");
    console.log("    • Deepgram account suspended / quota exceeded");
    console.log("    • Firewall blocking wss://api.deepgram.com");
    console.log("    • Try: curl -I https://api.deepgram.com");
  } else if (!nova2AudioOk) {
    console.log("\n💡  nova-2 connects but rejects audio. Possible causes:");
    console.log(
      "    • Audio encoding mismatch (check sample_rate / encoding params)",
    );
  } else {
    console.log(
      "\n✅  Deepgram is working. Use model=nova-2 in stt.service.js.",
    );
    if (!nova3Ok) {
      console.log(
        "⚠️   nova-3 is NOT available on your plan — this was causing the HTTP 400 crash.",
      );
      console.log("    Make sure stt.service.js uses model=nova-2.");
    }
  }

  console.log("");
  process.exit(0);
})();
