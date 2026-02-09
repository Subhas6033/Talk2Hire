const router = require("express").Router();
const {
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
} = require("../Controllers/auth.controllers.js");
const authMiddleware = require("../Middlewares/auth.middlewares.js");
const {
  upload,
  uploadProfileFiles,
} = require("../Middlewares/upload.middlewares.js");

const uploadResume = upload.single("resume");

router
  .post("/register", uploadResume, registerUser)
  .post("/login", loginUser)
  .post("/logout", authMiddleware, logoutUser)
  .post("/forgot-password", forgotPassword)
  .post("/verify-password", verifyResetPasswordOtp)
  .put("/update-password", resetPassword)
  .get("/get-current-user", authMiddleware, getCurrentUser)
  .post("/refresh-access-token", refreshAccessToken)
  .get("/resume-status", authMiddleware, checkResumeStatus)
  .patch("/update-profile", authMiddleware, uploadProfileFiles, updateProfile);

module.exports = router;
