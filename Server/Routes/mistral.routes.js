const { Router } = require("express");
const {
  readFileFromUrlWithMistral,
} = require("../Controllers/mistral.controllers.js");
const authMiddleware = require("../Middlewares/auth.middlewares.js");

const router = Router();

router.post("/read-file", authMiddleware, readFileFromUrlWithMistral);

module.exports = router;
