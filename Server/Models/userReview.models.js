const { pool } = require("../Config/database.config.js");

class Review {
  static async saveReview({ full_name, email, subject, message }) {
    const [result] = await pool.query(
      `INSERT INTO user_reviews (full_name, email, subject, message)
       VALUES (?, ?, ?, ?)`,
      [full_name.trim(), email.trim(), subject.trim(), message.trim()],
    );

    return await Review.findById(result.insertId);
  }

  static async findById(id) {
    const [[review]] = await pool.query(
      `SELECT
         id,
         full_name,
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

  static async findAll({ limit = 20, offset = 0 } = {}) {
    const [reviews] = await pool.query(
      `SELECT
         id,
         full_name,
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

  static async findByEmail(email) {
    const [reviews] = await pool.query(
      `SELECT
         id,
         full_name,
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

  static async deleteById(id) {
    const [result] = await pool.query(`DELETE FROM user_reviews WHERE id = ?`, [
      id,
    ]);

    return result.affectedRows > 0;
  }
}

module.exports = { Review };
