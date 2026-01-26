const { asyncHandler, APIERR, APIRES } = require("../Utils/index.utils.js");
const { uploadFileMicro } = require("./uploadFile.controllers");
const { mistralResponse } = require("./mistral.controllers.js");
const { openai } = require("../Config/openai.config.js");

const generateQuestions = asyncHandler(async (req, res) => {
  const { domain, role, experience, difficulty } = req.body;

  if (!req.file) {
    throw new APIERR(400, "Resume file is required");
  }

  if (!domain || !role || !experience || !difficulty) {
    throw new APIERR(400, "Missing required fields");
  }

  // Upload resume
  const uploadedData = await uploadFileMicro(req.file);

  // Extract resume text
  const rawText = await mistralResponse({
    ftpUrl: uploadedData.url,
    mimeType: req.file.mimetype,
    originalFileName: req.file.originalname,
  });

  if (!rawText) {
    throw new APIERR(500, "Internal server error while reading your resume");
  }

  // DeepSeek prompt
  const prompt = `
Generate exactly 5 interview questions.

Domain: ${domain}
Role: ${role}
Experience: ${experience}
Difficulty: ${difficulty}

Resume:
${rawText}

STRICT RULES:
- Return ONLY valid JSON
- No markdown
- No backticks
- No explanations

{
  "questions": []
}
`;

  const completion = await openai.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: "You are an expert technical interviewer.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.6,
  });

  const cleaned = completion.choices[0].message.content
    .replace(/```json|```/gi, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("❌ DeepSeek invalid JSON:", cleaned);
    throw new APIERR(500, "AI returned invalid JSON");
  }

  res.status(200).json(
    new APIRES(
      200,
      {
        questions: parsed.questions || [],
        duration: 500, //by default
      },
      "Successfully generate the questions"
    )
  );
});

module.exports = { generateQuestions };
