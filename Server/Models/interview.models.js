const { connectDB } = require("../Config/database.config");
const { APIERR } = require("../Utils/index.utils.js");

const Interview = {
  /**
   * Create a new interview session for a user
   */
  async createSession(userId) {
    if (!userId) throw new APIERR(400, "User ID is required");

    const db = await connectDB();
    const [result] = await db.execute(
      "INSERT INTO interviews (user_id) VALUES (?)",
      [userId]
    );

    return result.insertId;
  },

  /**
   * Get interview session by ID
   */
  async getSessionById(interviewId) {
    const db = await connectDB();
    const [rows] = await db.execute(
      `SELECT id, user_id, created_at
       FROM interviews
       WHERE id = ?
       LIMIT 1`,
      [interviewId]
    );

    if (!rows[0]) {
      throw new APIERR(404, "Interview session not found");
    }

    return rows[0];
  },

  /**
   * Save a question to an interview
   */
  async saveQuestion({
    interviewId,
    question,
    technology = null,
    difficulty = null,
    questionOrder,
  }) {
    if (!interviewId) throw new APIERR(400, "Interview ID is required");
    if (!question) throw new APIERR(400, "Question is required");
    if (questionOrder === undefined || questionOrder === null) {
      throw new APIERR(400, "Question order is required");
    }

    const db = await connectDB();

    const [result] = await db.execute(
      `INSERT INTO interview_questions
       (interview_id, question, technology, difficulty, question_order)
       VALUES (?, ?, ?, ?, ?)`,
      [interviewId, question, technology, difficulty, questionOrder]
    );

    return result.insertId;
  },

  /**
   * Save / update answer for a question
   * (Validated against interview_id for safety)
   */
  async saveAnswer({ interviewId, questionId, answer }) {
    if (!interviewId || !questionId) {
      throw new APIERR(400, "Interview ID and Question ID are required");
    }

    const db = await connectDB();
    const [result] = await db.execute(
      `UPDATE interview_questions
       SET answer = ?
       WHERE id = ? AND interview_id = ?`,
      [answer, questionId, interviewId]
    );

    if (result.affectedRows === 0) {
      throw new APIERR(404, "Question not found for this interview");
    }

    return true;
  },

  /**
   * Get full interview history (Q&A ordered)
   */
  async getSessionHistory(interviewId) {
    const db = await connectDB();
    const [rows] = await db.execute(
      `SELECT id,
              question,
              answer,
              technology,
              difficulty,
              question_order,
              created_at
       FROM interview_questions
       WHERE interview_id = ?
       ORDER BY question_order ASC`,
      [interviewId]
    );

    return rows;
  },

  /**
   * Get question by order (used for navigation / replay)
   */
  async getQuestionByOrder(interviewId, questionOrder) {
    const db = await connectDB();
    const [rows] = await db.execute(
      `SELECT id,
              question,
              answer,
              technology,
              difficulty
       FROM interview_questions
       WHERE interview_id = ?
         AND question_order = ?
       LIMIT 1`,
      [interviewId, questionOrder]
    );

    return rows[0] || null;
  },

  /**
   * Get the last answered question
   * (CRITICAL for dynamic AI follow-ups)
   */
  async getLastAnsweredQuestion(interviewId) {
    const db = await connectDB();
    const [rows] = await db.execute(
      `SELECT id,
              question,
              answer,
              technology,
              difficulty,
              question_order
       FROM interview_questions
       WHERE interview_id = ?
         AND answer IS NOT NULL
       ORDER BY question_order DESC
       LIMIT 1`,
      [interviewId]
    );

    return rows[0] || null;
  },

  /**
   * Get next question order number
   */
  async getNextQuestionOrder(interviewId) {
    const db = await connectDB();
    const [rows] = await db.execute(
      `SELECT COALESCE(MAX(question_order), 0) + 1 AS nextOrder
       FROM interview_questions
       WHERE interview_id = ?`,
      [interviewId]
    );

    return rows[0].nextOrder;
  },
};

module.exports = { Interview };
