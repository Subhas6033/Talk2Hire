// Config/openai.config.js
const OpenAI = require("openai");
const dotenv = require("dotenv");

dotenv.config();

// Check which API key is available
const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error(
    "❌ Missing API key! Please set DEEPSEEK_API_KEY or OPENAI_API_KEY in your .env file"
  );
}

// Determine which service we're using
const isDeepSeek = !!process.env.DEEPSEEK_API_KEY;

const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: isDeepSeek ? "https://api.deepseek.com" : undefined,
});

console.log("✅ OpenAI client initialized");
console.log("🔑 Using:", isDeepSeek ? "DeepSeek" : "OpenAI");
console.log("🌐 Base URL:", openai.baseURL || "https://api.openai.com");

module.exports = { openai };
