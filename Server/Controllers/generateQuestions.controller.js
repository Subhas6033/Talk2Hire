const { asyncHandler, APIERR, APIRES } = require("../Utils/index.utils.js");
const { uploadFileMicro } = require("./uploadFile.controllers");
const { mistralResponse } = require("./mistral.controllers.js");
const { openai } = require("../Config/openai.config.js");
const { Interview } = require("../Models/interview.models.js");

const generateQuestions = asyncHandler(async (req, res) => {
  if (!req.user?.id) throw new APIERR(401, "Unauthorized");
  if (!req.file) throw new APIERR(400, "Resume file is required");

  const userId = req.user.id;

  console.log("📄 Starting resume upload and question generation...");

  // Step 1: Upload resume
  console.log("📤 Uploading resume file...");
  const uploadedData = await uploadFileMicro(req.file);
  console.log("✅ Resume uploaded successfully:", uploadedData.url);

  // Step 2: Extract text from resume
  console.log("📝 Extracting text from resume...");
  const rawTextObj = await mistralResponse({
    ftpUrl: uploadedData.url,
    mimeType: req.file.mimetype,
    originalFileName: req.file.originalname,
  });

  const rawText = rawTextObj?.raw_text;
  if (!rawText) {
    console.error("❌ Failed to extract resume text");
    throw new APIERR(500, "Failed to extract resume text");
  }
  console.log("✅ Resume text extracted:", rawText.substring(0, 100) + "...");

  // Step 3: Create interview session
  console.log("🎯 Creating interview session...");
  const sessionId = await Interview.createSession(userId);
  console.log("✅ Interview session created:", sessionId);

  // Step 4: Generate first question using AI
  console.log("🤖 Generating first interview question...");

  const prompt = `
You are an expert technical interviewer analyzing a candidate's resume.

Resume Content:
${rawText}

TASK:
Generate ONE opening technical interview question based on the resume.

RULES:
1. Choose ONE specific technology, project, or skill explicitly mentioned in the resume
2. Ask a clear, focused technical question about it
3. Make it appropriate for starting an interview (not too complex)
4. Do NOT use placeholders like [technology], [project], etc.
5. Use EXACT names from the resume
6. Output ONLY valid JSON, no markdown, no explanations

FORMAT:
{
  "question": "Your complete question here?"
}

EXAMPLES OF GOOD QUESTIONS:
- "In your housing price prediction project, you used Random Forest regression. Can you explain how Random Forest reduces overfitting?"
- "I see you worked with React hooks in your e-commerce project. Can you explain when you'd use useEffect versus useLayoutEffect?"
- "Your resume mentions experience with Docker. Can you explain the difference between a Docker image and a container?"

BAD EXAMPLES (DO NOT DO THIS):
- "Can you tell me about [specific project] on your resume?" ❌ (uses placeholder)
- "What is your experience with [technology]?" ❌ (uses placeholder)
- "Tell me about yourself." ❌ (too generic, not based on resume)
`;

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content:
            "You are an expert technical interviewer who asks specific, clear questions based on candidate resumes.",
        },
        { role: "user", content: prompt },
      ],
    });
  } catch (aiError) {
    console.error("❌ OpenAI API error:", aiError);
    throw new APIERR(
      500,
      "Failed to generate question with AI: " + aiError.message
    );
  }

  const raw = completion?.choices?.[0]?.message?.content;
  if (!raw) {
    console.error("❌ AI returned empty response");
    throw new APIERR(500, "AI returned empty response");
  }

  console.log("📄 Raw AI response:", raw);

  // Step 5: Parse and validate AI response
  let parsed;
  try {
    // Remove markdown code blocks if present
    const cleaned = raw
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (parseError) {
    console.error("❌ Failed to parse AI response:", raw);
    throw new APIERR(500, "AI returned invalid JSON format");
  }

  // Validate question
  if (
    !parsed.question ||
    typeof parsed.question !== "string" ||
    parsed.question.length < 10
  ) {
    console.error("❌ AI returned invalid question:", parsed);
    throw new APIERR(500, "AI returned an invalid question");
  }

  const firstQuestion = parsed.question.trim();
  console.log("✅ First question generated:", firstQuestion);

  // Step 6: Save first question to database
  console.log("💾 Saving first question to database...");

  let qnaId;
  try {
    qnaId = await Interview.saveQuestion({
      interviewId: sessionId,
      question: firstQuestion,
      questionOrder: 1,
      technology: null,
      difficulty: "basic", // First question is always basic
    });
    console.log("✅ First question saved with ID:", qnaId);
  } catch (dbError) {
    console.error("❌ Database error saving question:", dbError);
    throw new APIERR(
      500,
      "Failed to save question to database: " + dbError.message
    );
  }

  // Step 7: Return response to client
  console.log("✅ Question generation complete!");

  res.status(200).json(
    new APIRES(
      200,
      {
        sessionId,
        question: firstQuestion,
        qnaId,
      },
      "First question generated successfully"
    )
  );
});

