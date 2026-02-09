const { connectDB } = require("../Config/database.config");
const APIERR = require("../Utils/apierr.utils");

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const User = {
  async findByEmail(email) {
    const db = await connectDB();
    const [rows] = await db.execute(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    return rows[0];
  },

  async findById(userId) {
    const db = await connectDB();
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
    refreshToken = "",
    skill = "",
  }) {
    if (!isValidEmail(email)) {
      throw new APIERR(400, "Please enter a valid mail");
    }
    const db = await connectDB();
    const [result] = await db.execute(
      "INSERT INTO users (fullName, email, hashPassword, resume, refreshToken) VALUES (?, ?, ?, ?, ?)",
      [fullName, email, hashPassword, resume, refreshToken],
    );
    return result.insertId;
  },

  async updateRefreshToken(userId, refreshToken) {
    const db = await connectDB();
    await db.execute("UPDATE users SET refreshToken = ? WHERE id = ?", [
      refreshToken,
      userId,
    ]);
  },

  // ✅ NEW: Update user skills
  async updateSkills(userId, skillsString) {
    if (!userId) {
      throw new APIERR(400, "User ID is required");
    }

    const db = await connectDB();

    await db.execute(
      `
      UPDATE users
      SET skill = ?, updated_at = NOW()
      WHERE id = ?
      `,
      [skillsString, userId],
    );
  },

  // ✅ NEW: Update resume
  async updateResume(userId, resumePath, resumeName) {
    const db = await connectDB();
    await db.execute(
      "UPDATE users SET resume_path = ?, resume_name = ?, updated_at = NOW() WHERE id = ?",
      [resumePath, resumeName, userId],
    );
  },

  // ✅ NEW: Update profile image
  async updateProfileImage(userId, profileImagePath) {
    const db = await connectDB();
    await db.execute(
      "UPDATE users SET profile_image_path = ?, updated_at = NOW() WHERE id = ?",
      [profileImagePath, userId],
    );
  },

  // ✅ NEW: Get user's resume path
  async getResumePath(userId) {
    const db = await connectDB();
    const [result] = await db.execute(
      "SELECT resume_path FROM users WHERE id = ?",
      [userId],
    );
    return result[0]?.resume_path || null;
  },

  // ✅ NEW: Get user's profile image path
  async getProfileImagePath(userId) {
    const db = await connectDB();
    const [result] = await db.execute(
      "SELECT profile_image_path FROM users WHERE id = ?",
      [userId],
    );
    return result[0]?.profile_image_path || null;
  },
};

module.exports = User;
