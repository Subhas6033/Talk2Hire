const {
  evaluateInterview,
  getEvaluationResults,
} = require("../Service/evaluation.service.js");
const { pool } = require("../Config/database.config.js");
const { asyncHandler, APIERR, APIRES } = require("../Utils/index.utils.js");

/* ── POST /evaluate/:interviewId ─────────────────────────────────────────── */
const evaluateInterviewController = asyncHandler(async (req, res) => {
  const interviewId = parseInt(req.params.interviewId, 10);
  if (!interviewId) throw new APIERR(400, "Interview ID is required");

  const results = await evaluateInterview(interviewId);
  return res.status(200).json({
    success: true,
    message: "Interview evaluated successfully",
    data: results,
  });
});

/* ── POST /trigger/:interviewId ──────────────────────────────────────────── */
const triggerEvaluationByIdController = asyncHandler(async (req, res) => {
  const interviewId = parseInt(req.params.interviewId, 10);
  const dryRun = req.query.dryRun === "true";
  const force = req.query.force === "true";

  if (!interviewId || isNaN(interviewId))
    throw new APIERR(400, "Valid numeric interviewId is required");

  const [interviewRows] = await pool.execute(
    `SELECT id, user_id, job_id, candidate_name, status, score, experience_level, hire_decision, created_at
     FROM interviews WHERE id = ? LIMIT 1`,
    [interviewId],
  );
  if (!interviewRows[0])
    throw new APIERR(404, `Interview ${interviewId} not found`);
  const interview = interviewRows[0];

  const [questions] = await pool.execute(
    `SELECT id, question, answer, technology, difficulty, question_order
     FROM interview_questions WHERE interview_id = ? ORDER BY question_order ASC`,
    [interviewId],
  );
  if (!questions.length)
    throw new APIERR(404, `No questions found for interview ${interviewId}`);

  const answered = questions.filter((q) => q.answer?.trim());
  const unanswered = questions.filter((q) => !q.answer?.trim());
  if (!answered.length)
    throw new APIERR(
      400,
      `Interview ${interviewId} has ${questions.length} question(s) but none have answers yet`,
    );

  const [existingEval] = await pool.execute(
    `SELECT id, overall_score, hire_decision, experience_level, created_at
     FROM interview_evaluations WHERE interview_id = ? LIMIT 1`,
    [interviewId],
  );
  const alreadyEvaluated = existingEval.length > 0;

  if (alreadyEvaluated && !force) {
    const existing = existingEval[0];
    const [existingQEvals] = await pool.execute(
      `SELECT qe.score, qe.correctness, qe.depth, qe.clarity, qe.feedback, qe.detected_level,
              iq.question_order, iq.question, iq.answer, iq.technology
       FROM question_evaluations qe
       JOIN interview_questions iq ON qe.question_id = iq.id
       WHERE qe.interview_id = ? ORDER BY iq.question_order ASC`,
      [interviewId],
    );
    return res.status(200).json({
      success: true,
      message: `Already evaluated on ${existing.created_at}. Use ?force=true to re-run.`,
      data: {
        alreadyEvaluated: true,
        interview: {
          id: interview.id,
          candidateName: interview.candidate_name,
          status: interview.status,
          score: interview.score,
          experienceLevel: interview.experience_level,
          hireDecision: interview.hire_decision,
        },
        evaluation: {
          overallScore: existing.overall_score,
          hireDecision: existing.hire_decision,
          experienceLevel: existing.experience_level,
          evaluatedAt: existing.created_at,
        },
        questionBreakdown: existingQEvals.map((q) => ({
          order: q.question_order,
          question: q.question,
          answer: q.answer,
          technology: q.technology,
          score: q.score,
          correctness: q.correctness,
          depth: q.depth,
          clarity: q.clarity,
          detectedLevel: q.detected_level,
          feedback: q.feedback,
        })),
      },
    });
  }

  if (dryRun) {
    return res.status(200).json({
      success: true,
      message: "Dry run complete — no evaluation performed",
      data: {
        dryRun: true,
        interviewId,
        alreadyEvaluated,
        interview: {
          id: interview.id,
          candidateName: interview.candidate_name,
          status: interview.status,
          jobId: interview.job_id,
          createdAt: interview.created_at,
        },
        totalQuestions: questions.length,
        answeredQuestions: answered.length,
        skippedQuestions: unanswered.length,
        willEvaluate: answered.map((q) => ({
          order: q.question_order,
          questionId: q.id,
          technology: q.technology ?? "General",
          difficulty: q.difficulty ?? "unknown",
          question: q.question,
          answerLength: q.answer.trim().length,
        })),
        willSkip: unanswered.map((q) => ({
          order: q.question_order,
          questionId: q.id,
          technology: q.technology ?? "General",
          question: q.question,
          reason: "no answer recorded",
        })),
        message: `Ready to evaluate. ${answered.length} question(s) will be scored.`,
      },
    });
  }

  if (force || !alreadyEvaluated) {
    console.log(
      `🗑️  [TRIGGER] Clearing any partial evaluation records for interview ${interviewId}`,
    );
    await pool.execute(
      `DELETE FROM question_evaluations  WHERE interview_id = ?`,
      [interviewId],
    );
    await pool.execute(
      `DELETE FROM interview_evaluations WHERE interview_id = ?`,
      [interviewId],
    );
    await pool.execute(
      `DELETE FROM skill_evaluations     WHERE interview_id = ?`,
      [interviewId],
    );
    console.log(`✅ [TRIGGER] Records cleared`);
  }

  console.log(
    `🚀 [TRIGGER] Starting evaluation for interview ${interviewId} (${answered.length} answered / ${questions.length} total)`,
  );
  const result = await evaluateInterview(interviewId);

  return res.status(200).json({
    success: true,
    message: "Evaluation triggered and complete",
    data: {
      triggered: true,
      interviewId,
      interview: {
        id: interview.id,
        candidateName: interview.candidate_name,
        jobId: interview.job_id,
      },
      totalQuestions: result.totalQuestions,
      successfulEvaluations: result.successfulEvaluations,
      failedEvaluations: result.totalQuestions - result.successfulEvaluations,
      overallScore: result.overallEvaluation.overallScore,
      hireDecision: result.overallEvaluation.hireDecision,
      experienceLevel: result.overallEvaluation.experienceLevel,
      averages: result.overallEvaluation.averages,
      strengths: result.overallEvaluation.strengths,
      weaknesses: result.overallEvaluation.weaknesses,
      summary: result.overallEvaluation.summary,
      questionEvaluations: result.questionEvaluations.map((q) => ({
        order: q.questionOrder,
        questionId: q.questionId,
        question: q.question,
        answer: q.answer,
        technology: q.technology,
        score: q.score,
        correctness: q.correctness,
        depth: q.depth,
        clarity: q.clarity,
        quality: q.quality,
        detectedLevel: q.detected_level,
        feedback: q.feedback,
        error: q.error ?? false,
      })),
    },
  });
});

