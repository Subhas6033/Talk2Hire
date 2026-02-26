const { ollama } = require("../Config/openai.config.js");
const { APIERR } = require("../Utils/index.utils.js");

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

// Extracts the first valid JSON object from any string,
// even if the model prepends thinking text like "Running cognitive scan..."
function extractFirstJSON(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found in: ${text.slice(0, 120)}`);
  }
  return JSON.parse(text.substring(start, end + 1));
}

async function withRetry(
  fn,
  { retries = 2, delayMs = 1000, timeoutMs = 15000 } = {},
) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Ollama timeout after ${timeoutMs}ms`)),
            timeoutMs,
          ),
        ),
      ]);
    } catch (err) {
      lastErr = err;
      const isNetwork =
        err.code === "UND_ERR_SOCKET" ||
        err.message?.includes("fetch failed") ||
        err.message?.includes("ECONNREFUSED") ||
        err.message?.includes("timeout");
      if (isNetwork && attempt < retries) {
        console.warn(
          `⚠️ Ollama attempt ${attempt + 1} failed — retrying in ${delayMs * (attempt + 1)}ms`,
        );
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
}

// jobDetails: { title, description, requirements, skills, department, experience }
async function generateNextQuestionWithAI(
  { answer, questionOrder, previousQuestion, jobDetails = {} },
  { usedFallbacks = new Set() } = {},
) {
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

  const jobContext = jobDetails?.title
    ? `
JOB POSITION: ${jobDetails.title}
DEPARTMENT: ${jobDetails.department ?? "N/A"}
EXPERIENCE REQUIRED: ${jobDetails.experience ?? "N/A"}
JOB DESCRIPTION: ${jobDetails.description ?? "N/A"}
KEY REQUIREMENTS: ${jobDetails.requirements ?? "N/A"}
REQUIRED SKILLS: ${Array.isArray(jobDetails.skills) ? jobDetails.skills.join(", ") : (jobDetails.skills ?? "N/A")}
`.trim()
    : "Job position: Not specified";

  const prompt = `You are a senior interviewer conducting a structured interview.

${jobContext}

The candidate just answered:
"${answer}"

${previousQuestion ? `Previous question was:\n"${previousQuestion}"\n` : ""}

TASK: Generate exactly ONE ${depth}-level follow-up interview question SPECIFICALLY for the job position above.

RULES:
1. The question MUST be relevant to the job role and its required skills
2. Reference specific skills, tools, or technologies from the job requirements when possible
3. Base the question on what the candidate said in their answer
4. Do NOT use placeholders like [technology], [skill], [tool]
5. Do NOT repeat the previous question
6. Do NOT include explanations, numbering, or preamble text
7. Return ONLY valid JSON — no thinking text, no prefixes

OUTPUT FORMAT (JSON only, nothing else before or after):
{ "question": "Your question here?" }`;

  try {
    const response = await withRetry(
      () =>
        ollama.chat({
          model: "deepseek-v3.1:671b-cloud",
          temperature: 0.4,
          format: "json",
          messages: [
            {
              role: "system",
              content:
                "You are a strict technical interviewer. Return ONLY a JSON object with a single 'question' key. No preamble. No thinking text. No markdown.",
            },
            { role: "user", content: prompt },
          ],
        }),
      { retries: 2, delayMs: 1000, timeoutMs: 15000 },
    );

    const raw = response?.message?.content;
    if (!raw) throw new APIERR(500, "AI returned empty response");

    console.log("📄 Raw AI response:", raw.slice(0, 200));

    // Use extractFirstJSON — handles model thinking-text prefixes safely
    const parsed = extractFirstJSON(raw);

    if (
      !parsed.question ||
      typeof parsed.question !== "string" ||
      parsed.question.length < 10
    ) {
      throw new APIERR(
        500,
        `AI returned invalid question: ${JSON.stringify(parsed)}`,
      );
    }

    console.log("✅ Question generated:", parsed.question);
    return parsed.question.trim();
  } catch (error) {
    const isNetwork =
      error.code === "UND_ERR_SOCKET" ||
      error.message?.includes("fetch failed") ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("timeout") ||
      error.message?.includes("other side closed");

    if (isNetwork) {
      const fallback = getFallbackQuestion(questionOrder, usedFallbacks);
      console.warn(`⚠️ Ollama unavailable — fallback: "${fallback}"`);
      return fallback;
    }

    console.error("❌ generateNextQuestionWithAI error:", error.message);
    throw error;
  }
}

module.exports = { generateNextQuestionWithAI };
