const {
  asyncHandler,
  APIERR,
  APIRES,
  sendMail,
} = require("../Utils/index.utils.js");
const { extractSkills } = require("./mistral.controllers.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../Models/user.models.js");
const { pool } = require("../Config/database.config.js");
const fs = require("fs").promises;
const path = require("path");
const {
  uploadFileToFTP,
  deleteFileFromFTP,
} = require("../Upload/uploadOnFTP.js");

const generateRefreshAndAccessTokens = async (user) => {
  const refreshToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "15d",
    },
  );

  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "1d",
    },
  );

  return { refreshToken, accessToken };
};

const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw new APIERR(401, "Refresh token missing");
  }

  const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

  const user = await User.findById(decoded.id);

  if (!user || user.refreshToken !== refreshToken) {
    throw new APIERR(401, "Invalid refresh token");
  }

  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "1d",
    },
  );

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.status(200).json(new APIRES(200, null, "Access token refreshed"));
});

const registerUser = asyncHandler(async (req, res) => {
  console.log("✅ Registration started");
  const { fullName, email, password } = req.body;
  const resumeFile = req.file;

  // Validation
  if ([fullName, email, password].some((f) => !f || f.trim() === "")) {
    throw new APIERR(400, "All fields are required");
  }

  if (password.length < 6) {
    throw new APIERR(400, "Password must be at least 6 characters");
  }

  if (!resumeFile) {
    throw new APIERR(400, "Resume is required");
  }

  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    await fs.unlink(resumeFile.path).catch(() => {});
    throw new APIERR(409, "Email is already registered");
  }

  // Read file buffer and hash password in parallel
  const [fileBuffer, passwordHash] = await Promise.all([
    fs.readFile(resumeFile.path),
    bcrypt.hash(password, 8),
  ]);

  // Clean up temp file
  await fs.unlink(resumeFile.path).catch(() => {});

  console.log("📤 Uploading resume to FTP...");

  // Upload file to FTP BEFORE creating user
  const ftpResult = await uploadFileToFTP(
    fileBuffer,
    resumeFile.originalname,
    "/public/resumes",
  );
  console.log("✅ FTP upload complete");

  console.log("🎯 Extracting skills from resume...");

  // Extract skills using the new extractSkills function
  const skillsData = await extractSkills({
    ftpUrl: ftpResult.url,
    mimeType: resumeFile.mimetype,
    originalFileName: resumeFile.originalname,
  });

  // Combine all skills from different categories
  const extractedSkills = [
    ...(Array.isArray(skillsData.technical_skills)
      ? skillsData.technical_skills
      : []),
    ...(Array.isArray(skillsData.soft_skills) ? skillsData.soft_skills : []),
    ...(Array.isArray(skillsData.certifications)
      ? skillsData.certifications
      : []),
    ...(Array.isArray(skillsData.languages) ? skillsData.languages : []),
  ].filter((skill) => skill && skill.trim());

  // Remove duplicates
  const uniqueSkills = [...new Set(extractedSkills)];

  console.log(
    `📊 Extracted ${uniqueSkills.length} unique skills:`,
    uniqueSkills,
  );
  console.log("💾 Creating user in database...");

  // ✅ Convert to comma-separated string for TEXT column
  const skillsString = uniqueSkills.join(", ");

  // Insert user with complete data (resume URL and extracted skills)
  const [result] = await pool.execute(
    `INSERT INTO users (fullName, email, hashPassword, resume, resume_upload_status, skills, interview_selected_skills) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      fullName,
      email,
      passwordHash,
      ftpResult.url,
      "completed",
      skillsString, // ✅ Store as comma-separated string
      null,
    ],
  );

  const userId = result.insertId;

  const { refreshToken, accessToken } = await generateRefreshAndAccessTokens({
    id: userId,
    email,
  });

  await User.updateRefreshToken(userId, refreshToken);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 15 * 24 * 60 * 60 * 1000,
  });

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
  });

  // Respond with complete data
  res.status(201).json(
    new APIRES(
      201,
      {
        id: userId,
        fullName,
        email,
        resumeStatus: "completed",
        cvSkills: uniqueSkills, // ✅ Send as array to frontend
        skillsBreakdown: {
          technical: skillsData.technical_skills || [],
          soft: skillsData.soft_skills || [],
          certifications: skillsData.certifications || [],
          languages: skillsData.languages || [],
        },
      },
      "User registered successfully",
    ),
  );
});

const getCVSkills = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [rows] = await pool.execute(`SELECT skills FROM users WHERE id = ?`, [
    userId,
  ]);

  if (!rows[0]) {
    throw new APIERR(404, "User not found");
  }

  // Parse skills from comma-separated string to array
  const skillsString = rows[0].skills || "";
  const cvSkills = skillsString
    ? skillsString
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean)
    : [];

  res
    .status(200)
    .json(new APIRES(200, { cvSkills }, "CV skills retrieved successfully"));
});

const checkResumeStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const resumeStatus = await User.getResumeStatus(userId);

  if (!resumeStatus) {
    throw new APIERR(404, "User not found");
  }

  res.status(200).json(
    new APIRES(
      200,
      {
        resumeUploadStatus: resumeStatus.resume_upload_status,
        resumeUrl:
          resumeStatus.resume_upload_status === "completed"
            ? resumeStatus.resume
            : null,
      },
      "Resume status fetched successfully",
    ),
  );
});

const loginUser = asyncHandler(async (req, res) => {
  console.log("Login controllers Called");
  const { email, password } = req.body;

  if ([email, password].some((f) => !f || f.trim() === "")) {
    throw new APIERR(400, "Email and Password are required");
  }

  const isUserExist = await User.findByEmail(email);
  if (!isUserExist) {
    throw new APIERR(404, "No account found with this mail");
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    isUserExist.hashPassword,
  );
  if (!isPasswordValid) {
    throw new APIERR(401, "Incorrect Password");
  }

  const { refreshToken, accessToken } = await generateRefreshAndAccessTokens({
    id: isUserExist.id,
    email,
  });

  await User.updateRefreshToken(isUserExist.id, refreshToken);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 15 * 24 * 60 * 60 * 1000,
  });

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.status(200).json(
    new APIRES(
      200,
      {
        id: isUserExist.id,
        email,
        fullName: isUserExist.fullName,
      },
      "Successfully logged in",
    ),
    console.log("Login controllers end"),
  );
});

const logoutUser = asyncHandler(async (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });

  res.status(200).json(new APIRES("User Logged out successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [rows] = await pool.execute(
    `SELECT id, fullName, email, resume, resume_upload_status, skills, interview_selected_skills 
     FROM users WHERE id = ?`,
    [userId],
  );

  if (!rows[0]) {
    throw new APIERR(404, "User not found");
  }

  const user = rows[0];

  // Parse skills from comma-separated string to array
  const skillsString = user.skills || "";
  const cvSkills = skillsString
    ? skillsString
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean)
    : [];

  const interviewSkills = user.interview_selected_skills
    ? JSON.parse(user.interview_selected_skills)
    : [];

  res.status(200).json(
    new APIRES(
      200,
      {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        resume: user.resume,
        resumeStatus: user.resume_upload_status,
        cvSkills, // ✅ Now includes parsed skills array
        interviewSkills,
      },
      "User retrieved successfully",
    ),
  );
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new APIERR(400, "Email is required");
  }

  const user = await User.findByEmail(email);
  if (!user) {
    throw new APIERR(404, "User not found with this mail");
  }

  const OTP = Math.floor(1000 + Math.random() * 9000);
  const OTP_EXPIRY_MINUTES = 2;
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  try {
    await pool.execute(
      `UPDATE users
       SET reset_password_otp = ?,
           reset_password_otp_expires_at = ?
       WHERE id = ?`,
      [OTP, expiresAt, user.id],
    );
  } catch (error) {
    console.log("Error while generating the otp", error);
    throw new APIERR(502, "Internal Server Error");
  }

  const htmlTemplate = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Reset Your Password</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #f4f6f8;
        font-family: Arial, Helvetica, sans-serif;
      }

      .email-container {
        max-width: 480px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        overflow: hidden;
      }

      .email-header {
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        color: #ffffff;
        padding: 24px;
        text-align: center;
      }

      .email-header h1 {
        margin: 0;
        font-size: 22px;
      }

      .email-body {
        padding: 28px;
        color: #333333;
        line-height: 1.6;
      }

      .email-body p {
        margin: 0 0 16px;
        font-size: 14px;
      }

      .otp-box {
        margin: 24px 0;
        padding: 16px;
        background-color: #f1f5ff;
        border-radius: 8px;
        text-align: center;
        font-size: 26px;
        letter-spacing: 6px;
        font-weight: bold;
        color: #4f46e5;
      }

      .warning {
        font-size: 12px;
        color: #6b7280;
      }

      .email-footer {
        padding: 16px;
        text-align: center;
        font-size: 12px;
        color: #9ca3af;
        border-top: 1px solid #e5e7eb;
      }
    </style>
  </head>

  <body>
    <div class="email-container">
      <div class="email-header">
        <h1>Password Reset Request</h1>
      </div>

      <div class="email-body">
        <p>Hi <strong>${user.fullName}</strong>,</p>

        <p>
          We received a request to reset your password. Use the OTP below to
          continue:
        </p>

        <div class="otp-box">${OTP}</div>

        <p class="warning">
          This OTP is valid for <strong>${OTP_EXPIRY_MINUTES} minutes</strong>. Please do not share
          it with anyone.
        </p>

        <p>
          If you did not request a password reset, you can safely ignore this
          email.
        </p>
      </div>

      <div class="email-footer">
        &copy; 2026 QuantamHash Corporation. All rights reserved.
      </div>
    </div>
  </body>
</html>
`;

  await sendMail(
    email,
    "Reset Your Password – OTP Verification",
    `Your password reset OTP is ${OTP}. This code is valid for 10 minutes. Please do not share it with anyone.`,
    htmlTemplate,
  );

  res.status(200).json(new APIRES(200, true, "Successfully sent the mail"));
});

const verifyResetPasswordOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new APIERR(400, "Email and OTP are required");
  }

  const [users] = await pool.execute(
    `SELECT id FROM users 
     WHERE email = ? AND reset_password_otp = ? AND reset_password_otp_expires_at > NOW()`,
    [email, otp],
  );

  if (users.length === 0) {
    throw new APIERR(400, "Invalid or expired OTP");
  }

  const userId = users[0].id;

  await pool.execute(
    `UPDATE users
     SET reset_password_otp = NULL,
         reset_password_otp_expires_at = NULL
     WHERE id = ?`,
    [userId],
  );

  res
    .status(200)
    .json(new APIRES(200, { verified: true }, "OTP verified successfully"));
});

const resetPassword = asyncHandler(async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;

  if (!email || !newPassword || !confirmPassword) {
    throw new APIERR(400, "All fields are required");
  }

  if (newPassword !== confirmPassword) {
    throw new APIERR(400, "Passwords do not match");
  }

  if (newPassword.length < 6) {
    throw new APIERR(400, "Password must be at least 6 characters long");
  }

  const users = await User.findByEmail(email);
  const userId = users.id;

  const hashedPassword = await bcrypt.hash(newPassword, 8);

  await pool.execute(
    "UPDATE users SET hashPassword = ?, updated_at = NOW() WHERE id = ?",
    [hashedPassword, userId],
  );

  res.status(200).json(new APIRES(200, true, "Password reset successfully"));
});

