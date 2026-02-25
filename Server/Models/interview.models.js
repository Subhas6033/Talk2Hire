const { pool } = require("../Config/database.config");
const { APIERR } = require("../Utils/index.utils.js");

const Interview = {
  async createSession(userId, jobId, candidateName = "") {
    if (!userId) throw new APIERR(400, "User ID is required");
    if (!jobId) throw new APIERR(400, "Job ID is required");

    const db = await pool;
    const [result] = await db.execute(
      "INSERT INTO interviews (user_id, job_id, candidate_name) VALUES (?, ?, ?)",
      [userId, jobId, candidateName],
    );
    return result.insertId;
  },

  async getSessionById(interviewId) {
    const db = await pool;
    const [rows] = await db.execute(
      `SELECT id, user_id, created_at FROM interviews WHERE id = ? LIMIT 1`,
      [interviewId],
    );

    if (!rows[0]) throw new APIERR(404, "Interview session not found");
    return rows[0];
  },

  async saveQuestion({
    interviewId,
    question,
    category = null,
    technology = null,
    difficulty = null,
    questionOrder,
  }) {
    if (!interviewId) throw new APIERR(400, "Interview ID is required");
    if (!question) throw new APIERR(400, "Question is required");
    if (questionOrder === undefined || questionOrder === null) {
      throw new APIERR(400, "Question order is required");
    }

    const db = await pool;

    try {
      const [result] = await db.execute(
        `INSERT INTO interview_questions
         (interview_id, question, category, technology, difficulty, question_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          interviewId,
          question,
          category,
          technology,
          difficulty,
          questionOrder,
        ],
      );

      return result.insertId;
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        throw new APIERR(
          409,
          `Question with order ${questionOrder} already exists for this interview`,
        );
      }
      throw error;
    }
  },

  async saveAnswer({ interviewId, questionId, answer }) {
    if (!interviewId || !questionId) {
      throw new APIERR(400, "Interview ID and Question ID are required");
    }

    const db = await pool;
    const [result] = await db.execute(
      `UPDATE interview_questions SET answer = ? WHERE id = ? AND interview_id = ?`,
      [answer, questionId, interviewId],
    );

    if (result.affectedRows === 0) {
      throw new APIERR(404, "Question not found for this interview");
    }

    return true;
  },

  // category is included so the frontend can track distribution per session
  async getSessionHistory(interviewId) {
    const db = await pool;
    const [rows] = await db.execute(
      `SELECT id, question, category, answer, technology, difficulty, question_order, created_at
       FROM interview_questions
       WHERE interview_id = ?
       ORDER BY question_order ASC`,
      [interviewId],
    );

    return rows;
  },

  async getQuestionByOrder(interviewId, questionOrder) {
    const db = await pool;
    const [rows] = await db.execute(
      `SELECT id, question, category, answer, technology, difficulty
       FROM interview_questions
       WHERE interview_id = ? AND question_order = ?
       LIMIT 1`,
      [interviewId, questionOrder],
    );

    return rows[0] || null;
  },

  async getLastAnsweredQuestion(interviewId) {
    const db = await pool;
    const [rows] = await db.execute(
      `SELECT id, question, category, answer, technology, difficulty, question_order
       FROM interview_questions
       WHERE interview_id = ? AND answer IS NOT NULL
       ORDER BY question_order DESC
       LIMIT 1`,
      [interviewId],
    );

    return rows[0] || null;
  },

  async getNextQuestionOrder(interviewId) {
    const db = await pool;
    const [rows] = await db.execute(
      `SELECT COALESCE(MAX(question_order), 0) + 1 AS nextOrder
       FROM interview_questions
       WHERE interview_id = ?`,
      [interviewId],
    );

    return rows[0].nextOrder;
  },

  async saveViolation({ interviewId, violationType, details, timestamp }) {
    const db = await pool;
    await db.execute(
      `INSERT INTO interview_violations (interview_id, violation_type, details, occurred_at)
       VALUES (?, ?, ?, ?)`,
      [interviewId, violationType, details, timestamp],
    );
  },
};

module.exports = { Interview };