// Generate the next question based on the user answer
// NOTE: This endpoint is NOT used in Socket.IO flow
// It's kept for potential REST API usage
const generateNextQuestion = asyncHandler(async (req, res) => {
  const { sessionId, resumeText, history } = req.body;

  if (!sessionId) {
    throw new APIERR(400, "Session ID is required");
  }

  if (!history || !Array.isArray(history)) {
    throw new APIERR(400, "Interview history is required");
  }

  console.log("🤖 Generating next question for session:", sessionId);
  console.log("📊 Current history length:", history.length);

  const prompt = `
You are conducting a technical interview.

Resume:
${resumeText || "Not provided"}

Previous Q&A:
${history
  .map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`)
  .join("\n\n")}

TASK:
- Analyze the candidate's latest answer
- Identify strengths, weaknesses, or knowledge gaps
- Ask ONE follow-up technical interview question
- Adjust difficulty based on their performance
- Avoid repeating topics already covered

MANDATORY RULES:

1. Select ONE real technology explicitly mentioned in the resume or previous answers
2. Use the EXACT technology name directly in the question
3. DO NOT use placeholders of any kind:
   ❌ [technology]
   ❌ [specific technology from resume]
   ❌ (technology)
   ❌ <technology>
4. NEVER use square brackets [] or angle brackets <>
5. If no specific technology is available, ask a general technical question WITHOUT placeholders

STRICT OUTPUT RULES:
- Return ONLY valid JSON
- No markdown formatting
- No explanations
- No code blocks

FORMAT:
{
  "question": "Your complete question here?"
}
`;

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "You are a senior technical interviewer who asks specific, clear follow-up questions.",
        },
        { role: "user", content: prompt },
      ],
    });
  } catch (aiError) {
    console.error("❌ OpenAI API error:", aiError);
    throw new APIERR(500, "Failed to generate question: " + aiError.message);
  }

  const cleaned = completion.choices[0].message.content.trim();
  console.log("📄 Raw AI response:", cleaned);

  let parsed;
  try {
    const jsonStr = cleaned
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    console.error("❌ Invalid JSON from AI:", cleaned);
    throw new APIERR(500, "AI returned invalid JSON");
  }

  if (
    !parsed.question ||
    typeof parsed.question !== "string" ||
    parsed.question.length < 10
  ) {
    console.error("❌ Invalid question from AI:", parsed);
    throw new APIERR(500, "AI returned invalid question");
  }

  // Save the new question in DB
  const questionOrder = history.length + 1;
  console.log("💾 Saving question with order:", questionOrder);

  let qnaId;
  try {
    qnaId = await Interview.saveQuestion({
      interviewId: sessionId,
      question: parsed.question.trim(),
      technology: null,
      difficulty: null,
      questionOrder,
    });
    console.log("✅ Question saved with ID:", qnaId);
  } catch (dbError) {
    console.error("❌ Database error:", dbError);
    throw new APIERR(500, "Failed to save question: " + dbError.message);
  }

  res
    .status(200)
    .json(
      new APIRES(
        200,
        { question: parsed.question.trim(), qnaId },
        "Next question generated successfully"
      )
    );
});

module.exports = { generateQuestions, generateNextQuestion };
