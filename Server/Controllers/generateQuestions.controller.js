const { asyncHandler, APIERR, APIRES } = require("../Utils/index.utils.js");
const { uploadFileMicro } = require("./uploadFile.controllers");
const { mistralResponse } = require("./mistral.controllers.js");
const { ollama } = require("../Config/openai.config.js");
const { Interview } = require("../Models/interview.models.js");
const User = require("../Models/user.models.js");

// ─── JSON extraction helper ───────────────────────────────────────────────────
const extractJSON = (text) => {
  let cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    console.warn("⚠️ No JSON structure found, attempting to wrap plain text");
    if (cleaned.length > 10 && cleaned.includes("?"))
      return { question: cleaned };
    console.error("❌ Raw response that failed:", text);
    throw new Error("No valid JSON object found in response");
  }

  return JSON.parse(cleaned.substring(jsonStart, jsonEnd + 1));
};

// ─── Fallback opening questions ───────────────────────────────────────────────
// Used when resume text extraction fails entirely (image-only PDF, OCR error).
// Generic enough to work for any profession.
const OPENING_FALLBACKS = [
  "Could you start by walking me through your professional background and the roles you've held that you're most proud of?",
  "Can you tell me about a significant project or achievement in your career and the impact it had?",
  "What drew you to your current field, and how has your career developed since you started?",
  "Could you describe your most recent role and the key responsibilities you handled day to day?",
  "What would you say is the core skill or strength that defines your professional career so far?",
];

function getOpeningFallback() {
  return OPENING_FALLBACKS[
    Math.floor(Math.random() * OPENING_FALLBACKS.length)
  ];
}

// ─── Safe resume text extraction ──────────────────────────────────────────────
// Returns { rawText, resumeUrl } — never throws.
// If extraction fails, rawText is "" and the caller uses a generic question.
async function safeExtractResume({ user, req }) {
  // Case A: Resume already in DB
  if (user?.resume) {
    console.log("✅ Resume found in DB:", user.resume);
    try {
      const result = await mistralResponse({
        ftpUrl: user.resume,
        mimeType: "application/pdf",
        originalFileName: "resume.pdf",
      });

      const rawText = result?.raw_text?.trim() ?? "";
      if (result?.extractionFailed || rawText.length < 30) {
        console.warn(
          "⚠️ Resume text extraction returned insufficient content — will use fallback question",
        );
        return { rawText: "", resumeUrl: user.resume };
      }

      console.log("✅ Resume text extracted:", rawText.length, "chars");
      return { rawText, resumeUrl: user.resume };
    } catch (err) {
      console.error("❌ Error extracting existing resume text:", err.message);
      return { rawText: "", resumeUrl: user.resume };
    }
  }

  // Case B: New file upload
  if (!req.file) {
    throw new APIERR(400, "Resume file is required for first-time upload");
  }

  console.log("📤 No resume in DB — uploading new resume...");
  try {
    const uploadedFile = await uploadFileMicro(req.file);
    const resumeUrl = uploadedFile.ftpUrl;
    console.log("✅ Resume uploaded:", resumeUrl);

    user.resume = resumeUrl;
    await user.save();

    const result = await mistralResponse({
      ftpUrl: resumeUrl,
      mimeType: req.file.mimetype,
      originalFileName: req.file.originalname,
    });

    const rawText = result?.raw_text?.trim() ?? "";
    if (result?.extractionFailed || rawText.length < 30) {
      console.warn(
        "⚠️ New resume text extraction insufficient — will use fallback question",
      );
      return { rawText: "", resumeUrl };
    }

    console.log("✅ New resume text extracted:", rawText.length, "chars");
    return { rawText, resumeUrl };
  } catch (err) {
    console.error("❌ Resume upload/processing error:", err.message);
    // If upload itself failed, we don't have a resumeUrl — re-throw
    if (err instanceof APIERR) throw err;
    throw new APIERR(500, "Failed to process resume: " + err.message);
  }
}

