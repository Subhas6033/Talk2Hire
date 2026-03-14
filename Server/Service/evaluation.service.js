const { pool } = require("../Config/database.config.js");
const { ollama } = require("../Config/openai.config.js");
const { Interview } = require("../Models/interview.models.js");
const { Evaluation } = require("../Models/answer.models.js");
const { evaluateAnswer } = require("./evaluateanswer.service.js");
const { APIERR } = require("../Utils/index.utils.js");

function withTimeout(promise, ms, label = "operation") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`⏱️ ${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const safe = (v) => (v == null ? null : String(v));
const safeInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ── evaluateInterview ───────────────────────────────────────────────────── */

async function evaluateInterview(interviewId) {
  console.log(`🔍 Starting evaluation for interview ${interviewId}`);
  console.log(`📖 [EVAL] Fetching session history…`);

  const history = await withTimeout(
    Interview.getSessionHistory(interviewId),
    30_000,
    "getSessionHistory",
  );

  if (!history?.length) throw new APIERR(404, "No questions found");

  const answered = history.filter((q) => q.answer?.trim());
  if (!answered.length)
    throw new APIERR(400, "No answered questions to evaluate");

  console.log(`📊 Evaluating ${answered.length} answered questions…`);
  const evaluations = [];

  for (const q of answered) {
    console.log(`📝 Q${q.question_order}: evaluating…`);
    try {
      const result = await withTimeout(
        evaluateAnswer({
          question: q.question,
          answer: q.answer,
          technology: q.technology,
        }),
        90_000,
        `evaluateAnswer Q${q.question_order}`,
      );

      console.log(`💾 [EVAL] Saving Q${q.question_order} to DB…`);
      await withTimeout(
        Evaluation.saveQuestionEvaluation({
          interviewId,
          questionId: q.id,
          score: result.score,
          correctness: result.correctness,
          depth: result.depth,
          clarity: result.clarity,
          feedback: result.feedback,
          level: result.detected_level,
        }),
        15_000,
        `saveQuestionEvaluation Q${q.question_order}`,
      );

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

  const successful = evaluations.filter((e) => !e.error);
  if (!successful.length)
    throw new APIERR(
      500,
      "All question evaluations failed — cannot generate overall evaluation",
    );

  console.log(
    `✅ ${successful.length}/${answered.length} questions evaluated successfully`,
  );
  console.log(`🧮 [EVAL] Generating overall evaluation…`);

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

/* ── generateOverallEvaluation ───────────────────────────────────────────── */

async function generateOverallEvaluation(interviewId, evaluations) {
  if (!evaluations.length) throw new APIERR(500, "No evaluations to summarise");

  const successful = evaluations.filter((e) => !e.error);
  const scoreSource = successful.length ? successful : evaluations;

  const avg = (key) =>
    Math.round(
      scoreSource.reduce((s, e) => s + (Number(e[key]) || 0), 0) /
        scoreSource.length,
    );

  const avgScore = avg("score");
  const avgCorrectness = avg("correctness");
  const avgDepth = avg("depth");
  const avgClarity = avg("clarity");

  let experienceLevel = "BEGINNER";
  if (avgDepth >= 70 && avgCorrectness >= 70) experienceLevel = "ADVANCED";
  else if (avgDepth >= 50 && avgCorrectness >= 50)
    experienceLevel = "INTERMEDIATE";

  let hireDecision = "NO";
  if (avgScore >= 75) hireDecision = "YES";
  else if (avgScore >= 55) hireDecision = "MAYBE";

  const levelDist = evaluations.reduce((acc, e) => {
    if (e.detected_level && e.detected_level !== "UNKNOWN")
      acc[e.detected_level] = (acc[e.detected_level] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    `📝 [EVAL] Scores computed — avg=${avgScore} level=${experienceLevel} hire=${hireDecision}`,
  );
  console.log(`🤖 [EVAL] Calling generateSummary (60s timeout)…`);

  const summary = await generateSummary({
    evaluations: scoreSource,
    avgScore,
    avgCorrectness,
    avgDepth,
    avgClarity,
    experienceLevel,
  });

  console.log(`💾 [EVAL] Saving to interview_evaluations…`);
  await withTimeout(
    Evaluation.saveInterviewEvaluation({
      interviewId,
      overallScore: avgScore,
      hireDecision,
      experienceLevel,
      strengths: summary.strengths,
      weaknesses: summary.weaknesses,
      summary: summary.summary,
      modelVersion: "deepseek-v3.1:671b-cloud",
    }),
    15_000,
    "saveInterviewEvaluation",
  );
  console.log(`✅ [EVAL] interview_evaluations saved`);

  console.log(`💾 [EVAL] Updating interviews table…`);
  try {
    await withTimeout(
      pool.execute(
        `UPDATE interviews
         SET score=?, experience_level=?, hire_decision=?,
             strengths=?, improvements=?, summary=?,
             status='completed', updated_at=NOW()
         WHERE id=?`,
        [
          safeInt(avgScore),
          safe(experienceLevel),
          safe(hireDecision),
          safe(summary.strengths),
          safe(summary.weaknesses),
          safe(summary.summary),
          safeInt(interviewId),
        ],
      ),
      15_000,
      "UPDATE interviews",
    );
    console.log(
      `✅ interviews table updated — score=${avgScore} level=${experienceLevel} hire=${hireDecision} (interview ${interviewId})`,
    );
  } catch (err) {
    console.warn(
      `⚠️  Could not update interviews table for interview ${interviewId}: ${err.message}`,
    );
  }

  const byTech = scoreSource.reduce((acc, e) => {
    if (!e.technology) return acc;
    if (!acc[e.technology]) acc[e.technology] = [];
    acc[e.technology].push(Number(e.score) || 0);
    return acc;
  }, {});

  for (const [tech, scores] of Object.entries(byTech)) {
    const techAvg = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length,
    );
    const techLevel =
      techAvg >= 75 ? "ADVANCED" : techAvg >= 50 ? "INTERMEDIATE" : "BEGINNER";
    await withTimeout(
      Evaluation.saveSkillEvaluation({
        interviewId,
        technology: tech,
        score: techAvg,
        level: techLevel,
      }),
      10_000,
      `saveSkillEvaluation ${tech}`,
    );
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

/* ── generateSummary ─────────────────────────────────────────────────────── */

async function generateSummary({
  evaluations,
  avgScore,
  avgCorrectness,
  avgDepth,
  avgClarity,
  experienceLevel,
}) {
  const fallback = {
    strengths: `Completed ${evaluations.length} question(s) with an average score of ${avgScore}/100`,
    weaknesses: "Detailed analysis unavailable",
    summary: `Candidate answered ${evaluations.length} question(s). Average score: ${avgScore}/100. Experience level: ${experienceLevel}.`,
  };

  const snippets = evaluations
    .map(
      (e) =>
        `Q${e.questionOrder} [${e.technology ?? "General"}]: score=${e.score} | ` +
        `correctness=${e.correctness} | depth=${e.depth} | clarity=${e.clarity}\n` +
        `Feedback: ${e.feedback ?? "N/A"}`,
    )
    .join("\n---\n");

  const prompt = `
