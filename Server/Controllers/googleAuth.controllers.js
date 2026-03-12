const {
  asyncHandler,
  APIERR,
  APIRES,
  sendMail,
  buildUserWelcomeEmail,
} = require("../Utils/index.utils.js");
const { OAuth2Client } = require("google-auth-library");
const { generateRefreshAndAccessTokens } = require("./auth.controllers.js");
const User = require("../Models/user.models.js");
const { pool } = require("../Config/database.config.js");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
};

// ─── Verify the ID token Google sends after login ────────────────────────────
async function verifyGoogleToken(token) {
  const ticket = await googleClient.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

// ─── POST /api/v1/auth/google ────────────────────────────────────────────────

const googleAuth = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) throw new APIERR(400, "Google token is required");

  let payload;
  try {
    payload = await verifyGoogleToken(token);
  } catch {
    throw new APIERR(401, "Invalid or expired Google token");
  }

  const {
    email,
    name: fullName,
    picture: profileImage,
    sub: googleId,
  } = payload;

  if (!email)
    throw new APIERR(400, "Could not retrieve email from Google account");

  const ROLE = "user";
  let userId;
  let isNewUser = false;

  const existingUser = await User.findByEmail(email);

  if (existingUser) {
    // Returning user — update google_id if not already set (e.g. they registered via resume before)
    if (!existingUser.google_id) {
      await pool.execute(
        `UPDATE users SET google_id = ?, updated_at = NOW() WHERE id = ?`,
        [googleId, existingUser.id],
      );
    }
    userId = existingUser.id;
  } else {
    // Brand new user via Google — create account without password
    const [result] = await pool.execute(
      `INSERT INTO users (email, fullName, google_id, profile_image_path, role, resume_upload_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        email,
        fullName || null,
        googleId,
        profileImage || null,
        ROLE,
        "pending",
      ],
    );
    userId = result.insertId;
    isNewUser = true;
  }

  const { refreshToken, accessToken } = await generateRefreshAndAccessTokens({
    id: userId,
    email,
    role: ROLE,
  });
  await User.updateRefreshToken(userId, refreshToken);

  if (isNewUser) {
    sendMail(
      email,
      "🎉 Welcome to Talk2Hire — You're In!",
      `Hi ${fullName}, welcome to Talk2Hire! Head to your dashboard to start exploring matched jobs.`,
      buildUserWelcomeEmail(fullName),
    ).catch((e) => console.warn("⚠️ Welcome email failed:", e.message));
  }

  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 15 * 24 * 60 * 60 * 1000,
  });
  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.status(isNewUser ? 201 : 200).json(
    new APIRES(
      isNewUser ? 201 : 200,
      {
        id: userId,
        email,
        fullName: fullName || null,
        role: ROLE,
        isNewUser,
        // frontend uses isNewUser to decide whether to show resume upload onboarding
      },
      isNewUser
        ? "Google account registered successfully"
        : "Logged in with Google",
    ),
  );
});

module.exports = { googleAuth };
