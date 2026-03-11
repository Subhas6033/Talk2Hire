const express = require("express");
const {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
} = require("../Controllers/auth.admin.controllers.js");
const {
  adminAuthMiddleware,
  requireRole,
} = require("../../Middlewares/auth.middlewares.js");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshToken);

router.post("/logout", adminAuthMiddleware, logout);
router.get("/profile", adminAuthMiddleware, getProfile);

module.exports = router;
