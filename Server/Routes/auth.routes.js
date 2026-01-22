const router = require("express").Router();
const {
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
} = require("../Controllers/auth.controllers.js");
const authMiddleware = require("../Middlewares/auth.middlewares.js");

router
  .post("/register", registerUser)
  .post("/login", loginUser)
  .post("/logout", authMiddleware, loginUser)
  .post("/forgot-password", forgotPassword);

module.exports = router;
