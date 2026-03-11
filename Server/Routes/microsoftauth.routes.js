const { Router } = require("express");
const { companyAuthMiddleware } = require("../Middlewares/auth.middlewares.js");
const {
  microsoftLogin,
  microsoftCallback,
} = require("../Controllers/microsoft.auth.controllers.js");
const {
  userMicrosoftLogin,
  userMicrosoftCallback,
} = require("../Controllers/microsoftAuth.controllers.js");

const router = Router();

// Company Microsoft OAuth
router
  .get("/microsoft", microsoftLogin)
  .get("/microsoft/callback", microsoftCallback);

// User Microsoft OAuth
router
  .get("/user/microsoft", userMicrosoftLogin)
  .get("/user/microsoft/callback", userMicrosoftCallback);

module.exports = router;
