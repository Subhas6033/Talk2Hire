const { pool } = require("../Config/database.config.js");
const { ollama } = require("../Config/openai.config.js");
const { Interview } = require("../Models/interview.models.js");
const { Evaluation } = require("../Models/answer.models.js");
const { evaluateAnswer } = require("./evaluateanswer.service.js");
const { APIERR } = require("../Utils/index.utils.js");

/* ── Evaluate all answers for an interview ───────────────────────────────── */

async function evaluateInterview(interviewId) {
  console.log(`🔍 Starting evaluation for interview ${interviewId}`);

  const history = await Interview.getSessionHistory(interviewId);
  if (!history?.length) throw new APIERR(404, "No questions found");

  const answered = history.filter((q) => q.answer?.trim());
  if (!answered.length)
    throw new APIERR(400, "No answered questions to evaluate");

  console.log(`📊 Evaluating ${answered.length} answered questions…`);

  const evaluations = [];

  // FIX 1: Wrap each question in try/catch so one failure does not abort the
  // entire evaluation run. Failed questions get a zero-score placeholder entry
  // so the overall evaluation can still proceed with the successful ones.
  for (const q of answered) {
    console.log(`📝 Q${q.question_order}: evaluating…`);

    try {
      const result = await evaluateAnswer({
        question: q.question,
        answer: q.answer,
        technology: q.technology,
      });

      // Persist per-question evaluation
      await Evaluation.saveQuestionEvaluation({
        interviewId,
        questionId: q.id,
        score: result.score,
        correctness: result.correctness,
        depth: result.depth,
        clarity: result.clarity,
        feedback: result.feedback,
        level: result.detected_level,
      });

      evaluations.push({
        questionId: q.id,
        questionOrder: q.question_order,
        question: q.question,
        answer: q.answer,
        technology: q.technology,
        ...result,
        error: false,
      });

      console.log(
        `   Q${q.question_order} scored ${result.score}/100 (${result.quality})`,
      );
    } catch (err) {
      // Log and continue — do not abort remaining questions
      console.error(
        `❌ Q${q.question_order} evaluation failed: ${err.message}`,
      );

      evaluations.push({
        questionId: q.id,
        questionOrder: q.question_order,
        question: q.question,
        answer: q.answer,
        technology: q.technology,
        score: 0,
        correctness: 0,
        depth: 0,
        clarity: 0,
        feedback: "Evaluation failed for this question",
        detected_level: "UNKNOWN",
        quality: "UNKNOWN",
        error: true,
      });
    }
  }

  // FIX 1 (cont): If every single question failed, abort with a clear error
  // rather than storing a meaningless overall evaluation with all-zero scores.
  const successful = evaluations.filter((e) => !e.error);
  if (!successful.length) {
    throw new APIERR(
      500,
      "All question evaluations failed — cannot generate overall evaluation",
    );
  }

  console.log(
    `✅ ${successful.length}/${answered.length} questions evaluated successfully`,
  );

  const overall = await generateOverallEvaluation(interviewId, evaluations);

  console.log(
    `✅ Evaluation complete — overall score: ${overall.overallScore}/100`,
  );

  return {
    questionEvaluations: evaluations,
    overallEvaluation: overall,
    totalQuestions: answered.length,
    successfulEvaluations: successful.length,
  };
}

/* ── Build overall evaluation from per-question results ─────────────────── */

async function generateOverallEvaluation(interviewId, evaluations) {
  // FIX 3: Guard against an empty array — avg() would divide by zero and
  // produce NaN, which gets stored silently or throws on strict DB schemas.
  if (!evaluations.length) {
    throw new APIERR(500, "No evaluations to summarise");
  }

  // Only include successfully evaluated questions in the averages so that
  // zero-score error placeholders do not drag the overall score down unfairly.
  const successful = evaluations.filter((e) => !e.error);
  const scoreSource = successful.length ? successful : evaluations;

  const avg = (key) =>
    Math.round(
      scoreSource.reduce((s, e) => s + (e[key] ?? 0), 0) / scoreSource.length,
    );

  const avgScore = avg("score");
  const avgCorrectness = avg("correctness");
  const avgDepth = avg("depth");
  const avgClarity = avg("clarity");

  // Decide experience level from depth + correctness
  let experienceLevel = "BEGINNER";
  if (avgDepth >= 70 && avgCorrectness >= 70) experienceLevel = "ADVANCED";
  else if (avgDepth >= 50 && avgCorrectness >= 50)
    experienceLevel = "INTERMEDIATE";

  // Hire decision
  let hireDecision = "NO";
  if (avgScore >= 75) hireDecision = "YES";
  else if (avgScore >= 55) hireDecision = "MAYBE";

  const levelDist = evaluations.reduce((acc, e) => {
    if (e.detected_level && e.detected_level !== "UNKNOWN") {
      acc[e.detected_level] = (acc[e.detected_level] ?? 0) + 1;
    }
    return acc;
  }, {});

  const summary = await generateSummary({
    evaluations: scoreSource,
    avgScore,
    avgCorrectness,
    avgDepth,
    avgClarity,
    experienceLevel,
  });

  await Evaluation.saveInterviewEvaluation({
    interviewId,
    overallScore: avgScore,
    hireDecision,
    experienceLevel,
    strengths: summary.strengths,
    weaknesses: summary.weaknesses,
    summary: summary.summary,
    modelVersion: "deepseek-v3.1:671b-cloud",
  });

  // Save per-technology skill scores (skip errored questions)
  const byTech = scoreSource.reduce((acc, e) => {
    if (!e.technology) return acc;
    if (!acc[e.technology]) acc[e.technology] = [];
    acc[e.technology].push(e.score);
    return acc;
  }, {});

  for (const [tech, scores] of Object.entries(byTech)) {
    const techAvg = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length,
    );
    const techLevel =
      techAvg >= 75 ? "ADVANCED" : techAvg >= 50 ? "INTERMEDIATE" : "BEGINNER";
    await Evaluation.saveSkillEvaluation({
      interviewId,
      technology: tech,
      score: techAvg,
      level: techLevel,
    });
  }

  return {
    overallScore: avgScore,
    hireDecision,
    experienceLevel,
    averages: {
      score: avgScore,
      correctness: avgCorrectness,
      depth: avgDepth,
      clarity: avgClarity,
    },
    levelDistribution: levelDist,
    strengths: summary.strengths,
    weaknesses: summary.weaknesses,
    summary: summary.summary,
  };
}

