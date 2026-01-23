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
} = require("../Controllers/auth.controllers.js");
const authMiddleware = require("../Middlewares/auth.middlewares.js");

router
  .post("/register", registerUser)
  .post("/login", loginUser)
  .post("/logout", authMiddleware, logoutUser)
  .post("/forgot-password", forgotPassword)
  .post("/verify-password", verifyResetPasswordOtp)
  .put("/update-password", resetPassword)
  .get("/get-current-user", authMiddleware, getCurrentUser)
  .post("/refresh-access-token", refreshAccessToken);

module.exports = router;
