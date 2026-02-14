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
    fullName = null, // Made optional
    email,
    hashPassword,
    resume = null,
    resumeUploadStatus = "pending",
    refreshToken = "",
    skills = null,
    mobile = null,
    location = null,
  }) {
    if (!isValidEmail(email)) {
      throw new APIERR(400, "Please enter a valid mail");
    }
    const db = pool;
    const [result] = await db.execute(
      `INSERT INTO users 
       (fullName, email, hashPassword, resume, resume_upload_status, refreshToken, skills, mobile, location) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fullName,
        email,
        hashPassword,
        resume,
        resumeUploadStatus,
        refreshToken,
        skills,
        mobile,
        location,
      ],
    );
    return result.insertId;
  },

  async updateProfile(userId, { fullName, mobile, location, skills }) {
    if (!userId) {
      throw new APIERR(400, "User ID is required");
    }

    const db = pool;
    const updates = [];
    const values = [];

    if (fullName !== undefined) {
      updates.push("fullName = ?");
      values.push(fullName);
    }
    if (mobile !== undefined) {
      updates.push("mobile = ?");
      values.push(mobile);
    }
    if (location !== undefined) {
      updates.push("location = ?");
      values.push(location);
    }
    if (skills !== undefined) {
      updates.push("skills = ?");
      values.push(skills);
    }

    if (updates.length === 0) {
      throw new APIERR(400, "No fields to update");
    }

    updates.push("updated_at = NOW()");
    values.push(userId);

    await db.execute(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values,
    );
  },

  async updateRefreshToken(userId, refreshToken) {
    const db = pool;
    await db.execute("UPDATE users SET refreshToken = ? WHERE id = ?", [
      refreshToken,
      userId,
    ]);
  },

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
       SET skills = ?, updated_at = NOW()
       WHERE id = ?`,
      [skillsString, userId],
    );
  },

  async updateCvExtractedSkills(userId, skillsArray) {
    if (!userId) {
      throw new APIERR(400, "User ID is required");
    }

    if (!Array.isArray(skillsArray)) {
      throw new APIERR(400, "Skills must be an array");
    }

    const db = pool;

    // Store as JSON
    await db.execute(
      `UPDATE users
       SET cv_extracted_skills = ?, updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(skillsArray), userId],
    );
  },

  async updateInterviewSkills(userId, skillsArray) {
    if (!userId) {
      throw new APIERR(400, "User ID is required");
    }

    if (!Array.isArray(skillsArray)) {
      throw new APIERR(400, "Skills must be an array");
    }

    const db = pool;

    // Store as JSON
    await db.execute(
      `UPDATE users
       SET interview_selected_skills = ?, updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(skillsArray), userId],
    );
  },

  async getSkills(userId) {
    if (!userId) {
      throw new APIERR(400, "User ID is required");
    }

    const db = pool;
    const [rows] = await db.execute("SELECT skills FROM users WHERE id = ?", [
      userId,
    ]);

    return rows[0]?.skills || "";
  },

  async getCvExtractedSkills(userId) {
    if (!userId) {
      throw new APIERR(400, "User ID is required");
    }

    const db = pool;
    const [rows] = await db.execute(
      "SELECT cv_extracted_skills FROM users WHERE id = ?",
      [userId],
    );

    const skillsData = rows[0]?.cv_extracted_skills;

    if (!skillsData) {
      return [];
    }

    try {
      const parsed = JSON.parse(skillsData);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Error parsing CV extracted skills:", error);
      return [];
    }
  },

  async getInterviewSkills(userId) {
    if (!userId) {
      throw new APIERR(400, "User ID is required");
    }

    const db = pool;
    const [rows] = await db.execute(
      "SELECT interview_selected_skills FROM users WHERE id = ?",
      [userId],
    );

    const skillsData = rows[0]?.interview_selected_skills;

    if (!skillsData) {
      return [];
    }

    try {
      const parsed = JSON.parse(skillsData);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Error parsing interview skills:", error);
      return [];
    }
  },

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
