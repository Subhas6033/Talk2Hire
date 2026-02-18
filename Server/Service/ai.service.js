const { ollama } = require("../Config/openai.config.js");
const { APIERR } = require("../Utils/index.utils.js");

// Used when Ollama fetch fails (network issue, model unavailable, timeout).
const FALLBACK_QUESTIONS = {
  basic: [
    "Can you tell me more about your professional background and key achievements?",
    "What motivated you to pursue this particular career path?",
    "How do you typically approach learning a new skill or technology?",
    "Can you describe a project you're most proud of and your role in it?",
    "What does a typical workday look like for you in your current role?",
  ],
  intermediate: [
    "Can you walk me through a challenging problem you solved and the approach you took?",
    "How do you prioritize competing tasks when deadlines are tight?",
    "Describe a time you had to collaborate with a difficult team member — how did you handle it?",
    "What process do you use to ensure quality in your work?",
    "How have you improved a workflow or process in a previous role?",
  ],
  advanced: [
    "How do you approach making high-stakes decisions with incomplete information?",
    "Describe a time you led a significant change initiative — what was the outcome?",
    "How do you stay current with trends and developments in your field?",
    "Can you give an example of a time you failed at something important and what you learned?",
    "How do you measure success in your work beyond the obvious metrics?",
  ],
};

function getFallbackQuestion(questionOrder, usedFallbacks = new Set()) {
  const depth =
    questionOrder <= 2
      ? "basic"
      : questionOrder <= 4
        ? "intermediate"
        : "advanced";
  const pool = FALLBACK_QUESTIONS[depth];
  const available = pool.filter((_, i) => !usedFallbacks.has(`${depth}_${i}`));
  if (available.length === 0)
    return pool[Math.floor(Math.random() * pool.length)];
  const idx = Math.floor(Math.random() * available.length);
  const originalIdx = pool.indexOf(available[idx]);
  usedFallbacks.add(`${depth}_${originalIdx}`);
  return available[idx];
}

// ─── Retry wrapper ────────────────────────────────────────────────────────────
async function withRetry(
  fn,
  { retries = 2, delayMs = 1000, timeoutMs = 15000 } = {},
) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Ollama timeout after ${timeoutMs}ms`)),
            timeoutMs,
          ),
        ),
      ]);
      return result;
    } catch (err) {
      lastErr = err;
      const isNetworkErr =
        err.code === "UND_ERR_SOCKET" ||
        err.message?.includes("fetch failed") ||
        err.message?.includes("ECONNREFUSED") ||
        err.message?.includes("timeout");

      if (isNetworkErr && attempt < retries) {
        console.warn(
          `⚠️ Ollama attempt ${attempt + 1} failed (${err.message}) — retrying in ${delayMs}ms`,
        );
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
}

// ─── Main export ──────────────────────────────────────────────────────────────
// usedFallbacks is optional — pass a persistent Set per-interview to avoid repeats.
async function generateNextQuestionWithAI(
  { answer, questionOrder, previousQuestion },
  { usedFallbacks = new Set() } = {},
) {
  console.log("🤖 AI Service: Starting question generation...");
  console.log("📝 Answer:", answer?.substring(0, 100));
  console.log("📊 Question order:", questionOrder);
  console.log("❓ Previous question:", previousQuestion?.substring(0, 100));
  console.log("🔑 API Key exists:", !!process.env.DEEPSEEK_API_KEY);
  console.log(
    "🌐 Ollama base URL:",
    ollama?.config?.host ?? ollama?.baseURL ?? "(check openai.config.js)",
  );

  if (!answer || typeof answer !== "string") {
    throw new APIERR(
      400,
      "Previous answer is required for AI question generation",
    );
  }

  const depth =
    questionOrder <= 2
      ? "basic"
      : questionOrder <= 4
        ? "intermediate"
        : "advanced";
  console.log(`🎯 Difficulty level: ${depth}`);

  const prompt = `
You are a senior interviewer conducting an interview for ANY profession or domain.

The candidate just answered:
"${answer}"

${previousQuestion ? `Previous question was:\n"${previousQuestion}"\n\n` : ""}

