const { pool } = require("../Config/database.config");
const { APIERR } = require("../Utils/index.utils.js");

const Interview = {
  async createSession(userId, jobId, candidateName = "") {
    if (!userId) throw new APIERR(400, "User ID is required");
    if (!jobId) throw new APIERR(400, "Job ID is required");

    const [result] = await pool.execute(
      "INSERT INTO interviews (user_id, job_id, candidate_name) VALUES (?, ?, ?)",
      [userId, jobId, candidateName],
    );
    return result.insertId;
  },

  async getSessionById(interviewId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, job_id, created_at FROM interviews WHERE id = ? LIMIT 1`,
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

    try {
      const [result] = await pool.execute(
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

    const [result] = await pool.execute(
      `UPDATE interview_questions SET answer = ? WHERE id = ? AND interview_id = ?`,
      [answer, questionId, interviewId],
    );

    if (result.affectedRows === 0) {
      throw new APIERR(404, "Question not found for this interview");
    }
    return true;
  },

  async getSessionHistory(interviewId) {
    const [rows] = await pool.execute(
      `SELECT id, question, category, answer, technology, difficulty, question_order, created_at
       FROM interview_questions
       WHERE interview_id = ?
       ORDER BY question_order ASC`,
      [interviewId],
    );
    return rows;
  },

  async getQuestionByOrder(interviewId, questionOrder) {
    const [rows] = await pool.execute(
      `SELECT id, question, category, answer, technology, difficulty
       FROM interview_questions
       WHERE interview_id = ? AND question_order = ?
       LIMIT 1`,
      [interviewId, questionOrder],
    );
    return rows[0] || null;
  },

  async getLastAnsweredQuestion(interviewId) {
    const [rows] = await pool.execute(
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
    const [rows] = await pool.execute(
      `SELECT COALESCE(MAX(question_order), 0) + 1 AS nextOrder
       FROM interview_questions
       WHERE interview_id = ?`,
      [interviewId],
    );
    return rows[0].nextOrder;
  },

  // ── Violation methods ───────────────────────────────────────────────────────

  /**
   * Open a new violation record.
   * Returns the auto-increment id of the inserted row.
   * Called when a violation window starts (e.g. face first goes missing).
   */
  async openViolation({
    interviewId,
    userId,
    violationType,
    details = {},
    startTime,
  }) {
    const [result] = await pool.execute(
      `INSERT INTO interview_violations
         (interview_id, user_id, violation_type, details, start_time, warning_count, resolved)
       VALUES (?, ?, ?, ?, ?, 1, 0)`,
      [interviewId, userId, violationType, JSON.stringify(details), startTime],
    );
    return result.insertId;
  },

  /**
   * Close an open violation by setting end_time and resolved = 1.
   * Called when the violation is resolved (e.g. face returns).
   */
  async closeViolation({ violationId, endTime }) {
    await pool.execute(
      `UPDATE interview_violations
       SET end_time = ?, resolved = 1, updated_at = NOW()
       WHERE id = ?`,
      [endTime, violationId],
    );
  },

  /**
   * Increment the warning_count on an ongoing violation.
   * Called each time the same absence triggers another warning.
   */
  async updateViolationWarningCount({ violationId, warningCount }) {
    await pool.execute(
      `UPDATE interview_violations
       SET warning_count = ?, updated_at = NOW()
       WHERE id = ?`,
      [warningCount, violationId],
    );
  },

  /**
   * Save a point-in-time violation (opens and immediately closes it).
   * Used for instant events like MULTIPLE_FACES.
   */
  async saveViolation({
    interviewId,
    userId = null,
    violationType,
    details = {},
    timestamp,
  }) {
    const ts = new Date(timestamp);
    const closeTs = new Date(timestamp + 100); // 100 ms later = instant close
    const [result] = await pool.execute(
      `INSERT INTO interview_violations
         (interview_id, user_id, violation_type, details, start_time, end_time, warning_count, resolved)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
      [
        interviewId,
        userId,
        violationType,
        JSON.stringify(details),
        ts,
        closeTs,
      ],
    );
    return result.insertId;
  },

  // ── Recording URL methods ───────────────────────────────────────────────────

  /** Save the primary camera manifest / video URL. */
  async savePriRecordingUrl({ interviewId, userId, url }) {
    await pool.execute(
      `UPDATE interviews SET pri_recording_url = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [url, interviewId, userId],
    );
  },

  /** Save the mobile / secondary camera manifest / video URL. */
  async saveMobRecordingUrl({ interviewId, userId, url }) {
    await pool.execute(
      `UPDATE interviews SET mob_recording_url = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [url, interviewId, userId],
    );
  },

  /** Save the screen-recording manifest / video URL. */
  async saveScrRecordingUrl({ interviewId, userId, url }) {
    await pool.execute(
      `UPDATE interviews SET scr_recording_url = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [url, interviewId, userId],
    );
  },

  /** Get all three recording URLs for an interview in one query. */
  async getRecordingUrls(interviewId) {
    const [[row]] = await pool.execute(
      `SELECT pri_recording_url, mob_recording_url, scr_recording_url
       FROM interviews WHERE id = ?`,
      [interviewId],
    );
    return row ?? null;
  },
};

module.exports = { Interview };
