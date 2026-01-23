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

const generateRefreshAndAccessTokens = async (user) => {
  const refreshToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "15d",
    }
  );

  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "1d",
    }
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
    }
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

  if (
    [fullName, email, password].some((field) => !field || field.trim() === "")
  ) {
    throw new APIERR(400, "All fields are required");
  }

  if (password.length < 6) {
    throw new APIERR(400, "Password must be at least 6 characters");
  }

  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    throw new APIERR(409, "Email is already registered");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const userId = await User.create({
    fullName,
    email,
    hashPassword: passwordHash,
  });

  const { refreshToken, accessToken } = await generateRefreshAndAccessTokens({
    id: userId,
    email,
  });

  await User.updateRefreshToken(userId, refreshToken);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 15 * 24 * 60 * 60 * 1000, // 15day
  });

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000, //1day
  });

  res.status(201).json(
    new APIRES(
      201,
      {
        id: userId,
        fullName,
        email,
      },
      "User registered successfully"
    )
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
    isUserExist.hashPassword
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
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 15 * 24 * 60 * 60 * 1000, //15 day
  });

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000, //1 day
  });

  res.status(200).json(
    new APIRES(
      200,
      {
        id: isUserExist.id,
        email,
        fullName: isUserExist.fullName,
      },
      "Successfully logged in"
    )
  );
});

const logoutUser = asyncHandler(async (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
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
      [OTP, expiresAt, user.id]
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
    htmlTemplate
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
    [email, otp]
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
    [userId]
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
    [hashedPassword, userId]
  );

  res.status(200).json(new APIRES(200, true, "Password reset successfully"));
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
};
