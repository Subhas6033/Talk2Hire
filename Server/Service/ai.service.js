// In ai.service.js
const { openai } = require("../Config/openai.config.js");
const { APIERR } = require("../Utils/index.utils.js");

async function generateNextQuestionWithAI({
  answer,
  questionOrder,
  previousQuestion,
}) {
  try {
    console.log("🤖 AI Service: Starting question generation...");
    console.log("📝 Answer:", answer?.substring(0, 100));
    console.log("📊 Question order:", questionOrder);
    console.log("❓ Previous question:", previousQuestion?.substring(0, 100));

    console.log("🔑 API Key exists:", !!process.env.DEEPSEEK_API_KEY);
    console.log("🌐 OpenAI base URL:", openai.baseURL);

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

    console.log(`🎯 Difficulty level: ${depth}`);

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

    console.log("🔄 Calling OpenAI API...");
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      temperature: 0.4,
      messages: [
        { role: "system", content: "You are a strict technical interviewer." },
        { role: "user", content: prompt },
      ],
    });

    console.log("✅ OpenAI response received");

    const raw = response?.choices?.[0]?.message?.content;

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
    console.error("❌ Error in generateNextQuestionWithAI:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
    });
    throw error; // Re-throw to be caught by caller
  }
}

module.exports = { generateNextQuestionWithAI };