const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const user = await User.findById(userId);
  if (!user) {
    throw new APIERR(404, "User not found");
  }

  const updateFields = [];
  const updateValues = [];
  let resumeUploadData = null; // Store resume data for background processing

  // Handle resume upload
  if (req.files?.resume) {
    const resume = req.files.resume[0];

    if (resume.mimetype !== "application/pdf") {
      try {
        await fs.unlink(resume.path);
      } catch (err) {
        console.log("Error deleting file:", err);
      }
      throw new APIERR(400, "Only PDF files are allowed for resume");
    }

    if (resume.size > 5 * 1024 * 1024) {
      try {
        await fs.unlink(resume.path);
      } catch (err) {
        console.log("Error deleting file:", err);
      }
      throw new APIERR(400, "Resume file size must be less than 5MB");
    }

    let ftpUploadResult;
    try {
      const fileBuffer = await fs.readFile(resume.path);

      console.log("📤 Uploading resume to FTP...");
      ftpUploadResult = await uploadFileToFTP(
        fileBuffer,
        resume.originalname,
        `/public/resumes/`,
      );

      console.log("✅ Resume uploaded to FTP:", ftpUploadResult.url);

      if (user.resume) {
        try {
          const oldUrl = user.resume;
          const urlObj = new URL(oldUrl);
          const remotePath = urlObj.pathname;

          if (remotePath && remotePath.includes("/public/resumes/")) {
            console.log("🗑️ Deleting old resume from FTP:", remotePath);
            await deleteFileFromFTP(remotePath);
          }
        } catch (err) {
          console.log("Error deleting old resume from FTP:", err);
        }
      }

      try {
        await fs.unlink(resume.path);
        console.log("🗑️ Local file deleted");
      } catch (err) {
        console.log("Error deleting local file:", err);
      }

      // Store resume data for background skill extraction
      resumeUploadData = {
        ftpUrl: ftpUploadResult.url,
        mimeType: resume.mimetype,
        originalFileName: resume.originalname,
        userId: userId,
      };
    } catch (error) {
      try {
        await fs.unlink(resume.path);
      } catch (err) {
        console.log("Error deleting local file:", err);
      }
      throw new APIERR(500, `Failed to upload resume: ${error.message}`);
    }

    updateFields.push("resume = ?");
    updateValues.push(ftpUploadResult.url);

    // Set resume upload status to 'processing' initially
    updateFields.push("resume_upload_status = ?");
    updateValues.push("processing");
  }

  // Handle profile image upload
  if (req.files?.profileImage) {
    const profileImage = req.files.profileImage[0];

    const allowedImageTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    if (!allowedImageTypes.includes(profileImage.mimetype)) {
      try {
        await fs.unlink(profileImage.path);
      } catch (err) {
        console.log("Error deleting file:", err);
      }
      throw new APIERR(400, "Only JPEG, PNG, and WebP images are allowed");
    }

    if (profileImage.size > 2 * 1024 * 1024) {
      try {
        await fs.unlink(profileImage.path);
      } catch (err) {
        console.log("Error deleting file:", err);
      }
      throw new APIERR(400, "Profile image size must be less than 2MB");
    }

    let ftpUploadResult;
    try {
      const fileBuffer = await fs.readFile(profileImage.path);

      console.log("📤 Uploading profile image to FTP...");
      ftpUploadResult = await uploadFileToFTP(
        fileBuffer,
        profileImage.originalname,
        `/public/profile-images/${userId}`,
      );

      console.log("✅ Profile image uploaded to FTP:", ftpUploadResult.url);

      if (user.profile_image_path) {
        try {
          const oldUrl = user.profile_image_path;
          const remotePath = oldUrl.split("/interview2")[1];
          if (remotePath) {
            console.log("🗑️ Deleting old profile image from FTP:", remotePath);
            await deleteFileFromFTP(remotePath);
          }
        } catch (err) {
          console.log("Error deleting old profile image from FTP:", err);
        }
      }

      try {
        await fs.unlink(profileImage.path);
        console.log("🗑️ Local file deleted");
      } catch (err) {
        console.log("Error deleting local file:", err);
      }
    } catch (error) {
      try {
        await fs.unlink(profileImage.path);
      } catch (err) {
        console.log("Error deleting local file:", err);
      }
      throw new APIERR(500, `Failed to upload profile image: ${error.message}`);
    }

    updateFields.push("profile_image_path = ?");
    updateValues.push(ftpUploadResult.url);
  }

  if (updateFields.length === 0) {
    throw new APIERR(400, "No files to update");
  }

  updateFields.push("updated_at = NOW()");
  updateValues.push(userId);

  const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;

  try {
    await pool.execute(query, updateValues);
  } catch (error) {
    console.error("Error updating profile:", error);
    throw new APIERR(500, "Failed to update profile");
  }

  // Start background skill extraction if resume was uploaded
  if (resumeUploadData) {
    processSkillExtraction(resumeUploadData).catch((error) => {
      console.error("❌ Background skill extraction failed:", error);
    });
  }

  const updatedUser = await User.findById(userId);
  delete updatedUser.hashPassword;
  delete updatedUser.refreshToken;

  res
    .status(200)
    .json(new APIRES(200, updatedUser, "Profile updated successfully"));
});

