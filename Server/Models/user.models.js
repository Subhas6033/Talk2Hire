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
      [email]
    );
    return rows[0];
  },

  async create({ fullName, email, hashPassword, refreshToken = "" }) {
    if (!isValidEmail(email)) {
      throw new APIERR(400, "Please enter a valid mail");
    }
    const db = await connectDB();
    const [result] = await db.execute(
      "INSERT INTO users (fullName, email, hashPassword, refreshToken) VALUES (?, ?, ?, ?)",
      [fullName, email, hashPassword, refreshToken]
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
};

module.exports = User;
