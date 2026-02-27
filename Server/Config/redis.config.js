const Redis = require("ioredis");
require("dotenv").config();

// ── Upstash / URL-based connection ────────────────────────────────────────────
// If REDIS_URL is provided (e.g. rediss://... from Upstash), use it directly.
// Otherwise fall back to individual host/port/password env vars for local Redis.

const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = parseInt(process.env.REDIS_DB || "0");

const redisOptions = {
  // ── Reconnection strategy ───────────────────────────────────────────────
  retryStrategy(times) {
    if (times > 20) {
      console.error(`❌ Redis: gave up reconnecting after ${times} attempts.`);
      return null; // stop retrying
    }
    const delay = Math.min(200 * Math.pow(2, times - 1), 10_000);
    return delay;
  },

  enableOfflineQueue: true,
  maxRetriesPerRequest: null,
  connectTimeout: 10_000,
  commandTimeout: 5_000,
  keepAlive: 10_000,
  lazyConnect: false,
};

const redis = REDIS_URL
  ? new Redis(REDIS_URL, {
      ...redisOptions,

      tls: REDIS_URL.startsWith("rediss://")
        ? { rejectUnauthorized: false }
        : undefined,
    })
  : new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      ...(REDIS_PASSWORD ? { password: REDIS_PASSWORD } : {}),
      db: REDIS_DB,
      ...redisOptions,
    });

// ── Label for logs ────────────────────────────────────────────────────────────
const redisLabel = REDIS_URL
  ? REDIS_URL.replace(/:\/\/[^@]+@/, "://***@") // hide password in logs
  : `${REDIS_HOST}:${REDIS_PORT}`;

// ── Event listeners ───────────────────────────────────────────────────────────
redis.on("connect", () => console.log(`✅ Redis connected → ${redisLabel}`));
redis.on("ready", () => console.log("✅ Redis ready"));
redis.on("reconnecting", (ms) =>
  console.warn(`⚠️ Redis reconnecting in ${ms}ms`),
);
redis.on("close", () => console.warn("⚠️ Redis connection closed"));
redis.on("end", () =>
  console.warn("⚠️ Redis connection ended — no more retries."),
);

redis.on("error", (err) => {
  if (!redis._lastErrMsg || redis._lastErrMsg !== err.message) {
    redis._lastErrMsg = err.message;
    console.error(`❌ Redis error: ${err.message}`);

    if (err.message.includes("ECONNREFUSED")) {
      console.error(`   → Redis is not reachable at ${redisLabel}`);
    } else if (
      err.message.includes("WRONGPASS") ||
      err.message.includes("ERR AUTH")
    ) {
      console.error(
        `   → Wrong Redis password. Check REDIS_URL or REDIS_PASSWORD in .env`,
      );
    } else if (err.message.includes("self signed certificate")) {
      console.error(
        `   → TLS cert issue. rejectUnauthorized: false is already set — check your Upstash URL`,
      );
    }
  }
});

module.exports = redis;
