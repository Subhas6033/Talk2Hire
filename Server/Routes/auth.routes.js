const router = require("express").Router();
const {
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  getCurrentUser,
  refreshAccessToken,
} = require("../Controllers/auth.controllers.js");
const authMiddleware = require("../Middlewares/auth.middlewares.js");

router
  .post("/register", registerUser)
  .post("/login", loginUser)
  .post("/logout", authMiddleware, logoutUser)
  .post("/forgot-password", forgotPassword)
  .get("/get-current-user", authMiddleware, getCurrentUser)
  .post("/refresh-access-token", refreshAccessToken);

module.exports = router;
