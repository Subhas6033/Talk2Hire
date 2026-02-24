const { asyncHandler, APIERR, APIRES } = require("../Utils/index.utils.js");
const { uploadFileMicro } = require("./uploadFile.controllers");
const { mistralResponse } = require("./mistral.controllers.js");
const { ollama } = require("../Config/openai.config.js");
const { Interview } = require("../Models/interview.models.js");
const User = require("../Models/user.models.js");
const Job = require("../Admin/models/job.models.js");

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

// ─── Determine candidate level from resume ────────────────────────────────────

function detectCandidateLevel(rawText) {
  // Simple heuristic: look for year ranges like "2018 – 2022" or "2018 - 2022" or "3 years"
  let totalYears = 0;

  // Match patterns like "X years" or "X+ years"
  const yearsMentioned = [...rawText.matchAll(/(\d+)\+?\s*years?/gi)].map((m) =>
    parseInt(m[1]),
  );

  // Match date ranges like 2015-2020 or 2015 – 2020
  const dateRanges = [
    ...rawText.matchAll(
      /\b(20\d{2}|19\d{2})\s*[-–—]\s*(20\d{2}|19\d{2}|present|current|now)\b/gi,
    ),
  ];

  if (dateRanges.length > 0) {
    const currentYear = new Date().getFullYear();
    totalYears = dateRanges.reduce((sum, m) => {
      const start = parseInt(m[1]);
      const endRaw = m[2].toLowerCase();
      const end =
        endRaw === "present" || endRaw === "current" || endRaw === "now"
          ? currentYear
          : parseInt(m[2]);
      return sum + Math.max(0, end - start);
    }, 0);
  } else if (yearsMentioned.length > 0) {
    totalYears = Math.max(...yearsMentioned);
  }

  console.log(`📊 Detected total experience: ~${totalYears} years`);

  if (totalYears < 4) {
    return {
      level: "entry",
      yearsExp: totalYears,
      label: "🟢 Entry-Level (0–4 years)",
      weights: {
        coreKnowledge: 45,
        experience: 10,
        behavioral: 20,
        problemSolving: 15,
        cvValidation: 5,
        motivation: 5,
      },
    };
  } else if (totalYears < 8) {
    return {
      level: "mid",
      yearsExp: totalYears,
      label: "🔵 Mid-Level (4–8 years)",
      weights: {
        coreKnowledge: 35,
        experience: 30,
        behavioral: 15,
        problemSolving: 10,
        cvValidation: 5,
        motivation: 5,
      },
    };
  } else if (totalYears < 12) {
    return {
      level: "senior",
      yearsExp: totalYears,
      label: "🔴 Senior (8–12 years)",
      weights: {
        coreKnowledge: 25,
        experience: 35,
        behavioral: 20,
        problemSolving: 5,
        cvValidation: 5,
        strategicThinking: 10,
      },
    };
  } else {
    return {
      level: "leadership",
      yearsExp: totalYears,
      label: "⚫ Leadership (12+ years)",
      weights: {
        coreKnowledge: 15,
        experience: 30,
        behavioral: 20,
        problemSolving: 5,
        cvValidation: 5,
        strategicThinking: 15,
        leadership: 10,
      },
    };
  }
}

/**
 * Converts the weights object into a human-readable instruction block for the AI prompt.
 */
function buildWeightInstructions(levelInfo) {
  const { label, weights } = levelInfo;
  const lines = Object.entries(weights)
    .map(([key, val]) => {
      const readable = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase());
      return `  - ${readable}: ${val}%`;
    })
    .join("\n");

  return `Candidate Level: ${label}
Question Distribution (follow these weights across the full interview):
${lines}

When generating THIS question, pick the category that is most under-represented so far in the history.
Category definitions:
  - Core Knowledge: Domain/technical concepts, tools, frameworks relevant to their field
  - Experience: Specific past projects, roles, accomplishments from the resume
  - Behavioral: Soft skills, teamwork, conflict, communication (STAR-format friendly)
  - Problem Solving: Hypothetical or real scenarios requiring analytical thinking
  - CV Validation: Clarify or verify specific items mentioned in the resume
  - Motivation: Career goals, why they applied, what drives them
  - Strategic Thinking: Long-term planning, business impact, cross-team decisions (senior+)
  - Leadership: Managing teams, mentoring, org decisions (leadership only)`;
}

// ─── Safe resume text extraction ──────────────────────────────────────────────
async function safeExtractResume({ user, req }) {
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
    if (err instanceof APIERR) throw err;
    throw new APIERR(500, "Failed to process resume: " + err.message);
  }
}

