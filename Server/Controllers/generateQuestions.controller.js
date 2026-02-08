const { asyncHandler, APIERR, APIRES } = require("../Utils/index.utils.js");
const { uploadFileMicro } = require("./uploadFile.controllers");
const { mistralResponse } = require("./mistral.controllers.js");
const { ollama } = require("../Config/openai.config.js");
const { Interview } = require("../Models/interview.models.js");
const User = require("../Models/user.models.js");

//  Extract JSON from AI response (handles extra text)
const extractJSON = (text) => {
  // Remove markdown code blocks
  let cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  // Find the first { and last } to extract only the JSON part
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw new Error("No valid JSON object found in response");
  }

  // Extract just the JSON portion
  const jsonStr = cleaned.substring(jsonStart, jsonEnd + 1);

  return JSON.parse(jsonStr);
};

const generateQuestions = asyncHandler(async (req, res) => {
  if (!req.user?.id) throw new APIERR(401, "Unauthorized");

  const userId = req.user.id;

  let skills = req.body.skills;

  // Handle both JSON string and array
  if (typeof skills === "string") {
    try {
      skills = JSON.parse(skills);
    } catch (e) {
      skills = skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  console.log("📄 Starting resume retrieval and question generation...");
  console.log("🎯 Skills received:", skills);

  // ✅ STEP 1: Get user data
  const user = await User.findById(userId);
  if (!user) {
    throw new APIERR(404, "User not found");
  }

  let resumeUrl;
  let rawText;

  // ✅ STEP 2: Save skills if provided and user doesn't have them
  if (skills && Array.isArray(skills) && skills.length > 0 && !user.skill) {
    console.log("💾 Saving user skills:", skills);
    const skillsString = skills.join(", ");

    await User.updateSkills(userId, skillsString);
    console.log("✅ Skills saved to user profile");
  }

  // ✅ STEP 3: Check if resume exists in DB
  if (user?.resume) {
    // Resume already exists - use it (NO FILE UPLOAD NEEDED)
    console.log("✅ Resume found in database:", user.resume);
    resumeUrl = user.resume;

    console.log("📝 Extracting text from existing resume...");
    try {
      const rawTextObj = await mistralResponse({
        ftpUrl: resumeUrl,
        mimeType: "application/pdf",
        originalFileName: "resume.pdf",
      });

      rawText = rawTextObj?.raw_text;

      if (!rawText) {
        console.error("❌ Failed to extract resume text");
        throw new APIERR(
          500,
          "Failed to extract resume text from stored resume",
        );
      }

      console.log("✅ Resume text extracted successfully");
    } catch (extractError) {
      console.error("❌ Error extracting resume text:", extractError);
      throw new APIERR(
        500,
        "Failed to process existing resume: " + extractError.message,
      );
    }
  } else {
    // ✅ STEP 4: No resume in DB - handle new upload
    if (!req.file) {
      throw new APIERR(400, "Resume file is required for first-time upload");
    }

    console.log("📤 No resume in DB, uploading new resume...");

    try {
      // Upload the file
      const uploadedFile = await uploadFileMicro(req.file);
      resumeUrl = uploadedFile.ftpUrl;

      console.log("✅ Resume uploaded:", resumeUrl);

      // Save resume URL to user profile
      user.resume = resumeUrl;
      await user.save();
      console.log("✅ Resume saved to user profile");

      // Extract text from uploaded resume
      const rawTextObj = await mistralResponse({
        ftpUrl: resumeUrl,
        mimeType: req.file.mimetype,
        originalFileName: req.file.originalname,
      });

      rawText = rawTextObj?.raw_text;

      if (!rawText) {
        throw new APIERR(500, "Failed to extract text from uploaded resume");
      }

      console.log("✅ Resume text extracted from new upload");
    } catch (uploadError) {
      console.error("❌ Resume upload/processing error:", uploadError);
      throw new APIERR(500, "Failed to process resume: " + uploadError.message);
    }
  }

  console.log("✅ Resume text ready:", rawText.substring(0, 100) + "...");

  // ✅ STEP 5: Create interview session
  console.log("🎯 Creating interview session...");
  const sessionId = await Interview.createSession(userId);
  console.log("✅ Interview session created:", sessionId);

  // ✅ STEP 6: Generate first question using AI
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
    completion = await ollama.chat({
      model: "deepseek-v3.1:671b-cloud",
      messages: [
        {
          role: "system",
          content:
            "You are an expert technical interviewer who asks specific, clear questions based on candidate resumes. Return ONLY valid JSON with no extra text.",
        },
        { role: "user", content: prompt },
      ],
    });

    console.log(
      "📄 Full Ollama response:",
      JSON.stringify(completion, null, 2),
    );
  } catch (aiError) {
    console.error("❌ Ollama API error:", aiError);

    // Check if Ollama is running
    try {
      const healthCheck = await ollama.list();
      console.log("✅ Ollama is running, available models:", healthCheck);
    } catch (healthError) {
      console.error("❌ Ollama server is not responding:", healthError.message);
    }

    throw new APIERR(
      500,
      "Failed to generate question with AI: " + aiError.message,
    );
  }

  const raw = completion?.message?.content;
  if (!raw) {
    console.error("❌ AI returned empty response");
    console.error("Full response:", completion);
    throw new APIERR(500, "AI returned empty response");
  }

  console.log("📄 Raw AI response:", raw);

  // ✅ STEP 7: Parse and validate AI response
  let parsed;
  try {
    // Use helper function to extract JSON
    parsed = extractJSON(raw);
    console.log("✅ Parsed JSON:", parsed);
  } catch (parseError) {
    console.error("❌ Failed to parse AI response:", raw);
    console.error("Parse error:", parseError.message);
    throw new APIERR(
      500,
      "AI returned invalid JSON format: " + parseError.message,
    );
  }

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

  // ✅ STEP 8: Save first question to database
  console.log("💾 Saving first question to database...");

  let qnaId;
  try {
    qnaId = await Interview.saveQuestion({
      interviewId: sessionId,
      question: firstQuestion,
      questionOrder: 1,
      technology: null,
      difficulty: "basic",
    });
    console.log("✅ First question saved with ID:", qnaId);
  } catch (dbError) {
    console.error("❌ Database error saving question:", dbError);
    throw new APIERR(
      500,
      "Failed to save question to database: " + dbError.message,
    );
  }

  console.log("✅ Question generation complete!");

  res.status(200).json(
    new APIRES(
      200,
      {
        sessionId,
        question: firstQuestion,
        qnaId,
        resumeUrl,
      },
      "First question generated successfully",
    ),
  );
});

// ✅ Generate the next question based on the user answer
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
    completion = await ollama.chat({
      model: "deepseek-v3.1:671b-cloud",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "You are a senior technical interviewer who asks specific, clear follow-up questions. Return ONLY valid JSON with no extra text.",
        },
        { role: "user", content: prompt },
      ],
    });

    console.log("📄 Ollama response received");
  } catch (aiError) {
    console.error("❌ Ollama API error:", aiError);
    throw new APIERR(500, "Failed to generate question: " + aiError.message);
  }

  const raw = completion?.message?.content;
  if (!raw) {
    console.error("❌ AI returned empty response");
    throw new APIERR(500, "AI returned empty response");
  }

  console.log("📄 Raw AI response:", raw);

  let parsed;
  try {
    // Use helper function to extract JSON
    parsed = extractJSON(raw);
    console.log("✅ Parsed JSON:", parsed);
  } catch (err) {
    console.error("❌ Invalid JSON from AI:", raw);
    console.error("Parse error:", err.message);
    throw new APIERR(500, "AI returned invalid JSON: " + err.message);
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
        "Next question generated successfully",
      ),
    );
});

module.exports = { generateQuestions, generateNextQuestion };
