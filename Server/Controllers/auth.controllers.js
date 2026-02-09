const {
  asyncHandler,
  APIERR,
  APIRES,
  sendMail,
} = require("../Utils/index.utils.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../Models/user.models.js");
const { connectDB } = require("../Config/database.config.js");
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
  const { fullName, email, password } = req.body;
  const resumeFile = req.file;

  console.log("✅ Registration started");
  console.log("Registration data:", { fullName, email });
  console.log("Resume file:", resumeFile);

  // Validate required fields
  if (
    [fullName, email, password].some((field) => !field || field.trim() === "")
  ) {
    console.log("❌ Validation failed: Missing fields");
    throw new APIERR(400, "All fields are required");
  }

  if (password.length < 6) {
    console.log("❌ Validation failed: Password too short");
    throw new APIERR(400, "Password must be at least 6 characters");
  }

  // Validate resume file
  if (!resumeFile) {
    console.log("❌ Validation failed: No resume file");
    throw new APIERR(400, "Resume is required");
  }

  console.log("✅ All validations passed");
  console.log("🔍 Checking if user exists...");

  // Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    console.log("❌ User already exists");
    if (resumeFile) {
      try {
        await fs.unlink(resumeFile.path);
      } catch (err) {
        console.log("Error deleting file:", err);
      }
    }
    throw new APIERR(409, "Email is already registered");
  }

  console.log("✅ User doesn't exist, proceeding with registration");

  // Hash password
  console.log("🔐 Hashing password...");
  const passwordHash = await bcrypt.hash(password, 10);

  // ✅ Create user IMMEDIATELY with placeholder URL and 'uploading' status
  console.log("💾 Creating user in database...");
  const db = await connectDB();

  // ✅ Store a placeholder URL that indicates upload is in progress
  const placeholderUrl = `${process.env.FTP_BASE_URL}/uploading/${resumeFile.originalname}`;

  const [result] = await db.execute(
    `INSERT INTO users (fullName, email, hashPassword, resume, resume_upload_status) 
     VALUES (?, ?, ?, ?, ?)`,
    [
      fullName,
      email,
      passwordHash,
      placeholderUrl, // ✅ Store placeholder URL, not local path
      "uploading", // Track upload status
    ],
  );

  const userId = result.insertId;
  console.log("✅ User created with ID:", userId);

  // Generate tokens
  console.log("🎟️ Generating tokens...");
  const { refreshToken, accessToken } = await generateRefreshAndAccessTokens({
    id: userId,
    email,
  });

  await User.updateRefreshToken(userId, refreshToken);
  console.log("✅ Tokens generated and saved");

  // Set cookies
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

  // ✅ RESPOND IMMEDIATELY - User is registered!
  console.log("✅ Registration complete, sending response");
  res.status(201).json(
    new APIRES(
      201,
      {
        id: userId,
        fullName,
        email,
        resumeUploading: true,
        resumeStatus: "uploading",
        message: "Resume is being uploaded in the background",
      },
      "User registered successfully",
    ),
  );

  // ✅ Upload to FTP in BACKGROUND (after response sent)
  // Store file path and user ID in closure
  const localFilePath = resumeFile.path;
  const originalFileName = resumeFile.originalname;

  setImmediate(async () => {
    try {
      console.log(`📤 [Background] Starting FTP upload for user ${userId}...`);

      // Read file buffer
      const fileBuffer = await fs.readFile(localFilePath);
      console.log(
        `✅ [Background] File read successfully for user ${userId}, size: ${fileBuffer.length} bytes`,
      );

      // Upload to FTP
      const ftpUploadResult = await uploadFileToFTP(
        fileBuffer,
        originalFileName,
        "/public/resumes",
      );

      console.log(
        `✅ [Background] FTP upload successful for user ${userId}:`,
        ftpUploadResult.url,
      );

      // ✅ Update database with ACTUAL FTP URL
      await db.execute(
        `UPDATE users 
         SET resume = ?, resume_upload_status = ?, updated_at = NOW() 
         WHERE id = ?`,
        [ftpUploadResult.url, "completed", userId], // ✅ Store actual FTP URL
      );

      console.log(
        `✅ [Background] Database updated with actual FTP URL for user ${userId}`,
      );

      // Delete local file
      try {
        await fs.unlink(localFilePath);
        console.log(`🗑️ [Background] Local file deleted for user ${userId}`);
      } catch (err) {
        console.log(
          `⚠️ [Background] Error deleting local file for user ${userId}:`,
          err,
        );
      }

      console.log(
        `✅ [Background] Complete upload process finished for user ${userId}`,
      );
    } catch (error) {
      console.error(
        `❌ [Background] FTP upload failed for user ${userId}:`,
        error,
      );
      console.error(`Error details:`, error.message, error.stack);

      // ✅ Update status to failed but keep the placeholder URL
      try {
        await db.execute(
          `UPDATE users 
           SET resume_upload_status = ?, updated_at = NOW() 
           WHERE id = ?`,
          ["failed", userId],
        );

        console.log(
          `⚠️ [Background] Marked upload as failed for user ${userId}`,
        );
      } catch (dbError) {
        console.error(
          `❌ [Background] Failed to update status for user ${userId}:`,
          dbError,
        );
      }

      // Clean up local file even on error
      try {
        await fs.unlink(localFilePath);
        console.log(
          `🗑️ [Background] Local file deleted after error for user ${userId}`,
        );
      } catch (unlinkError) {
        console.log(
          `⚠️ [Background] Error deleting local file after error:`,
          unlinkError,
        );
      }
    }
  });
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
  const { email, password } = req.body;
  if ([email, password].some((fields) => !fields || fields.trim() === "")) {
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
  const user = await User.findById(req.user.id);

  if (!user) {
    throw new APIERR(404, "User not found");
  }

  // Delete the sensitive data from the response
  delete user.hashPassword;
  delete user.refreshToken;

  res.status(200).json(new APIRES(200, user, "User fetched"));
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
  const db = await connectDB();
  try {
    await db.execute(
      `
    UPDATE users
    SET reset_password_otp = ?,
        reset_password_otp_expires_at = ?
    WHERE id = ?
    `,
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
  const db = await connectDB();
  const [users] = await db.execute(
    `SELECT id FROM users 
     WHERE email = ? AND reset_password_otp = ? AND reset_password_otp_expires_at > NOW()`,
    [email, otp],
  );

  if (users.length === 0) {
    throw new APIERR(400, "Invalid or expired OTP");
  }

  const userId = users[0].id;

  await db.execute(
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

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
  const db = await connectDB();
  await db.execute(
    "UPDATE users SET hashPassword = ?, updated_at = NOW() WHERE id = ?",
    [hashedPassword, userId],
  );

  res.status(200).json(new APIRES(200, true, "Password reset successfully"));
});

const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get current user data
  const user = await User.findById(userId);
  if (!user) {
    throw new APIERR(404, "User not found");
  }

  const db = await connectDB();
  const updateFields = [];
  const updateValues = [];

  // Handle resume upload
  if (req.files?.resume) {
    const resume = req.files.resume[0];

    // Validate file type
    if (resume.mimetype !== "application/pdf") {
      try {
        await fs.unlink(resume.path);
      } catch (err) {
        console.log("Error deleting file:", err);
      }
      throw new APIERR(400, "Only PDF files are allowed for resume");
    }

    // Validate file size (5MB)
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
      // ✅ Read file buffer
      const fileBuffer = await fs.readFile(resume.path);

      // ✅ Upload to FTP
      console.log("📤 Uploading resume to FTP...");
      ftpUploadResult = await uploadFileToFTP(
        fileBuffer,
        resume.originalname,
        `/public/resumes/${userId}`, // User-specific directory
      );

      console.log("✅ Resume uploaded to FTP:", ftpUploadResult.url);

      // ✅ Delete old resume from FTP if exists
      if (user.resume) {
        try {
          // Extract remote path from old URL
          const oldUrl = user.resume;
          const remotePath = oldUrl.split("/interview2")[1];
          if (remotePath) {
            console.log("🗑️ Deleting old resume from FTP:", remotePath);
            await deleteFileFromFTP(remotePath);
          }
        } catch (err) {
          console.log("Error deleting old resume from FTP:", err);
        }
      }

      // ✅ Delete local file after successful FTP upload
      try {
        await fs.unlink(resume.path);
        console.log("🗑️ Local file deleted");
      } catch (err) {
        console.log("Error deleting local file:", err);
      }
    } catch (error) {
      // Clean up local file if FTP upload fails
      try {
        await fs.unlink(resume.path);
      } catch (err) {
        console.log("Error deleting local file:", err);
      }
      throw new APIERR(500, `Failed to upload resume: ${error.message}`);
    }

    updateFields.push("resume = ?");
    updateValues.push(ftpUploadResult.url);
  }

  // Handle profile image upload
  if (req.files?.profileImage) {
    const profileImage = req.files.profileImage[0];

    // Validate file type
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

    // Validate file size (2MB)
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
      // ✅ Read file buffer
      const fileBuffer = await fs.readFile(profileImage.path);

      // ✅ Upload to FTP
      console.log("📤 Uploading profile image to FTP...");
      ftpUploadResult = await uploadFileToFTP(
        fileBuffer,
        profileImage.originalname,
        `/public/profile-images/${userId}`, // User-specific directory
      );

      console.log("✅ Profile image uploaded to FTP:", ftpUploadResult.url);

      // ✅ Delete old profile image from FTP if exists
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

      // ✅ Delete local file
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

  // If no files to update
  if (updateFields.length === 0) {
    throw new APIERR(400, "No files to update");
  }

  // Update database
  updateFields.push("updated_at = NOW()");
  updateValues.push(userId);

  const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;

  try {
    await db.execute(query, updateValues);
  } catch (error) {
    console.error("Error updating profile:", error);
    throw new APIERR(500, "Failed to update profile");
  }

  // Fetch updated user data
  const updatedUser = await User.findById(userId);
  delete updatedUser.hashPassword;
  delete updatedUser.refreshToken;

  res
    .status(200)
    .json(new APIRES(200, updatedUser, "Profile updated successfully"));
});

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
};