// ─── generateQuestions ────────────────────────────────────────────────────────
const generateQuestions = asyncHandler(async (req, res) => {
  if (!req.user?.id) throw new APIERR(401, "Unauthorized");

  const userId = req.user.id;
  const jobId = req.body.jobId;
  let skills = req.body.skills;

  if (!jobId || isNaN(jobId)) {
    throw new APIERR(400, "Invalid Job ID");
  }

  const job = await Job.findById(Number(jobId));

  if (!job || job.status !== "active") {
    throw new APIERR(404, "Job not found");
  }

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

  const candidateName = user.fullName ?? user.name ?? "";
  console.log("👤 Candidate name:", candidateName);

  // STEP 2: Save interview skills
  if (skills?.length > 0) {
    await User.updateInterviewSkills(userId, skills);
    console.log("✅ Interview skills saved");
  }

  // STEP 3: Extract resume text
  const { rawText, resumeUrl } = await safeExtractResume({ user, req });

  // STEP 4: Create session
  const sessionId = await Interview.createSession(userId, jobId, candidateName);
  console.log("✅ Interview session created:", sessionId);

  // ─── STEP 5: The very FIRST message is always the standard interview opener ───
  // This never changes regardless of resume content or level.
  const firstQuestion =
    "Hi! I am your interviewer — hope you're doing well today! 😊 Before we dive in, I'd love to get to know you a little better. So, tell me about yourself — your background, experience, and what brings you here today?";

  console.log("✅ Using standard interview opening message");

  // STEP 6: Detect level from resume (saved to session for use in next questions)
  let levelInfo = {
    level: "entry",
    yearsExp: 0,
    label: "🟢 Entry-Level",
    weights: {},
  };
  if (rawText) {
    levelInfo = detectCandidateLevel(rawText);
    console.log(`📊 Detected level: ${levelInfo.label}`);
  }

  // STEP 7: Save opening question
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

  res.status(200).json(
    new APIRES(
      200,
      {
        sessionId,
        question: firstQuestion,
        qnaId,
        resumeUrl,
        // Pass level info to the frontend so it can be sent back with each next-question request
        candidateLevel: levelInfo.level,
        candidateLevelLabel: levelInfo.label,
      },
      "First question generated successfully",
    ),
  );
});

// ─── generateNextQuestion ─────────────────────────────────────────────────────
const generateNextQuestion = asyncHandler(async (req, res) => {
  // Accept candidateLevel from the frontend (passed back from generateQuestions response)
  const { sessionId, resumeText, history, candidateLevel } = req.body;

  if (!sessionId) throw new APIERR(400, "Session ID is required");
  if (!history || !Array.isArray(history))
    throw new APIERR(400, "Interview history is required");

  console.log("🤖 Generating next question for session:", sessionId);
  console.log("📊 Current history length:", history.length);
  console.log("🎯 Candidate level from client:", candidateLevel);

  // Re-detect level from resume text if available, otherwise use what frontend sent
  let levelInfo;
  if (resumeText && resumeText.length > 30) {
    levelInfo = detectCandidateLevel(resumeText);
  } else {
    // Fallback: build a minimal levelInfo from the string passed by frontend
    const levelMap = {
      entry: {
        level: "entry",
        label: "🟢 Entry-Level (0–4 years)",
        weights: {
          coreKnowledge: 45,
          experience: 10,
          behavioral: 20,
          problemSolving: 15,
          cvValidation: 5,
          motivation: 5,
        },
      },
      mid: {
        level: "mid",
        label: "🔵 Mid-Level (4–8 years)",
        weights: {
          coreKnowledge: 35,
          experience: 30,
          behavioral: 15,
          problemSolving: 10,
          cvValidation: 5,
          motivation: 5,
        },
      },
      senior: {
        level: "senior",
        label: "🔴 Senior (8–12 years)",
        weights: {
          coreKnowledge: 25,
          experience: 35,
          behavioral: 20,
          problemSolving: 5,
          cvValidation: 5,
          strategicThinking: 10,
        },
      },
      leadership: {
        level: "leadership",
        label: "⚫ Leadership (12+ years)",
        weights: {
          coreKnowledge: 15,
          experience: 30,
          behavioral: 20,
          problemSolving: 5,
          cvValidation: 5,
          strategicThinking: 15,
          leadership: 10,
        },
      },
    };
    levelInfo = levelMap[candidateLevel] ?? levelMap["entry"];
  }

  const weightInstructions = buildWeightInstructions(levelInfo);

  const prompt = `
You are conducting a professional interview for a candidate across ANY industry or domain.

${weightInstructions}

Resume:
${resumeText || "Not provided"}

Previous Q&A:
${history.map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`).join("\n\n")}

TASK:
- Analyze the candidate's profession/domain from the resume and previous answers
- Look at the Q&A history and count which question categories have already been covered
- Pick the next category that is most under-represented according to the weight percentages above
- Ask ONE relevant interview question for that category
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
{ "question": "Your complete question here?", "category": "coreKnowledge|experience|behavioral|problemSolving|cvValidation|motivation|strategicThinking|leadership" }
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
            "You are a senior professional interviewer who follows a structured question weighting system. Return ONLY valid JSON with no extra text.",
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
      // Optionally store which category this question belongs to
      category: parsed.category ?? null,
    });
    console.log("✅ Question saved with ID:", qnaId);
  } catch (dbError) {
    console.error("❌ Database error:", dbError);
    throw new APIERR(500, "Failed to save question: " + dbError.message);
  }

  res.status(200).json(
    new APIRES(
      200,
      {
        question: parsed.question.trim(),
        qnaId,
        category: parsed.category ?? null,
      },
      "Next question generated successfully",
    ),
  );
});

module.exports = { generateQuestions, generateNextQuestion };
