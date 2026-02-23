const { Router } = require("express");
const {
  registerCompany,
  loginCompany,
  logoutCompany,
} = require("../Controllers/auth.admin.controllers.js");

const router = Router();

router
  .post("/register", registerCompany)
  .post("/login", loginCompany)
  .post("/logout", logoutCompany);

module.exports = router;
