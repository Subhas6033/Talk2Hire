const { openai } = require("../Config/openai.config.js");
const { APIERR } = require("../Utils/index.utils.js");

async function generateNextQuestionWithAI({ answer, questionOrder }) {
  if (!answer || typeof answer !== "string") {
    throw new APIERR(
      400,
      "Previous answer is required for AI question generation"
    );
  }

  const depth =
    questionOrder <= 2
      ? "basic"
      : questionOrder <= 4
        ? "intermediate"
        : "advanced";

  const prompt = `
You are a senior technical interviewer.

The candidate just answered:
"${answer}"

Now ask exactly ONE ${depth}-level technical interview question.
- Base it strictly on the answer content
- Use a real-world technology (React, Node.js, SQL, Docker, etc.)
- Do NOT repeat previous questions
- Do NOT include explanations
- Do NOT include numbering
- Output JSON ONLY in this format:

{ "question": "Your question here?" }
`;

  const response = await openai.chat.completions.create({
    model: "deepseek-chat",
    temperature: 0.4,
    messages: [
      { role: "system", content: "You are a strict technical interviewer." },
      { role: "user", content: prompt },
    ],
  });

  const raw = response?.choices?.[0]?.message?.content;

  if (!raw) {
    throw new APIERR(500, "AI did not return a response");
  }

  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch (err) {
    throw new APIERR(500, "Failed to parse AI response");
  }

  if (
    !parsed.question ||
    typeof parsed.question !== "string" ||
    parsed.question.length < 10
  ) {
    throw new APIERR(500, "AI returned an invalid question");
  }

  return parsed.question.trim();
}

module.exports = { generateNextQuestionWithAI };
