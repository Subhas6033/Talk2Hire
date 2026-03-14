const { pool } = require("../Config/database.config");

// Helper: coerce any value to a safe string for TEXT/VARCHAR columns.
// Converts undefined → null so MySQL2 never receives an undefined binding.
const safe = (v) => (v == null ? null : String(v));
const safeInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const Evaluation = {
  async saveQuestionEvaluation({
    interviewId,
    questionId,
    score,
    correctness,
    depth,
    clarity,
    feedback,
    level,
  }) {
    try {
      await pool.execute(
        `INSERT INTO question_evaluations
         (interview_id, question_id, score, correctness, depth, clarity, feedback, detected_level)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          safeInt(interviewId),
          safeInt(questionId),
          safeInt(score),
          safeInt(correctness),
          safeInt(depth),
          safeInt(clarity),
          safe(feedback),
          safe(level),
        ],
      );
    } catch (err) {
      console.error("❌ Error saving question evaluation:", err.message);
      throw err;
    }
  },

  async saveInterviewEvaluation({
    interviewId,
    overallScore,
    hireDecision,
    experienceLevel,
    strengths,
    weaknesses,
    summary,
    modelVersion,
  }) {
    try {
      await pool.execute(
        `INSERT INTO interview_evaluations
         (interview_id, overall_score, hire_decision, experience_level,
          strengths, weaknesses, summary, model_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          safeInt(interviewId),
          safeInt(overallScore),
          safe(hireDecision),
          safe(experienceLevel),
          safe(strengths),
          safe(weaknesses),
          safe(summary),
          safe(modelVersion),
        ],
      );
    } catch (err) {
      console.error("❌ Error saving interview evaluation:", err.message);
      throw err;
    }
  },

  async saveSkillEvaluation({ interviewId, technology, score, level }) {
    try {
      await pool.execute(
        `INSERT INTO skill_evaluations
         (interview_id, technology, average_score, level)
         VALUES (?, ?, ?, ?)`,
        [safeInt(interviewId), safe(technology), safeInt(score), safe(level)],
      );
    } catch (err) {
      console.error("❌ Error saving skill evaluation:", err.message);
      throw err;
    }
  },
};

module.exports = { Evaluation };
