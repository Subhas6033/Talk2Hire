const { pool } = require("../Config/database.config.js");
const APIERR = require("../Utils/apierr.utils");

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const User = {
  async findByEmail(email) {
    const db = pool;
    const [rows] = await db.execute(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    return rows[0];
  },

  async findById(userId) {
    const db = pool;
    const [rows] = await db.execute(
      "SELECT * FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    return rows[0];
  },

  async create({
    fullName,
    email,
    hashPassword,
    resume,
    resumeUploadStatus = "uploading", // ✅ NEW
    refreshToken = "",
    skill = "",
  }) {
    if (!isValidEmail(email)) {
      throw new APIERR(400, "Please enter a valid mail");
    }
    const db = pool;
    const [result] = await db.execute(
      "INSERT INTO users (fullName, email, hashPassword, resume, resume_upload_status, refreshToken, skill) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        fullName,
        email,
        hashPassword,
        resume,
        resumeUploadStatus,
        refreshToken,
        skill,
      ],
    );
    return result.insertId;
  },

  async updateRefreshToken(userId, refreshToken) {
    const db = pool;
    await db.execute("UPDATE users SET refreshToken = ? WHERE id = ?", [
      refreshToken,
      userId,
    ]);
  },

  // ✅ NEW: Update resume upload status
  async updateResumeStatus(userId, status, resumeUrl = null) {
    const db = pool;
    if (resumeUrl) {
      await db.execute(
        "UPDATE users SET resume = ?, resume_upload_status = ?, updated_at = NOW() WHERE id = ?",
        [resumeUrl, status, userId],
      );
    } else {
      await db.execute(
        "UPDATE users SET resume_upload_status = ?, updated_at = NOW() WHERE id = ?",
        [status, userId],
      );
    }
  },

  async updateSkills(userId, skillsString) {
    if (!userId) {
      throw new APIERR(400, "User ID is required");
    }

    const db = pool;

    await db.execute(
      `UPDATE users
       SET skill = ?, updated_at = NOW()
       WHERE id = ?`,
      [skillsString, userId],
    );
  },

  // ✅ UPDATED: Update resume with status
  async updateResume(userId, resumeUrl, status = "completed") {
    const db = pool;
    await db.execute(
      "UPDATE users SET resume = ?, resume_upload_status = ?, updated_at = NOW() WHERE id = ?",
      [resumeUrl, status, userId],
    );
  },

  async updateProfileImage(userId, profileImagePath) {
    const db = pool;
    await db.execute(
      "UPDATE users SET profile_image_path = ?, updated_at = NOW() WHERE id = ?",
      [profileImagePath, userId],
    );
  },

  async getResumePath(userId) {
    const db = pool;
    const [result] = await db.execute("SELECT resume FROM users WHERE id = ?", [
      userId,
    ]);
    return result[0]?.resume || null;
  },

  // ✅ NEW: Get resume status
  async getResumeStatus(userId) {
    const db = pool;
    const [result] = await db.execute(
      "SELECT resume, resume_upload_status FROM users WHERE id = ?",
      [userId],
    );
    return result[0] || null;
  },

  async getProfileImagePath(userId) {
    const db = pool;
    const [result] = await db.execute(
      "SELECT profile_image_path FROM users WHERE id = ?",
      [userId],
    );
    return result[0]?.profile_image_path || null;
  },
};

module.exports = User;
