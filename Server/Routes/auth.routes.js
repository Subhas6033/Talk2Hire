const router = require("express").Router();
const {
  uploadResumeForRegistration, // ✅ NEW - Step 1: Upload resume
  getExtractionStatus, // ✅ NEW - Polling endpoint
  completeRegistration, // ✅ NEW - Step 2: Create account
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
} = require("../Controllers/auth.controllers.js");
const authMiddleware = require("../Middlewares/auth.middlewares.js");
const {
  uploadSingle,
  uploadProfileFiles,
} = require("../Middlewares/upload.middlewares.js");

const uploadResume = uploadSingle("resume");

router
  // ==================== PUBLIC ROUTES ====================

  // ✅ NEW STEP 1: Upload resume and start extraction (NO account creation)
  .post("/upload-resume", uploadResume, uploadResumeForRegistration)

  // ✅ NEW: Get extraction status (for polling)
  .get("/extraction-status/:sessionId", getExtractionStatus)

  // ✅ NEW STEP 2: Complete registration with reviewed data
  .post("/complete-registration", completeRegistration)

  // Login user
  .post("/login", loginUser)

  // Forgot password - send OTP
  .post("/forgot-password", forgotPassword)

  // Verify OTP for password reset
  .post("/verify-password", verifyResetPasswordOtp)

  // Reset password after OTP verification
  .put("/update-password", resetPassword)

  // ==================== PROTECTED ROUTES ====================

  // Get current user info
  .get("/get-current-user", authMiddleware, getCurrentUser)

  // Get user's CV skills
  .get("/cv-skills", authMiddleware, getCVSkills)

  // Check resume processing status
  .get("/resume-status", authMiddleware, checkResumeStatus)

  // Refresh access token
  .post("/refresh-access-token", refreshAccessToken)

  // Logout user
  .post("/logout", authMiddleware, logoutUser)

  // Update user profile
  .patch("/update-profile", authMiddleware, uploadProfileFiles, updateProfile);

module.exports = router;
