const { pool } = require("../Config/database.config");

const Evaluation = {
  /**
   * Save per-question evaluation scores.
   */
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
    const db = await pool;
    try {
      await db.execute(
        `INSERT INTO question_evaluations
         (interview_id, question_id, score, correctness, depth, clarity, feedback, detected_level)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          interviewId,
          questionId,
          score,
          correctness,
          depth,
          clarity,
          feedback,
          level,
        ],
      );
    } catch (err) {
      console.error("❌ Error saving question evaluation:", err);
      throw err;
    }
  },

  /**
   * Save overall interview evaluation.
   * FIX: was `const db = pool` (missing await) — DB calls silently failed
   * under connection-pool implementations that return a Promise.
   */
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
    const db = await pool; // FIX: added await
    try {
      await db.execute(
        `INSERT INTO interview_evaluations
         (interview_id, overall_score, hire_decision, experience_level,
          strengths, weaknesses, summary, model_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          interviewId,
          overallScore,
          hireDecision,
          experienceLevel,
          strengths,
          weaknesses,
          summary,
          modelVersion,
        ],
      );
    } catch (err) {
      console.error("❌ Error saving interview evaluation:", err);
      throw err;
    }
  },

  /**
   * Save per-technology skill evaluation.
   * FIX: was `const db = pool` (missing await) — same issue as above.
   */
  async saveSkillEvaluation({ interviewId, technology, score, level }) {
    const db = await pool; // FIX: added await
    try {
      await db.execute(
        `INSERT INTO skill_evaluations
         (interview_id, technology, average_score, level)
         VALUES (?, ?, ?, ?)`,
        [interviewId, technology, score, level],
      );
    } catch (err) {
      console.error("❌ Error saving skill evaluation:", err);
      throw err;
    }
  },
};

module.exports = { Evaluation };
