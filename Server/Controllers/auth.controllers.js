const {
  asyncHandler,
  APIERR,
  APIRES,
  sendMail,
} = require("../Utils/index.utils.js");
const { extractSkills, mistral } = require("./mistral.controllers.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../Models/user.models.js");
const { pool } = require("../Config/database.config.js");
const fs = require("fs").promises;
const {
  uploadFileToFTP,
  deleteFileFromFTP,
} = require("../Upload/uploadOnFTP.js");
const crypto = require("node:crypto");

const generateRefreshAndAccessTokens = async (user) => {
  const refreshToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "15d" },
  );

  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "1d" },
  );

  return { refreshToken, accessToken };
};

const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) throw new APIERR(401, "Refresh token missing");

  const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  const user = await User.findById(decoded.id);

  if (!user || user.refreshToken !== refreshToken) {
    throw new APIERR(401, "Invalid refresh token");
  }

  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "1d" },
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

function parseAIResponse(content) {
  try {
    let cleaned = content.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");
    return JSON.parse(cleaned.trim());
  } catch (error) {
    console.error("❌ Failed to parse AI response:", error);
    throw new Error(`Invalid JSON response from AI: ${error.message}`);
  }
}

const uploadResumeForRegistration = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const resumeFile = req.file;

  if (!password || password.trim() === "")
    throw new APIERR(400, "Password is required");
  if (password.length < 6)
    throw new APIERR(400, "Password must be at least 6 characters");
  if (!resumeFile) throw new APIERR(400, "Resume is required");

  const [fileBuffer, passwordHash] = await Promise.all([
    fs.readFile(resumeFile.path),
    bcrypt.hash(password, 8),
  ]);
  await fs.unlink(resumeFile.path).catch(() => {});

  const ftpResult = await uploadFileToFTP(
    fileBuffer,
    resumeFile.originalname,
    "/public/resumes",
  );

  const tempSessionId = crypto.randomBytes(32).toString("hex");

  await pool.execute(
    `INSERT INTO temp_registrations (session_id, password_hash, resume_url, resume_mimetype, resume_filename, status, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
    [
      tempSessionId,
      passwordHash,
      ftpResult.url,
      resumeFile.mimetype,
      resumeFile.originalname,
      "processing",
    ],
  );

  extractResumeForTempRegistration({
    sessionId: tempSessionId,
    ftpUrl: ftpResult.url,
    mimeType: resumeFile.mimetype,
    originalFileName: resumeFile.originalname,
  }).catch((error) => console.error("❌ Background extraction failed:", error));

  res
    .status(200)
    .json(
      new APIRES(
        200,
        { sessionId: tempSessionId, status: "processing" },
        "Resume uploaded. Extraction in progress.",
      ),
    );
});

async function extractResumeForTempRegistration({
  sessionId,
  ftpUrl,
  mimeType,
  originalFileName,
}) {
  try {
    let extractedText = "";
    if (mimeType === "application/pdf") {
      const ocrResponse = await fetch("https://api.mistral.ai/v1/ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model: "mistral-ocr-latest",
          document: { type: "document_url", document_url: ftpUrl },
          include_image_base64: false,
        }),
      });
      const ocrData = await ocrResponse.json();
      extractedText =
        ocrData.pages?.map((p) => p.markdown || "").join("\n\n") || "";
    }
    extractedText = extractedText.replace(/\s+/g, " ").trim();

    const emailResponse = await mistral.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "system",
          content: `Extract ONLY the email address from the resume text. Return just the email, nothing else. If no email found, return "null".`,
        },
        {
          role: "user",
          content: `Extract email from: ${extractedText.slice(0, 3000)}`,
        },
      ],
    });

    const email = emailResponse.choices[0].message.content.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const extractedEmail =
      email === "null" || !emailRegex.test(email) ? null : email;

    if (!extractedEmail) {
      await pool.execute(
        `UPDATE temp_registrations SET status = ?, error_message = ? WHERE session_id = ?`,
        ["failed", "Could not extract email from resume", sessionId],
      );
      return;
    }

    const personalInfoResponse = await mistral.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "system",
          content: `You are a resume parser. Extract the following information from the resume:
1. Full name
2. Mobile/phone number
3. Location/City

Return ONLY a valid JSON object with these fields, no markdown formatting:
{"fullName": "...","mobile": "...","location": "..."}

CRITICAL RULES:
- Return ONLY the JSON object, nothing else
- Do NOT wrap in markdown code fences
- No explanation, no extra text
- If a field is not found, set it to null`,
        },
        {
          role: "user",
          content: `Extract personal information from this resume:\n\n${extractedText.slice(0, 3000)}`,
        },
      ],
    });

    const personalInfo = parseAIResponse(
      personalInfoResponse.choices[0].message.content,
    );

    const detectedDomain = await detectResumeDomain({
      ftpUrl,
      mimeType,
      originalFileName,
    });
    const skillsData = await extractSkills({
      ftpUrl,
      mimeType,
      originalFileName,
      targetDomain: detectedDomain,
      matchThreshold: 6,
    });

    const normaliseSkill = (item) => {
      if (!item) return null;
      if (typeof item === "string") return item.trim() || null;
      if (typeof item === "object" && typeof item.skill === "string")
        return item.skill.trim() || null;
      return null;
    };

    const allSkills = [
      ...(skillsData.technical_skills || []),
      ...(skillsData.soft_skills || []),
      ...(skillsData.certifications || []),
      ...(skillsData.languages || []),
    ]
      .map(normaliseSkill)
      .filter(Boolean);

    const seen = new Set();
    const uniqueSkills = allSkills.filter((skill) => {
      const key = skill.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await pool.execute(
      `UPDATE temp_registrations 
       SET status = ?, extracted_email = ?, extracted_fullname = ?, extracted_mobile = ?, extracted_location = ?, extracted_skills = ?, updated_at = NOW()
       WHERE session_id = ?`,
      [
        "completed",
        extractedEmail,
        personalInfo.fullName || null,
        personalInfo.mobile || null,
        personalInfo.location || null,
        uniqueSkills.join(", "),
        sessionId,
      ],
    );
  } catch (error) {
    console.error(`❌ Extraction failed for session ${sessionId}:`, error);
    await pool.execute(
      `UPDATE temp_registrations SET status = ?, error_message = ? WHERE session_id = ?`,
      ["failed", error.message, sessionId],
    );
  }
}

const getExtractionStatus = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const [rows] = await pool.execute(
    `SELECT session_id, status, extracted_email, extracted_fullname, extracted_mobile, extracted_location, extracted_skills, error_message
     FROM temp_registrations WHERE session_id = ? AND expires_at > NOW()`,
    [sessionId],
  );

  if (!rows[0]) throw new APIERR(404, "Session not found or expired");

  const data = rows[0];
  const cvSkills = data.extracted_skills
    ? data.extracted_skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  res.status(200).json(
    new APIRES(
      200,
      {
        sessionId: data.session_id,
        status: data.status,
        extractedData:
          data.status === "completed"
            ? {
                email: data.extracted_email,
                fullName: data.extracted_fullname,
                mobile: data.extracted_mobile,
                location: data.extracted_location,
                cvSkills,
              }
            : null,
        error: data.error_message,
      },
      "Extraction status retrieved",
    ),
  );
});

// ─── FIX 1: Pass role to token generator ─────────────────────────────────────
const completeRegistration = asyncHandler(async (req, res) => {
  const { sessionId, fullName, email, mobile, location, skills } = req.body;

  if (!sessionId || !fullName || !email || !skills) {
    throw new APIERR(400, "Missing required fields");
  }

  const [tempRows] = await pool.execute(
    `SELECT * FROM temp_registrations WHERE session_id = ? AND status = 'completed' AND expires_at > NOW()`,
    [sessionId],
  );

  if (!tempRows[0])
    throw new APIERR(
      404,
      "Session not found, expired, or extraction not complete",
    );

  const tempData = tempRows[0];

  const existingUser = await User.findByEmail(email);
  if (existingUser) throw new APIERR(409, "Email is already registered");

  const ROLE = "user";

  const [result] = await pool.execute(
    `INSERT INTO users (email, hashPassword, fullName, mobile, location, skills, resume, resume_upload_status, created_at, updated_at, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)`,
    [
      email,
      tempData.password_hash,
      fullName,
      mobile || null,
      location || null,
      skills,
      tempData.resume_url,
      "completed",
      ROLE,
    ],
  );

  const userId = result.insertId;

  // role is now passed so JWT contains it
  const { refreshToken, accessToken } = await generateRefreshAndAccessTokens({
    id: userId,
    email,
    role: ROLE,
  });
  await User.updateRefreshToken(userId, refreshToken);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  };

  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 15 * 24 * 60 * 60 * 1000,
  });
  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 24 * 60 * 60 * 1000,
  });

  await pool.execute(`DELETE FROM temp_registrations WHERE session_id = ?`, [
    sessionId,
  ]);

  res.status(201).json(
    new APIRES(
      201,
      {
        id: userId,
        email,
        fullName,
        mobile,
        location,
        cvSkills: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        resumeStatus: "completed",
        role: ROLE,
      },
      "Registration completed successfully",
    ),
  );
});

async function detectResumeDomain({ ftpUrl, mimeType }) {
  let extractedText = "";

  if (mimeType === "application/pdf") {
    const ocrResponse = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: { type: "document_url", document_url: ftpUrl },
        include_image_base64: false,
      }),
    });
    const ocrData = await ocrResponse.json();
    extractedText =
      ocrData.pages?.map((p) => p.markdown || "").join("\n\n") || "";
  }

  extractedText = extractedText.replace(/\s+/g, " ").trim();

  const domainResponse = await mistral.chat.complete({
    model: "mistral-small-latest",
    messages: [
      {
        role: "system",
        content: `You are a resume analyser. Based on the resume text provided, determine the single most specific professional domain or job role the candidate belongs to.
Examples: "Full Stack Web Developer", "Data Scientist", "DevOps Engineer", "UI/UX Designer".
Rules:
- Return ONLY the domain/role as a short phrase (2-5 words).
- No explanation, no punctuation, no extra text.`,
      },
      {
        role: "user",
        content: `Determine the professional domain of this resume:\n\n${extractedText.slice(0, 5000)}`,
      },
    ],
  });

  return (
    domainResponse.choices[0].message.content
      .trim()
      .replace(/^["']|["']$/g, "") || "Software Engineer"
  );
}

const getCVSkills = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [rows] = await pool.execute(`SELECT skills FROM users WHERE id = ?`, [
    userId,
  ]);
  if (!rows[0]) throw new APIERR(404, "User not found");

  const cvSkills = (rows[0].skills || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  res
    .status(200)
    .json(new APIRES(200, { cvSkills }, "CV skills retrieved successfully"));
});

const checkResumeStatus = asyncHandler(async (req, res) => {
  const resumeStatus = await User.getResumeStatus(req.user.id);
  if (!resumeStatus) throw new APIERR(404, "User not found");

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

// ─── FIX 2: Pass role to token generator ─────────────────────────────────────
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if ([email, password].some((f) => !f || f.trim() === "")) {
    throw new APIERR(400, "Email and Password are required");
  }

  const isUserExist = await User.findByEmail(email);
  if (!isUserExist) throw new APIERR(404, "No account found with this mail");

  const isPasswordValid = await bcrypt.compare(
    password,
    isUserExist.hashPassword,
  );
  if (!isPasswordValid) throw new APIERR(401, "Incorrect Password");

  // role is now passed so JWT contains it
  const { refreshToken, accessToken } = await generateRefreshAndAccessTokens({
    id: isUserExist.id,
    email,
    role: isUserExist.role,
  });

  await User.updateRefreshToken(isUserExist.id, refreshToken);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  };

  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 15 * 24 * 60 * 60 * 1000,
  });
  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.status(200).json(
    new APIRES(
      200,
      {
        id: isUserExist.id,
        email,
        fullName: isUserExist.fullName,
        role: isUserExist.role,
      },
      "Successfully logged in",
    ),
  );
});

const logoutUser = asyncHandler(async (req, res) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  };
  res.clearCookie("refreshToken", cookieOptions);
  res.clearCookie("accessToken", cookieOptions);
  res.status(200).json(new APIRES(200, null, "User Logged out successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [rows] = await pool.execute(
    `SELECT id, fullName, email, role, resume, resume_upload_status,
            skills, interview_selected_skills, profile_image_path
     FROM users WHERE id = ?`,
    [userId],
  );

  if (!rows[0]) throw new APIERR(404, "User not found");

  const user = rows[0];

  const cvSkills = (user.skills || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

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
        role: user.role,
        resume: user.resume,
        resume_upload_status: user.resume_upload_status,
        profile_image_path: user.profile_image_path,
        cvSkills,
        interviewSkills,
      },
      "User retrieved successfully",
    ),
  );
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new APIERR(400, "Email is required");

  const user = await User.findByEmail(email);
  if (!user) throw new APIERR(404, "User not found with this mail");

  const OTP = Math.floor(1000 + Math.random() * 9000);
  const OTP_EXPIRY_MINUTES = 2;
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await pool.execute(
    `UPDATE users SET reset_password_otp = ?, reset_password_otp_expires_at = ? WHERE id = ?`,
    [OTP, expiresAt, user.id],
  );

  const htmlTemplate = `<!DOCTYPE html>
<html>
  <head><meta charset="UTF-8" /><title>Reset Your Password</title>
    <style>
      body{margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif}
      .email-container{max-width:480px;margin:40px auto;background-color:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.08);overflow:hidden}
      .email-header{background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;padding:24px;text-align:center}
      .email-header h1{margin:0;font-size:22px}
      .email-body{padding:28px;color:#333;line-height:1.6}
      .email-body p{margin:0 0 16px;font-size:14px}
      .otp-box{margin:24px 0;padding:16px;background-color:#f1f5ff;border-radius:8px;text-align:center;font-size:26px;letter-spacing:6px;font-weight:700;color:#4f46e5}
      .warning{font-size:12px;color:#6b7280}
      .email-footer{padding:16px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb}
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-header"><h1>Password Reset Request</h1></div>
      <div class="email-body">
        <p>Hi <strong>${user.fullName}</strong>,</p>
        <p>We received a request to reset your password. Use the OTP below to continue:</p>
        <div class="otp-box">${OTP}</div>
        <p class="warning">This OTP is valid for <strong>${OTP_EXPIRY_MINUTES} minutes</strong>. Please do not share it with anyone.</p>
        <p>If you did not request a password reset, you can safely ignore this email.</p>
      </div>
      <div class="email-footer">&copy; 2026 QuantamHash Corporation. All rights reserved.</div>
    </div>
  </body>
</html>`;

  await sendMail(
    email,
    "Reset Your Password – OTP Verification",
    `Your password reset OTP is ${OTP}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
    htmlTemplate,
  );

  res.status(200).json(new APIRES(200, true, "Successfully sent the mail"));
});

const verifyResetPasswordOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) throw new APIERR(400, "Email and OTP are required");

  const [users] = await pool.execute(
    `SELECT id FROM users WHERE email = ? AND reset_password_otp = ? AND reset_password_otp_expires_at > NOW()`,
    [email, otp],
  );

  if (users.length === 0) throw new APIERR(400, "Invalid or expired OTP");

  await pool.execute(
    `UPDATE users SET reset_password_otp = NULL, reset_password_otp_expires_at = NULL WHERE id = ?`,
    [users[0].id],
  );

  res
    .status(200)
    .json(new APIRES(200, { verified: true }, "OTP verified successfully"));
});

const resetPassword = asyncHandler(async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;

  if (!email || !newPassword || !confirmPassword)
    throw new APIERR(400, "All fields are required");
  if (newPassword !== confirmPassword)
    throw new APIERR(400, "Passwords do not match");
  if (newPassword.length < 6)
    throw new APIERR(400, "Password must be at least 6 characters long");

  const user = await User.findByEmail(email);
  const hashedPassword = await bcrypt.hash(newPassword, 8);

  await pool.execute(
    "UPDATE users SET hashPassword = ?, updated_at = NOW() WHERE id = ?",
    [hashedPassword, user.id],
  );

  res.status(200).json(new APIRES(200, true, "Password reset successfully"));
});

