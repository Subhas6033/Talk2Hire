const router = require("express").Router();
const {
  uploadResumeForRegistration,
  getExtractionStatus,
  sendRegistrationOtp,
  verifyRegistrationOtp,
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
} = require("../Controllers/auth.controllers.js");
const { authMiddleware } = require("../Middlewares/auth.middlewares.js");
const {
  uploadSingle,
  uploadProfileFiles,
} = require("../Middlewares/upload.middlewares.js");

const uploadResume = uploadSingle("resume");

router
  // ── Registration flow ──────────────────────────────────────
  .post("/upload-resume", uploadResume, uploadResumeForRegistration)
  .get("/extraction-status/:sessionId", getExtractionStatus)
  .post("/send-registration-otp", sendRegistrationOtp)
  .post("/verify-registration-otp", verifyRegistrationOtp)
  .post("/complete-registration", completeRegistration)

  // ── Auth ───────────────────────────────────────────────────
  .post("/login", loginUser)
  .post("/logout", authMiddleware, logoutUser)
  .post("/refresh-access-token", refreshAccessToken)

  // ── Password reset ─────────────────────────────────────────
  .post("/forgot-password", forgotPassword)
  .post("/verify-password", verifyResetPasswordOtp)
  .put("/update-password", resetPassword)

  // ── Protected ──────────────────────────────────────────────
  .get("/get-current-user", authMiddleware, getCurrentUser)
  .get("/cv-skills", authMiddleware, getCVSkills)
  .get("/resume-status", authMiddleware, checkResumeStatus)
  .patch("/update-profile", authMiddleware, uploadProfileFiles, updateProfile);

module.exports = router;
