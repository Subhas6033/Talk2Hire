const { pool } = require("../../Config/database.config.js");

class AdminModel {
  // ─── Create ────────────────────────────────────────────────────────────────

  static async create({
    full_name,
    email,
    username,
    hashPassword,
    microsoft_id = null,
    role = "admin",
  }) {
    const [result] = await pool.query(
      `INSERT INTO admins
         (full_name, email, username, hashPassword, microsoft_id, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [full_name, email, username, hashPassword, microsoft_id, role],
    );
    return result.insertId;
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  static async findById(id) {
    const [rows] = await pool.query(
      `SELECT * FROM admins WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  }

  static async findByEmail(email) {
    const [rows] = await pool.query(
      `SELECT * FROM admins WHERE email = ? AND deleted_at IS NULL LIMIT 1`,
      [email],
    );
    return rows[0] || null;
  }

  static async findByUsername(username) {
    const [rows] = await pool.query(
      `SELECT * FROM admins WHERE username = ? AND deleted_at IS NULL LIMIT 1`,
      [username],
    );
    return rows[0] || null;
  }

  static async findByMicrosoftId(microsoft_id) {
    const [rows] = await pool.query(
      `SELECT * FROM admins WHERE microsoft_id = ? AND deleted_at IS NULL LIMIT 1`,
      [microsoft_id],
    );
    return rows[0] || null;
  }

  static async emailExists(email) {
    const [rows] = await pool.query(
      `SELECT id FROM admins WHERE email = ? AND deleted_at IS NULL LIMIT 1`,
      [email],
    );
    return rows.length > 0;
  }

  static async usernameExists(username) {
    const [rows] = await pool.query(
      `SELECT id FROM admins WHERE username = ? AND deleted_at IS NULL LIMIT 1`,
      [username],
    );
    return rows.length > 0;
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  static async updateRefreshToken(id, refreshToken) {
    await pool.query(`UPDATE admins SET refresh_token = ? WHERE id = ?`, [
      refreshToken,
      id,
    ]);
  }

  static async updateLastLogin(id, ip) {
    await pool.query(
      `UPDATE admins
         SET last_login_at = NOW(), last_login_ip = ?, failed_login_count = 0
       WHERE id = ?`,
      [ip, id],
    );
  }

  static async incrementFailedLogin(id) {
    await pool.query(
      `UPDATE admins
         SET failed_login_count = failed_login_count + 1
       WHERE id = ?`,
      [id],
    );
  }

  static async lockAccount(id, minutes = 30) {
    await pool.query(
      `UPDATE admins
         SET locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE)
       WHERE id = ?`,
      [minutes, id],
    );
  }

  static async clearRefreshToken(id) {
    await pool.query(`UPDATE admins SET refresh_token = NULL WHERE id = ?`, [
      id,
    ]);
  }

  static async setResetToken(id, token, expiryMinutes = 60) {
    await pool.query(
      `UPDATE admins
         SET reset_token = ?, reset_token_expiry = DATE_ADD(NOW(), INTERVAL ? MINUTE)
       WHERE id = ?`,
      [token, expiryMinutes, id],
    );
  }

  static async findByResetToken(token) {
    const [rows] = await pool.query(
      `SELECT * FROM admins
       WHERE reset_token = ?
         AND reset_token_expiry > NOW()
         AND deleted_at IS NULL
       LIMIT 1`,
      [token],
    );
    return rows[0] || null;
  }

  static async clearResetToken(id, newHashPassword) {
    await pool.query(
      `UPDATE admins
         SET hashPassword = ?, reset_token = NULL, reset_token_expiry = NULL
       WHERE id = ?`,
      [newHashPassword, id],
    );
  }

  // ─── Soft Delete ───────────────────────────────────────────────────────────

  static async softDelete(id) {
    await pool.query(`UPDATE admins SET deleted_at = NOW() WHERE id = ?`, [id]);
  }

  // ─── Safe Serialization (strip secrets) ───────────────────────────────────

  static sanitize(admin) {
    if (!admin) return null;
    const {
      hashPassword,
      refresh_token,
      reset_token,
      reset_token_expiry,
      ...safe
    } = admin;
    return safe;
  }
}

module.exports = AdminModel;