// Background skill extraction function
async function processSkillExtraction({
  ftpUrl,
  mimeType,
  originalFileName,
  userId,
}) {
  try {
    console.log(`🔄 Starting background skill extraction for user ${userId}`);

    // Extract skills using the existing extractSkills function
    const skillsData = await extractSkills({
      ftpUrl,
      mimeType,
      originalFileName,
    });

    // Combine all skills into a comma-separated string for the cv_skill field
    const allSkills = [
      ...(skillsData.technical_skills || []),
      ...(skillsData.soft_skills || []),
      ...(skillsData.certifications || []),
      ...(skillsData.languages || []),
    ].filter(Boolean);

    const skillsString = allSkills.join(", ");

    // Update user skills in database
    await User.updateSkills(userId, skillsString);

    // Update resume status to 'completed'
    await User.updateResumeStatus(userId, "completed");

    console.log(`✅ Skills extraction completed for user ${userId}`);
    console.log(`📝 Extracted ${allSkills.length} skills`);
  } catch (error) {
    console.error(`❌ Skill extraction failed for user ${userId}:`, error);

    // Update status to 'failed' if extraction fails
    try {
      await User.updateResumeStatus(userId, "failed");
    } catch (statusError) {
      console.error("Failed to update resume status:", statusError);
    }
  }
}

module.exports = {
  generateRefreshAndAccessTokens,
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  getCurrentUser,
  refreshAccessToken,
  verifyResetPasswordOtp,
  resetPassword,
  updateProfile,
  checkResumeStatus,
  getCVSkills,
};
