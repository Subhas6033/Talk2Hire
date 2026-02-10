const { ollama } = require("../Config/openai.config.js");
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
    console.log("🌐 Ollama base URL:", ollama.baseURL);

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

    console.log("🔄 Calling Ollama API...");
    const response = await ollama.chat({
      model: "deepseek-v3.1:671b-cloud",
      temperature: 0.4,
      format: "json",
      messages: [
        { role: "system", content: "You are a strict technical interviewer." },
        { role: "user", content: prompt },
      ],
    });

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
    console.error("❌ Error in generateNextQuestionWithAI:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

module.exports = { generateNextQuestionWithAI };