/* ── AI narrative summary ────────────────────────────────────────────────── */

async function generateSummary({
  evaluations,
  avgScore,
  avgCorrectness,
  avgDepth,
  avgClarity,
  experienceLevel,
}) {
  const snippets = evaluations
    .map(
      (e) =>
        `Q${e.questionOrder} [${e.technology ?? "General"}]: score=${e.score} | ` +
        `correctness=${e.correctness} | depth=${e.depth} | clarity=${e.clarity}\n` +
        `Feedback: ${e.feedback}`,
    )
    .join("\n---\n");

  const prompt = `
You are a senior hiring manager summarising a technical interview.

Averages — score: ${avgScore}/100 | correctness: ${avgCorrectness}/100 | depth: ${avgDepth}/100 | clarity: ${avgClarity}/100
Experience level detected: ${experienceLevel}
Total questions: ${evaluations.length}

Per-question breakdown:
${snippets}

Return ONLY this JSON (no extra text):
{
  "strengths": "<3-5 bullet-pointed key strengths>",
  "weaknesses": "<3-5 bullet-pointed areas for improvement>",
  "summary": "<2-3 paragraph overall assessment>"
}
`;

  try {
    const res = await ollama.chat({
      model: "deepseek-v3.1:671b-cloud",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "You are a senior hiring manager. Return only valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    });

    // FIX 2: Support both OpenAI SDK response shape (choices[0].message.content)
    // and native Ollama SDK response shape (message.content).
    // Whichever is populated wins; if neither is a non-empty string, raw = "".
    const raw =
      res?.choices?.[0]?.message?.content || res?.message?.content || "";

    if (!raw) {
      console.error(
        "❌ generateSummary: empty response from model — raw was empty",
      );
      console.error(
        "   Full response object:",
        JSON.stringify(res ?? {}).slice(0, 500),
      );
      throw new Error("Empty response from model");
    }

    // ── Robust JSON extraction ─────────────────────────────────────────────
    // Models often wrap JSON in prose, markdown fences, or add trailing text.
    // Find the first '{' and the LAST '}' to extract the JSON object reliably.
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      console.error(
        "❌ generateSummary: no JSON object found in model response",
      );
      console.error("   Raw response was:", raw.slice(0, 500));
      throw new Error("No JSON object in response");
    }

    const jsonStr = raw.slice(start, end + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("❌ generateSummary: JSON.parse failed:", parseErr.message);
      console.error("   Extracted string was:", jsonStr.slice(0, 500));
      throw parseErr;
    }

    // Validate required keys are present
    if (!parsed.strengths || !parsed.weaknesses || !parsed.summary) {
      console.warn(
        "⚠️  generateSummary: parsed JSON missing expected keys:",
        Object.keys(parsed),
      );
    }

    return {
      strengths: parsed.strengths ?? "Not available",
      weaknesses: parsed.weaknesses ?? "Not available",
      summary: parsed.summary ?? "Not available",
    };
  } catch (err) {
    console.error("❌ Summary generation failed:", err.message);
    return {
      strengths: `Completed ${evaluations.length} questions with an average score of ${avgScore}/100`,
      weaknesses: "Detailed analysis unavailable",
      summary: `Candidate answered ${evaluations.length} questions. Average score: ${avgScore}/100. Experience level: ${experienceLevel}.`,
    };
  }
}

/* ── Fetch stored evaluation results ─────────────────────────────────────── */

async function getEvaluationResults(interviewId) {
  const [[interviewEvals], [questionEvals], [skillEvals]] = await Promise.all([
    pool.execute(`SELECT * FROM interview_evaluations WHERE interview_id = ?`, [
      interviewId,
    ]),
    pool.execute(
      `SELECT qe.*, iq.question, iq.answer, iq.question_order, iq.technology
       FROM question_evaluations qe
       JOIN interview_questions iq ON qe.question_id = iq.id
       WHERE qe.interview_id = ?
       ORDER BY iq.question_order ASC`,
      [interviewId],
    ),
    pool.execute(
      `SELECT * FROM skill_evaluations WHERE interview_id = ? ORDER BY average_score DESC`,
      [interviewId],
    ),
  ]);

  return {
    interviewEvaluation: interviewEvals[0] ?? null,
    questionEvaluations: questionEvals,
    skillEvaluations: skillEvals,
  };
}

module.exports = {
  evaluateInterview,
  getEvaluationResults,
  generateOverallEvaluation,
};