You are a senior hiring manager summarising a technical interview.

Averages — score: ${avgScore}/100 | correctness: ${avgCorrectness}/100 | depth: ${avgDepth}/100 | clarity: ${avgClarity}/100
Experience level detected: ${experienceLevel}
Total questions: ${evaluations.length}

Per-question breakdown:
${snippets}

Return ONLY this JSON (no extra text, no markdown fences):
{
  "strengths": "<3-5 bullet-pointed key strengths>",
  "weaknesses": "<3-5 bullet-pointed areas for improvement>",
  "summary": "<2-3 paragraph overall assessment>"
}
`;

  try {
    console.log(`🤖 [SUMMARY] Sending prompt to model (timeout=60s)…`);
    const res = await withTimeout(
      ollama.chat({
        model: "deepseek-v3.1:671b-cloud",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: "You are a senior hiring manager. Return only valid JSON.",
          },
          { role: "user", content: prompt },
        ],
      }),
      60_000,
      "generateSummary ollama.chat",
    );
    console.log(`✅ [SUMMARY] Model responded`);

    const raw =
      res?.choices?.[0]?.message?.content || res?.message?.content || "";
    if (!raw) {
      console.error("❌ generateSummary: empty response");
      return fallback;
    }

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      console.error(
        "❌ generateSummary: no JSON in response:",
        raw.slice(0, 300),
      );
      return fallback;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch (e) {
      console.error("❌ generateSummary: JSON.parse failed:", e.message);
      return fallback;
    }

    return {
      strengths: safe(parsed.strengths) || fallback.strengths,
      weaknesses: safe(parsed.weaknesses) || fallback.weaknesses,
      summary: safe(parsed.summary) || fallback.summary,
    };
  } catch (err) {
    console.error("❌ Summary generation failed:", err.message);
    return fallback;
  }
}

/* ── getEvaluationResults ────────────────────────────────────────────────── */

async function getEvaluationResults(interviewId) {
  const [[interviewEvals], [questionEvals], [skillEvals]] = await Promise.all([
    pool.execute(`SELECT * FROM interview_evaluations WHERE interview_id = ?`, [
      interviewId,
    ]),
    pool.execute(
      `SELECT qe.*, iq.question, iq.answer, iq.question_order, iq.technology
       FROM question_evaluations qe
       JOIN interview_questions iq ON qe.question_id = iq.id
       WHERE qe.interview_id = ? ORDER BY iq.question_order ASC`,
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