/* ── GET /results/:interviewId ───────────────────────────────────────────── */
const getEvaluationController = asyncHandler(async (req, res) => {
  const interviewId = parseInt(req.params.interviewId, 10);
  if (!interviewId) throw new APIERR(400, "Interview ID is required");

  const results = await getEvaluationResults(interviewId);
  if (!results.interviewEvaluation)
    throw new APIERR(
      404,
      "Evaluation not found. Please evaluate the interview first.",
    );

  return res.status(200).json({
    success: true,
    message: "Evaluation results retrieved successfully",
    data: results,
  });
});

/* ── GET /summary/:interviewId ───────────────────────────────────────────── */
const getEvaluationSummary = asyncHandler(async (req, res) => {
  const interviewId = parseInt(req.params.interviewId, 10);
  if (!interviewId) throw new APIERR(400, "Interview ID is required");

  const results = await getEvaluationResults(interviewId);
  if (!results.interviewEvaluation)
    throw new APIERR(404, "Evaluation not found");

  const { interviewEvaluation: ie, questionEvaluations: qe } = results;
  return res.status(200).json({
    success: true,
    message: "Evaluation summary retrieved successfully",
    data: {
      overallScore: ie.overall_score,
      hireDecision: ie.hire_decision,
      experienceLevel: ie.experience_level,
      summary: ie.summary,
      strengths: ie.strengths,
      weaknesses: ie.weaknesses,
      totalQuestions: qe.length,
      evaluatedAt: ie.created_at,
    },
  });
});

module.exports = {
  evaluateInterviewController,
  triggerEvaluationByIdController,
  getEvaluationController,
  getEvaluationSummary,
};
