const { AccessToken } = require("livekit-server-sdk");
require("dotenv").config();

async function generateTestToken() {
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    { identity: "test_user_debug" },
  );

  at.addGrant({
    roomJoin: true,
    room: "interview_debug",
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();

  console.log("✅ Token generated successfully");
  console.log("🔑 Token type:", typeof token);
  console.log("🔑 Token starts with 'ey':", token.startsWith("ey"));
  console.log("🔑 Token length:", token.length);
  console.log("🔑 Full token:\n", token);
  console.log("\n📋 Copy this into your browser console:\n");
  console.log(`
const { Room } = await import("https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.esm.mjs");
const room = new Room();
room.on("connected", () => console.log("✅ BROWSER CONNECTED TO LIVEKIT!"));
room.on("disconnected", (r) => console.log("❌ Disconnected:", r));
await room.connect("${process.env.LIVEKIT_URL}", "${token}");
  `);
}

generateTestToken().catch(console.error);