const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId);
  if (!user) throw new APIERR(404, "User not found");

  const updateFields = [];
  const updateValues = [];
  let resumeUploadData = null;

  if (req.files?.resume) {
    const resume = req.files.resume[0];
    if (resume.mimetype !== "application/pdf") {
      await fs.unlink(resume.path).catch(() => {});
      throw new APIERR(400, "Only PDF files are allowed for resume");
    }
    if (resume.size > 5 * 1024 * 1024) {
      await fs.unlink(resume.path).catch(() => {});
      throw new APIERR(400, "Resume file size must be less than 5MB");
    }

    try {
      const fileBuffer = await fs.readFile(resume.path);
      const ftpUploadResult = await uploadFileToFTP(
        fileBuffer,
        resume.originalname,
        `/public/resumes/`,
      );

      if (user.resume) {
        const remotePath = user.resume.split("/interview2")[1];
        if (remotePath?.includes("/public/resumes/")) {
          await deleteFileFromFTP(remotePath).catch(() => {});
        }
      }

      await fs.unlink(resume.path).catch(() => {});

      resumeUploadData = {
        ftpUrl: ftpUploadResult.url,
        mimeType: resume.mimetype,
        originalFileName: resume.originalname,
        userId,
      };
      updateFields.push("resume = ?", "resume_upload_status = ?");
      updateValues.push(ftpUploadResult.url, "processing");
    } catch (error) {
      await fs.unlink(resume.path).catch(() => {});
      throw new APIERR(500, `Failed to upload resume: ${error.message}`);
    }
  }

  if (req.files?.profileImage) {
    const profileImage = req.files.profileImage[0];
    const allowedImageTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    if (!allowedImageTypes.includes(profileImage.mimetype)) {
      await fs.unlink(profileImage.path).catch(() => {});
      throw new APIERR(400, "Only JPEG, PNG, and WebP images are allowed");
    }
    if (profileImage.size > 2 * 1024 * 1024) {
      await fs.unlink(profileImage.path).catch(() => {});
      throw new APIERR(400, "Profile image size must be less than 2MB");
    }

    try {
      const fileBuffer = await fs.readFile(profileImage.path);
      const ftpUploadResult = await uploadFileToFTP(
        fileBuffer,
        profileImage.originalname,
        `/public/profile-images/${userId}`,
      );

      if (user.profile_image_path) {
        const remotePath = user.profile_image_path.split("/interview2")[1];
        if (remotePath) await deleteFileFromFTP(remotePath).catch(() => {});
      }

      await fs.unlink(profileImage.path).catch(() => {});
      updateFields.push("profile_image_path = ?");
      updateValues.push(ftpUploadResult.url);
    } catch (error) {
      await fs.unlink(profileImage.path).catch(() => {});
      throw new APIERR(500, `Failed to upload profile image: ${error.message}`);
    }
  }

  if (updateFields.length === 0) throw new APIERR(400, "No files to update");

  updateFields.push("updated_at = NOW()");
  updateValues.push(userId);

  await pool.execute(
    `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`,
    updateValues,
  );

  if (resumeUploadData) {
    processSkillExtraction(resumeUploadData).catch((error) =>
      console.error("❌ Background skill extraction failed:", error),
    );
  }

  const updatedUser = await User.findById(userId);
  delete updatedUser.hashPassword;
  delete updatedUser.refreshToken;

  res
    .status(200)
    .json(new APIRES(200, updatedUser, "Profile updated successfully"));
});