// ─── generateQuestions ────────────────────────────────────────────────────────
const generateQuestions = asyncHandler(async (req, res) => {
  if (!req.user?.id) throw new APIERR(401, "Unauthorized");

  const userId = req.user.id;
  let skills = req.body.skills;

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

  // STEP 1: Get user
  const user = await User.findById(userId);
  if (!user) throw new APIERR(404, "User not found");

  // STEP 2: Save interview skills
  if (skills?.length > 0) {
    await User.updateInterviewSkills(userId, skills);
    console.log("✅ Interview skills saved");
  }

  // STEP 3: Extract resume text (never throws — falls back gracefully)
  const { rawText, resumeUrl } = await safeExtractResume({ user, req });

  // STEP 4: Create session
  const sessionId = await Interview.createSession(userId);
  console.log("✅ Interview session created:", sessionId);

  // STEP 5: Generate first question
  let firstQuestion;

  if (!rawText) {
    // Resume extraction failed — use a generic opening question so the
    // interview can still start rather than returning a 500 error.
    firstQuestion = getOpeningFallback();
    console.warn(
      "⚠️ Using fallback opening question (no resume text available)",
    );
  } else {
    console.log("🤖 Generating first interview question from resume...");
    console.log("📄 Resume preview:", rawText.substring(0, 100) + "...");

    const skillsContext =
      skills?.length > 0
        ? `\n\nCandidate has selected these skills for the interview: ${skills.join(", ")}\nFocus the question on one of these skills if relevant to their resume.`
        : "";

    const prompt = `
You are an expert interviewer analyzing a candidate's resume for ANY profession or domain.

Resume Content:
${rawText}${skillsContext}

TASK:
Generate ONE opening interview question based on the candidate's field and resume.

RULES:
1. First identify the candidate's profession/domain from the resume (e.g., Software Developer, Nurse, Teacher, Marketing Manager, Chef, Accountant, Construction Worker, Sales Representative, etc.)
2. Choose ONE specific skill, project, experience, or responsibility explicitly mentioned in their resume
3. Ask a clear, focused question appropriate for their field
4. Make it suitable for starting an interview (not too complex)
5. Do NOT use placeholders like [technology], [project], [skill], [experience], etc.
6. Use EXACT names, tools, experiences, or job titles from the resume
7. Output ONLY valid JSON, no markdown, no explanations

FORMAT:
{ "question": "Your complete question here?" }
`;

    try {
      const completion = await ollama.chat({
        model: "deepseek-v3.1:671b-cloud",
        format: "json",
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

      const raw = completion?.message?.content;
      if (!raw) throw new Error("AI returned empty response");

      const parsed = extractJSON(raw);
      if (
        !parsed.question ||
        typeof parsed.question !== "string" ||
        parsed.question.length < 10
      ) {
        throw new Error("AI returned invalid question");
      }

      firstQuestion = parsed.question.trim();
      console.log("✅ AI question generated:", firstQuestion);
    } catch (aiError) {
      // AI failed — use fallback rather than 500-ing the whole flow
      console.error("❌ Ollama API error:", aiError.message);
      firstQuestion = getOpeningFallback();
      console.warn("⚠️ Using fallback opening question due to AI error");
    }
  }

  // STEP 6: Save question
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
    console.error("❌ DB error saving question:", dbError);
    throw new APIERR(
      500,
      "Failed to save question to database: " + dbError.message,
    );
  }

  console.log("✅ Question generation complete!");

  res
    .status(200)
    .json(
      new APIRES(
        200,
        { sessionId, question: firstQuestion, qnaId, resumeUrl },
        "First question generated successfully",
      ),
    );
});

// ─── generateNextQuestion ─────────────────────────────────────────────────────
const generateNextQuestion = asyncHandler(async (req, res) => {
  const { sessionId, resumeText, history } = req.body;

  if (!sessionId) throw new APIERR(400, "Session ID is required");
  if (!history || !Array.isArray(history))
    throw new APIERR(400, "Interview history is required");

  console.log("🤖 Generating next question for session:", sessionId);
  console.log("📊 Current history length:", history.length);

  const prompt = `
You are conducting an interview for a professional candidate across ANY industry or domain.

Resume:
${resumeText || "Not provided"}

Previous Q&A:
${history.map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`).join("\n\n")}

TASK:
- Analyze the candidate's profession/domain from the resume and previous answers
- Identify strengths, weaknesses, or knowledge gaps in their latest answer
- Ask ONE relevant follow-up interview question appropriate for their field
- Adjust difficulty based on their performance
- Avoid repeating topics already covered

MANDATORY RULES:
1. Identify the candidate's field (Software, Healthcare, Marketing, Finance, Education, Sales, Hospitality, Construction, Design, Manufacturing, etc.)
2. Select ONE real skill, tool, experience, or concept explicitly mentioned in the resume or previous answers
3. Use the EXACT name/term directly in the question
4. DO NOT use any placeholders: [technology], [skill], [tool], [experience], <anything>
5. NEVER use square brackets [] or angle brackets <>
6. If no specific item is available, ask a general professional question relevant to their field WITHOUT placeholders

STRICT OUTPUT: Return ONLY valid JSON, no markdown, no code blocks.
{ "question": "Your complete question here?" }
`;

  let completion;
  try {
    completion = await ollama.chat({
      model: "deepseek-v3.1:671b-cloud",
      temperature: 0.5,
      format: "json",
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
    parsed = extractJSON(raw);
    console.log("✅ Parsed JSON:", parsed);
  } catch (err) {
    console.error("❌ Invalid JSON from AI:", raw);
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

  const questionOrder = history.length + 1;
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
