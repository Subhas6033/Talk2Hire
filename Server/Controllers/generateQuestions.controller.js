const { asyncHandler, APIERR, APIRES } = require("../Utils/index.utils.js");
const { uploadFileMicro } = require("./uploadFile.controllers");
const { mistralResponse } = require("./mistral.controllers.js");
const { ollama } = require("../Config/openai.config.js");
const { Interview } = require("../Models/interview.models.js");
const User = require("../Models/user.models.js");
const Job = require("../Models/job.models.js");

const LEVELS = {
  entry: {
    level: "entry",
    label: "Entry-Level (0-4 years)",
    minYears: 0,
    maxYears: 4,
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
    label: "Mid-Level (4-8 years)",
    minYears: 4,
    maxYears: 8,
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
    label: "Senior (8-12 years)",
    minYears: 8,
    maxYears: 12,
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
    label: "Leadership (12+ years)",
    minYears: 12,
    maxYears: Infinity,
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

// Category labels shown to the AI in the prompt
const CATEGORY_LABELS = {
  coreKnowledge:
    "Core Knowledge (domain/technical concepts, tools, frameworks)",
  experience:
    "Experience (specific past projects, roles, accomplishments from resume)",
  behavioral:
    "Behavioral (soft skills, teamwork, conflict, communication — STAR format)",
  problemSolving:
    "Problem Solving (hypothetical or real scenarios requiring analytical thinking)",
  cvValidation:
    "CV Validation (clarify or verify specific items mentioned in the resume)",
  motivation: "Motivation (career goals, why they applied, what drives them)",
  strategicThinking:
    "Strategic Thinking (long-term planning, business impact, cross-team decisions)",
  leadership:
    "Leadership (managing teams, mentoring, organizational decisions)",
};

function detectCandidateLevel(rawText) {
  let totalYears = 0;

  const yearsMentioned = [...rawText.matchAll(/(\d+)\+?\s*years?/gi)].map((m) =>
    parseInt(m[1]),
  );

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

  const match = Object.values(LEVELS).find(
    (l) => totalYears >= l.minYears && totalYears < l.maxYears,
  );

  return match ?? LEVELS.entry;
}

function pickNextCategory(weights, history) {
  const totalQuestions = history.length + 1; // +1 for the question about to be asked

  // Count how many questions have been asked per category so far
  const counts = {};
  for (const key of Object.keys(weights)) counts[key] = 0;
  for (const item of history) {
    if (item.category && counts[item.category] !== undefined) {
      counts[item.category]++;
    }
  }

  // Find the category with the largest deficit between target % and actual %
  let maxDeficit = -Infinity;
  let chosen = Object.keys(weights)[0];

  for (const [cat, targetPct] of Object.entries(weights)) {
    const actualPct = (counts[cat] / totalQuestions) * 100;
    const deficit = targetPct - actualPct;
    if (deficit > maxDeficit) {
      maxDeficit = deficit;
      chosen = cat;
    }
  }

  return chosen;
}

const extractJSON = (text) => {
  let cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    if (cleaned.length > 10 && cleaned.includes("?"))
      return { question: cleaned };
    throw new Error("No valid JSON object found in response");
  }

  return JSON.parse(cleaned.substring(jsonStart, jsonEnd + 1));
};

async function safeExtractResume({ user, req }) {
  if (user?.resume) {
    try {
      const result = await mistralResponse({
        ftpUrl: user.resume,
        mimeType: "application/pdf",
        originalFileName: "resume.pdf",
      });

      const rawText = result?.raw_text?.trim() ?? "";
      if (result?.extractionFailed || rawText.length < 30) {
        return { rawText: "", resumeUrl: user.resume };
      }

      return { rawText, resumeUrl: user.resume };
    } catch (err) {
      console.error("Error extracting existing resume text:", err.message);
      return { rawText: "", resumeUrl: user.resume };
    }
  }

  if (!req.file) {
    throw new APIERR(400, "Resume file is required for first-time upload");
  }

  try {
    const uploadedFile = await uploadFileMicro(req.file);
    const resumeUrl = uploadedFile.ftpUrl;

    user.resume = resumeUrl;
    await user.save();

    const result = await mistralResponse({
      ftpUrl: resumeUrl,
      mimeType: req.file.mimetype,
      originalFileName: req.file.originalname,
    });

    const rawText = result?.raw_text?.trim() ?? "";
    if (result?.extractionFailed || rawText.length < 30) {
      return { rawText: "", resumeUrl };
    }

    return { rawText, resumeUrl };
  } catch (err) {
    console.error("Resume upload/processing error:", err.message);
    if (err instanceof APIERR) throw err;
    throw new APIERR(500, "Failed to process resume: " + err.message);
  }
}

const generateQuestions = asyncHandler(async (req, res) => {
  if (!req.user?.id) throw new APIERR(401, "Unauthorized");

  const userId = req.user.id;
  const jobId = req.body.jobId;
  let skills = req.body.skills;

  if (!jobId || isNaN(jobId)) throw new APIERR(400, "Invalid Job ID");

  const job = await Job.findById(Number(jobId));
  if (!job || job.status !== "active") throw new APIERR(404, "Job not found");

  if (typeof skills === "string") {
    try {
      skills = JSON.parse(skills);
    } catch {
      skills = skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const user = await User.findById(userId);
  if (!user) throw new APIERR(404, "User not found");

  const candidateName = user.fullName ?? user.name ?? "";

  if (skills?.length > 0) {
    await User.updateInterviewSkills(userId, skills);
  }

  const { rawText, resumeUrl } = await safeExtractResume({ user, req });

  const sessionId = await Interview.createSession(userId, jobId, candidateName);

  const firstQuestion =
    "Hi! I am your interviewer — hope you're doing well today! Before we dive in, I'd love to get to know you a little better. So, tell me about yourself — your background, experience, and what brings you here today?";

  const levelInfo = rawText ? detectCandidateLevel(rawText) : LEVELS.entry;

  const qnaId = await Interview.saveQuestion({
    interviewId: sessionId,
    question: firstQuestion,
    questionOrder: 1,
    technology: null,
    difficulty: "basic",
    category: "motivation",
  });

  res.status(200).json(
    new APIRES(
      200,
      {
        sessionId,
        question: firstQuestion,
        qnaId,
        resumeUrl,
        candidateLevel: levelInfo.level,
        candidateLevelLabel: levelInfo.label,
      },
      "First question generated successfully",
    ),
  );
});

const generateNextQuestion = asyncHandler(async (req, res) => {
  const { sessionId, resumeText, history, candidateLevel } = req.body;

  if (!sessionId) throw new APIERR(400, "Session ID is required");
  if (!history || !Array.isArray(history))
    throw new APIERR(400, "Interview history is required");

  const questionOrder = history.length + 1;

  // Resolve candidate level
  const levelInfo =
    resumeText && resumeText.length > 30
      ? detectCandidateLevel(resumeText)
      : (LEVELS[candidateLevel] ?? LEVELS.entry);

  const { weights } = levelInfo;

  let nextCategory;

  // ------------------------------------------------------------
  // 🔹 STRICT FLOW CONTROL FOR FIRST 6 QUESTIONS
  // ------------------------------------------------------------
  if (questionOrder >= 2 && questionOrder <= 4) {
    // 3 Core Knowledge questions
    nextCategory = "coreKnowledge";
  } else if (questionOrder >= 5 && questionOrder <= 6) {
    // 2 Behavioral questions
    nextCategory = "behavioral";
  } else {
    // After first 6 → use weighted intelligent distribution
    nextCategory = pickNextCategory(weights, history);
  }

  const categoryLabel = CATEGORY_LABELS[nextCategory] ?? nextCategory;

  const prompt = `
You are conducting a structured professional interview.

Candidate Level: ${levelInfo.label}
Question Number: ${questionOrder}

Resume:
${resumeText || "Not provided"}

Previous Q&A:
${history.map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`).join("\n\n")}

REQUIRED CATEGORY FOR THIS QUESTION: ${categoryLabel}

INTERVIEW STRUCTURE RULES:
1. Questions 2-4 = General domain knowledge fundamentals
2. Questions 5-6 = Behavioral
3. Question 7 onward = Resume-based (projects, experience, strategic thinking, leadership etc.)
4. After question 6, prioritize resume-specific items
5. Ask at least 20 total questions overall
6. Do NOT repeat any previous question

STRICT INSTRUCTIONS:
- Identify candidate field from resume
- Use exact tools, skills, technologies mentioned
- No placeholders
- No brackets []
- No angle brackets <>
- Ask ONE clear professional question

STRICT OUTPUT:
Return ONLY valid JSON.
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
            "You are a structured AI interviewer. Return ONLY valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    });
  } catch (aiError) {
    console.error("Ollama API error:", aiError);
    throw new APIERR(500, "Failed to generate question: " + aiError.message);
  }

  const raw = completion?.message?.content;
  if (!raw) throw new APIERR(500, "AI returned empty response");

  let parsed;
  try {
    parsed = extractJSON(raw);
  } catch (err) {
    console.error("Invalid JSON from AI:", raw);
    throw new APIERR(500, "AI returned invalid JSON: " + err.message);
  }

  if (
    !parsed.question ||
    typeof parsed.question !== "string" ||
    parsed.question.length < 10
  ) {
    throw new APIERR(500, "AI returned invalid question");
  }

  const qnaId = await Interview.saveQuestion({
    interviewId: sessionId,
    question: parsed.question.trim(),
    technology: null,
    difficulty: null,
    questionOrder,
    category: nextCategory,
  }).catch((err) => {
    console.error("Database error saving question:", err);
    throw new APIERR(500, "Failed to save question: " + err.message);
  });

  res.status(200).json(
    new APIRES(
      200,
      {
        question: parsed.question.trim(),
        qnaId,
        category: nextCategory,
        questionOrder,
      },
      "Next question generated successfully",
    ),
  );
});
module.exports = { generateQuestions, generateNextQuestion };
