const Redis = require("ioredis");
require("dotenv").config();
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = parseInt(process.env.REDIS_DB || "0");

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,

  ...(REDIS_PASSWORD ? { password: REDIS_PASSWORD } : {}),
  db: REDIS_DB,

  // ── Reconnection strategy ─────────────────────────────────────────────────

  retryStrategy(times) {
    if (times > 20) {
      console.error(
        `❌ Redis: gave up reconnecting after ${times} attempts. ` +
          `Make sure Redis is running: redis-cli -p ${REDIS_PORT} ping`,
      );
      return null; // stop retrying
    }
    const delay = Math.min(200 * Math.pow(2, times - 1), 10_000);
    return delay;
  },

  enableOfflineQueue: true,

  // Don't give up on individual commands while disconnected
  maxRetriesPerRequest: null,

  // Timeouts
  connectTimeout: 10_000,
  commandTimeout: 5_000,

  // TCP keep-alive — prevents OS from silently dropping idle connections
  keepAlive: 10_000,

  lazyConnect: false,
});

// ── Event listeners ───────────────────────────────────────────────────────────
redis.on("connect", () =>
  console.log(`✅ Redis connected → ${REDIS_HOST}:${REDIS_PORT}`),
);
redis.on("ready", () => console.log("✅ Redis ready"));
redis.on("reconnecting", (ms) =>
  console.warn(`⚠️ Redis reconnecting in ${ms}ms`),
);
redis.on("close", () => console.warn("⚠️ Redis connection closed"));
redis.on("end", () =>
  console.warn(
    `⚠️ Redis connection ended — no more retries.\n` +
      `   Fix: redis-server --port ${REDIS_PORT} --requirepass "${REDIS_PASSWORD || ""}" --daemonize yes`,
  ),
);

// CRITICAL: without this handler an "error" event with no listener
// crashes the entire Node process.
redis.on("error", (err) => {
  // Deduplicate log spam during reconnect loop
  if (!redis._lastErrMsg || redis._lastErrMsg !== err.message) {
    redis._lastErrMsg = err.message;
    console.error(`❌ Redis error: ${err.message}`);
    if (err.message.includes("ECONNREFUSED")) {
      console.error(
        `   → Redis is not running on ${REDIS_HOST}:${REDIS_PORT}\n` +
          `   → Fix: redis-server --port ${REDIS_PORT} --requirepass "${REDIS_PASSWORD || ""}" --daemonize yes`,
      );
    } else if (
      err.message.includes("WRONGPASS") ||
      err.message.includes("ERR AUTH")
    ) {
      console.error(
        `   → Wrong Redis password. Check REDIS_PASSWORD in your .env`,
      );
    }
  }
});

module.exports = redis;
