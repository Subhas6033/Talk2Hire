const { Router } = require("express");
const {
  registerCompany,
  loginCompany,
} = require("../Controllers/auth.admin.controllers.js");

const router = Router();

router.post("/register", registerCompany).post("/login", loginCompany);

module.exports = router;