TASK:
Generate exactly ONE ${depth}-level follow-up interview question.

CRITICAL RULES:
1. First identify the candidate's profession/domain from the resume or answer context
   (Software, Healthcare, Marketing, Finance, Education, Sales, Construction, Hospitality, Design, Manufacturing, Retail, etc.)
2. Base the question on their ACTUAL field - not software if they're not in software
3. Use specific skills, tools, or concepts from THEIR domain mentioned in their answer or resume
4. Do NOT use placeholders: [technology], [skill], [tool], [experience], etc.
5. Do NOT repeat previous questions
6. Do NOT include explanations or numbering
7. Ask domain-appropriate questions

EXAMPLES BY DOMAIN:

SOFTWARE/IT:
✅ "You mentioned optimizing database queries. What indexing strategies do you use for large datasets?"
❌ "How do you optimize [database] performance?"

HEALTHCARE:
✅ "You talked about patient assessment. How do you prioritize vital signs when multiple patients need attention?"
❌ "How do you handle [clinical situation]?"

MARKETING:
✅ "You discussed A/B testing. What sample size do you typically use to ensure statistical significance?"
❌ "How do you measure [marketing metric]?"

FINANCE:
✅ "You mentioned portfolio diversification. What percentage do you typically allocate to high-risk assets?"
❌ "How do you balance [investment strategy]?"

EDUCATION:
✅ "You explained differentiated instruction. How do you assess whether visual or auditory methods work better for a student?"
❌ "How do you adapt [teaching method] for different learners?"

SALES:
✅ "You discussed cold calling. How many calls do you typically make before connecting with a decision-maker?"
❌ "What's your process for [sales technique]?"

CONSTRUCTION:
✅ "You mentioned reading blueprints. How do you identify load-bearing walls versus partition walls?"
❌ "How do you interpret [construction document]?"

HOSPITALITY:
✅ "You talked about handling guest complaints. What's your approach when a guest demands a refund for a valid complaint?"
❌ "How do you manage [guest situation]?"

RETAIL:
✅ "You mentioned inventory management. How do you determine reorder points for seasonal versus year-round products?"
❌ "How do you manage [inventory metric]?"

OUTPUT FORMAT (JSON ONLY):
{ "question": "Your question here?" }
`;

  try {
    console.log("🔄 Calling Ollama API...");

    const response = await withRetry(
      () =>
        ollama.chat({
          model: "deepseek-v3.1:671b-cloud",
          temperature: 0.4,
          format: "json",
          messages: [
            {
              role: "system",
              content: "You are a strict technical interviewer.",
            },
            { role: "user", content: prompt },
          ],
        }),
      { retries: 2, delayMs: 1000, timeoutMs: 15000 },
    );

    console.log("✅ Ollama response received");

    const raw = response?.message?.content;
    if (!raw) {
      console.error("❌ AI returned empty response");
      throw new APIERR(500, "AI did not return a response");
    }

    console.log("📄 Raw AI response:", raw);

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch (err) {
      console.error("❌ Failed to parse AI response:", raw);
      throw new APIERR(500, "Failed to parse AI response");
    }

    if (
      !parsed.question ||
      typeof parsed.question !== "string" ||
      parsed.question.length < 10
    ) {
      console.error("❌ AI returned invalid question:", parsed);
      throw new APIERR(500, "AI returned an invalid question");
    }

    console.log("✅ Question generated successfully:", parsed.question);
    return parsed.question.trim();
  } catch (error) {
    // ── Graceful degradation: use a fallback question so the interview continues ──
    const isNetworkErr =
      error.code === "UND_ERR_SOCKET" ||
      error.message?.includes("fetch failed") ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("timeout") ||
      error.message?.includes("other side closed");

    if (isNetworkErr) {
      const fallback = getFallbackQuestion(questionOrder, usedFallbacks);
      console.warn(
        `⚠️ Ollama unavailable — using fallback question: "${fallback}"`,
      );
      return fallback;
    }

    console.error("❌ Error in generateNextQuestionWithAI:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

module.exports = { generateNextQuestionWithAI };
