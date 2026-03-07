const { pool } = require("../Config/database.config.js");

class Review {
  /* ─────────────────────────────────────────────────────────────────────────
     Save a new review
     ───────────────────────────────────────────────────────────────────────── */
  static async saveReview({ fullName, email, subject, message }) {
    const [result] = await pool.query(
      `INSERT INTO user_reviews (full_name, email, subject, message)
       VALUES (?, ?, ?, ?)`,
      [fullName.trim(), email.trim(), subject.trim(), message.trim()],
    );

    return await Review.findById(result.insertId);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     Find a single review by ID
     ───────────────────────────────────────────────────────────────────────── */
  static async findById(id) {
    const [[review]] = await pool.query(
      `SELECT
         id,
         full_name   AS fullName,
         email,
         subject,
         message,
         created_at  AS createdAt,
         updated_at  AS updatedAt
       FROM user_reviews
       WHERE id = ?
       LIMIT 1`,
      [id],
    );

    return review || null;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     Find all reviews (newest first, paginated)
     ───────────────────────────────────────────────────────────────────────── */
  static async findAll({ limit = 20, offset = 0 } = {}) {
    const [reviews] = await pool.query(
      `SELECT
         id,
         full_name   AS fullName,
         email,
         subject,
         message,
         created_at  AS createdAt,
         updated_at  AS updatedAt
       FROM user_reviews
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM user_reviews`,
    );

    return { reviews, total };
  }

  /* ─────────────────────────────────────────────────────────────────────────
     Find reviews by email
     ───────────────────────────────────────────────────────────────────────── */
  static async findByEmail(email) {
    const [reviews] = await pool.query(
      `SELECT
         id,
         full_name   AS fullName,
         email,
         subject,
         message,
         created_at  AS createdAt,
         updated_at  AS updatedAt
       FROM user_reviews
       WHERE email = ?
       ORDER BY created_at DESC`,
      [email.trim()],
    );

    return reviews;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     Delete a review by ID
     ───────────────────────────────────────────────────────────────────────── */
  static async deleteById(id) {
    const [result] = await pool.query(`DELETE FROM user_reviews WHERE id = ?`, [
      id,
    ]);

    return result.affectedRows > 0;
  }
}

module.exports = { Review };
