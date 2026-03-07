const router = require("express").Router();
const {
  uploadResumeForRegistration, //  NEW - Step 1: Upload resume
  getExtractionStatus, //  NEW - Polling endpoint
  completeRegistration, //  NEW - Step 2: Create account
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
  .post("/upload-resume", uploadResume, uploadResumeForRegistration)
  .get("/extraction-status/:sessionId", getExtractionStatus)
  .post("/complete-registration", completeRegistration)
  .post("/login", loginUser)
  .post("/forgot-password", forgotPassword)
  .post("/verify-password", verifyResetPasswordOtp)
  .put("/update-password", resetPassword)
  .get("/get-current-user", authMiddleware, getCurrentUser)
  .get("/cv-skills", authMiddleware, getCVSkills)
  .get("/resume-status", authMiddleware, checkResumeStatus)
  .post("/refresh-access-token", refreshAccessToken)
  .post("/logout", authMiddleware, logoutUser)
  .patch("/update-profile", authMiddleware, uploadProfileFiles, updateProfile);

module.exports = router;
