const { connectDB } = require("../Config/database.config");
const { APIERR } = require("../Utils/index.utils.js");

const Interview = {
  async createSession(userId) {
    if (!userId) throw new APIERR(400, "User ID is required");

    let db;
    try {
      db = await connectDB();
      const [result] = await db.execute(
        "INSERT INTO interviews (user_id) VALUES (?)",
        [userId]
      );
      return result.insertId;
    } catch (error) {
      console.error("❌ Database error in createSession:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async getSessionById(interviewId) {
    let db;
    try {
      db = await connectDB();
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
    } catch (error) {
      console.error("❌ Database error in getSessionById:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

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

    let db;
    try {
      db = await connectDB();

      console.log("💾 Attempting to save question:", {
        interviewId,
        questionOrder,
        questionLength: question.length,
      });

      const [result] = await db.execute(
        `INSERT INTO interview_questions
         (interview_id, question, technology, difficulty, question_order)
         VALUES (?, ?, ?, ?, ?)`,
        [interviewId, question, technology, difficulty, questionOrder]
      );

      console.log("💾 Question saved successfully:", {
        insertId: result.insertId,
        affectedRows: result.affectedRows,
      });

      return result.insertId;
    } catch (error) {
      console.error("❌ Database error in saveQuestion:", {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
      });

      // Provide better error message for duplicate entries
      if (error.code === "ER_DUP_ENTRY") {
        throw new APIERR(
          409,
          `Question with order ${questionOrder} already exists for this interview`
        );
      }

      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async saveAnswer({ interviewId, questionId, answer }) {
    if (!interviewId || !questionId) {
      throw new APIERR(400, "Interview ID and Question ID are required");
    }

    let db;
    try {
      db = await connectDB();

      console.log("💾 Attempting to save answer:", {
        interviewId,
        questionId,
        answerLength: answer?.length || 0,
      });

      const [result] = await db.execute(
        `UPDATE interview_questions
         SET answer = ?
         WHERE id = ? AND interview_id = ?`,
        [answer, questionId, interviewId]
      );

      if (result.affectedRows === 0) {
        throw new APIERR(404, "Question not found for this interview");
      }

      console.log("💾 Answer saved successfully:", {
        affectedRows: result.affectedRows,
      });

      return true;
    } catch (error) {
      console.error("❌ Database error in saveAnswer:", {
        message: error.message,
        code: error.code,
        errno: error.errno,
      });
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async getSessionHistory(interviewId) {
    let db;
    try {
      db = await connectDB();
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
    } catch (error) {
      console.error("❌ Database error in getSessionHistory:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async getQuestionByOrder(interviewId, questionOrder) {
    let db;
    try {
      db = await connectDB();
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
    } catch (error) {
      console.error("❌ Database error in getQuestionByOrder:", error);
      throw error;
    } finally {
      if (db) db.release(); // ✅ Changed from db.end()
    }
  },

  async getLastAnsweredQuestion(interviewId) {
    let db;
    try {
      db = await connectDB();
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
    } catch (error) {
      console.error("❌ Database error in getLastAnsweredQuestion:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async getNextQuestionOrder(interviewId) {
    let db;
    try {
      db = await connectDB();
      const [rows] = await db.execute(
        `SELECT COALESCE(MAX(question_order), 0) + 1 AS nextOrder
         FROM interview_questions
         WHERE interview_id = ?`,
        [interviewId]
      );

      return rows[0].nextOrder;
    } catch (error) {
      console.error("❌ Database error in getNextQuestionOrder:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },
};

module.exports = { Interview };
