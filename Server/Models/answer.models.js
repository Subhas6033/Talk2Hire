const { connectDB } = require("../Config/database.config");

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
    const db = await connectDB();
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
        ]
      );
    } catch (err) {
      console.log("Error While saving the questions evaluations", err);
    } finally {
      db.release();
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
    const db = await connectDB();
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
        ]
      );
    } catch (err) {
      console.log("Error While saving the interview evaluations", err);
    } finally {
      db.release();
    }
  },

  async saveSkillEvaluation({ interviewId, technology, score, level }) {
    const db = await connectDB();
    try {
      await db.execute(
        `INSERT INTO skill_evaluations
         (interview_id, technology, average_score, level)
         VALUES (?, ?, ?, ?)`,
        [interviewId, technology, score, level]
      );
    } catch (err) {
      console.log("Error While saving the skill eveluations", err);
    } finally {
      db.release();
    }
  },
};

module.exports = { Evaluation };
