const { asyncHandler, APIERR, APIRES } = require("../Utils/index.utils.js");
const { uploadFileMicro } = require("./uploadFile.controllers");
const { mistralResponse } = require("./mistral.controllers.js");
const { openai } = require("../Config/openai.config.js");
const { Interview } = require("../Models/interview.models.js");

const generateQuestions = asyncHandler(async (req, res) => {
  if (!req.user?.id) throw new APIERR(401, "Unauthorized");
  if (!req.file) throw new APIERR(400, "Resume file is required");

  const userId = req.user.id;

  // Upload resume
  const uploadedData = await uploadFileMicro(req.file);

  // Extract text
  const rawTextObj = await mistralResponse({
    ftpUrl: uploadedData.url,
    mimeType: req.file.mimetype,
    originalFileName: req.file.originalname,
  });

  const rawText = rawTextObj?.raw_text;
  if (!rawText) throw new APIERR(500, "Failed to extract resume text");

  // Create interview
  const sessionId = await Interview.createSession(userId);

  const prompt = `
Generate ONE technical interview question.

Resume:
${rawText}

RULES:
- Use ONE real technology mentioned in the resume
- Ask ONE clear technical question
- No explanations
- No placeholders
- Output JSON ONLY

{ "question": "" }
`;

  const completion = await openai.chat.completions.create({
    model: "deepseek-chat",
    temperature: 0.6,
    messages: [
      { role: "system", content: "You are an expert technical interviewer." },
      { role: "user", content: prompt },
    ],
  });

  const raw = completion?.choices?.[0]?.message?.content;
  if (!raw) throw new APIERR(500, "AI returned empty response");

  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    throw new APIERR(500, "AI returned invalid JSON");
  }

  if (
    !parsed.question ||
    typeof parsed.question !== "string" ||
    parsed.question.length < 10
  ) {
    throw new APIERR(500, "AI returned an invalid question");
  }

  const qnaId = await Interview.saveQuestion({
    interviewId: sessionId,
    question: parsed.question.trim(),
    questionOrder: 1,
  });

  res.status(200).json(
    new APIRES(
      200,
      {
        sessionId,
        question: parsed.question.trim(),
        qnaId,
      },
      "First question generated successfully"
    )
  );
  console.log(parsed.question.trim());
});

// Generate the next question based on the user answer
const generateNextQuestion = asyncHandler(async (req, res) => {
  const { sessionId, resumeText, history } = req.body;

  if (!sessionId) {
    throw new APIERR(400, "Session ID is required");
  }

  if (!history || !Array.isArray(history)) {
    throw new APIERR(400, "Interview history is required");
  }

  const prompt = `
You are conducting a technical interview.

Resume:
${resumeText}

Previous Q&A:
${history
  .map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`)
  .join("\n\n")}

TASK:
- Analyze the candidate’s latest answer
- Identify strengths, weaknesses, or gaps
- Ask ONE next interview question
- Increase or decrease difficulty intelligently
- Avoid repeating topics

MANDATORY RULES (NO EXCEPTIONS):

1. Select ONE real technology explicitly mentioned in the resume
   or in previous answers.

2. Use the EXACT technology name directly in the question.

3. DO NOT use placeholders of any kind.
   Forbidden examples:
   - [technology]
   - [specific technology from resume]
   - (technology)
   - <technology>

4. NEVER use square brackets [] or angle brackets <>.

5. If no technology is available, ask a general technical question
   WITHOUT placeholders.

STRICT OUTPUT RULES:
- Return ONLY valid JSON
- No markdown
- No explanations

{
  "question": ""
}
`;

  const completion = await openai.chat.completions.create({
    model: "deepseek-chat",
    temperature: 0.5,
    messages: [
      { role: "system", content: "You are a senior technical interviewer." },
      { role: "user", content: prompt },
    ],
  });

  const cleaned = completion.choices[0].message.content.trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("❌ Invalid JSON:", cleaned);
    throw new APIERR(500, "AI returned invalid JSON");
  }

  // Save the new question in DB
  const questionOrder = history.length + 1;
  const qnaId = await Interview.saveQuestion({
    interviewId: sessionId,
    question: parsed.question,
    technology: null,
    difficulty: null,
    questionOrder,
  });

  res
    .status(200)
    .json(
      new APIRES(
        200,
        { question: parsed.question, qnaId },
        "Next question generated successfully"
      )
    );
});

module.exports = { generateQuestions, generateNextQuestion };