async function processSkillExtraction({
  ftpUrl,
  mimeType,
  originalFileName,
  userId,
}) {
  try {
    const detectedDomain = await detectResumeDomain({
      ftpUrl,
      mimeType,
      originalFileName,
    });
    const skillsData = await extractSkills({
      ftpUrl,
      mimeType,
      originalFileName,
      targetDomain: detectedDomain,
      matchThreshold: 6,
    });

    const normaliseSkill = (item) => {
      if (!item) return null;
      if (typeof item === "string") return item.trim() || null;
      if (typeof item === "object" && typeof item.skill === "string")
        return item.skill.trim() || null;
      return null;
    };

    const allSkills = [
      ...(skillsData.technical_skills || []),
      ...(skillsData.soft_skills || []),
      ...(skillsData.certifications || []),
      ...(skillsData.languages || []),
    ]
      .map(normaliseSkill)
      .filter(Boolean);

    const seen = new Set();
    const uniqueSkills = allSkills.filter((skill) => {
      const key = skill.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await User.updateSkills(userId, uniqueSkills.join(", "));
    await User.updateResumeStatus(userId, "completed");
  } catch (error) {
    console.error(`❌ Skill extraction failed for user ${userId}:`, error);
    await User.updateResumeStatus(userId, "failed").catch(() => {});
  }
}

module.exports = {
  generateRefreshAndAccessTokens,
  uploadResumeForRegistration,
  getExtractionStatus,
  completeRegistration,
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
