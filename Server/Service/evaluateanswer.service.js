const { ollama } = require("../Config/openai.config");

function withTimeout(promise, ms, label = "operation") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`⏱️ ${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function preValidate(answer) {
  if (!answer || typeof answer !== "string")
    return {
      status: "invalid",
      score: 0,
      reason: "Answer is missing or not a string",
    };
  const trimmed = answer.trim();
  if (trimmed.length < 8)
    return { status: "invalid", score: 0, reason: "Answer is too short" };
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount < 5)
    return {
      status: "weak",
      score: 20,
      reason: "Answer lacks sufficient explanation",
    };
  if (wordCount < 12)
    return {
      status: "average",
      score: 50,
      reason: "Answer is acceptable but needs more detail",
    };
  return null;
}

async function scoreWithAI({ question, answer, technology }) {
  const prompt = `
You are a strict but fair technical interviewer evaluating a candidate's answer.

Question: "${question}"
Answer: "${answer}"
Technology: ${technology || "General"}

Evaluate and return ONLY this JSON object — no extra text:
{
  "score": <integer 0-100>,
  "quality": "strong | average | weak | irrelevant",
  "correctness": <integer 0-100>,
  "depth": <integer 0-100>,
  "clarity": <integer 0-100>,
  "confidence": <integer 0-100>,
  "detected_level": "BEGINNER | INTERMEDIATE | ADVANCED",
  "feedback": "<2-3 sentences: what was good, what could improve>",
  "strengths": ["<point>"],
  "weaknesses": ["<point>"]
}

Scoring guide:
- 90-100: Exceptional — precise, deep, real-world context
- 75-89 : Strong — correct and detailed
- 60-74 : Competent — mostly correct, lacks depth
- 40-59 : Weak — partial understanding, significant gaps
- 0-39  : Poor — incorrect or irrelevant
`;

  const res = await withTimeout(
    ollama.chat({
      model: "deepseek-v3.1:671b-cloud",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a senior technical interviewer. Return only valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
    90_000,
    "scoreWithAI ollama.chat",
  );

  const raw = res?.choices?.[0]?.message?.content ?? "";
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    console.error(
      "❌ evaluateAnswer: no JSON in model response:",
      raw.slice(0, 300),
    );
    throw new Error("No JSON object in model response");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

async function evaluateAnswer({ question, answer, technology }) {
  const preCheck = preValidate(answer);
  if (preCheck) {
    return {
      score: preCheck.score,
      quality: preCheck.status,
      correctness: preCheck.score,
      depth: preCheck.score,
      clarity: preCheck.score,
      confidence: preCheck.score,
      detected_level: "BEGINNER",
      feedback: preCheck.reason,
      strengths: [],
      weaknesses: [preCheck.reason],
      source: "pre_validation",
    };
  }

  try {
    const result = await scoreWithAI({ question, answer, technology });
    const clamp = (v) => Math.min(100, Math.max(0, Math.round(v ?? 0)));
    return {
      score: clamp(result.score),
      quality: result.quality ?? "average",
      correctness: clamp(result.correctness),
      depth: clamp(result.depth),
      clarity: clamp(result.clarity),
      confidence: clamp(result.confidence),
      detected_level: result.detected_level ?? "INTERMEDIATE",
      feedback: result.feedback ?? "",
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
      source: "ai",
    };
  } catch (err) {
    console.error(
      "❌ AI evaluation failed, using word-count fallback:",
      err.message,
    );
    const wordCount = answer.trim().split(/\s+/).length;
    const fallbackScore = Math.min(60, wordCount * 3);
    return {
      score: fallbackScore,
      quality: fallbackScore >= 50 ? "average" : "weak",
      correctness: fallbackScore,
      depth: fallbackScore,
      clarity: fallbackScore,
      confidence: fallbackScore,
      detected_level: "INTERMEDIATE",
      feedback: "Automatic scoring applied — AI evaluation unavailable.",
      strengths: [],
      weaknesses: ["Could not perform AI evaluation"],
      source: "fallback",
    };
  }
}

module.exports = { evaluateAnswer };
