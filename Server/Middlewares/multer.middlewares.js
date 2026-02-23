const { Router } = require("express");
const multer = require("multer");
const {
  generateQuestions,
} = require("../Controllers/generateQuestions.controller");
const { authMiddleware } = require("./auth.middlewares");

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/generate-questions",
  authMiddleware,
  upload.single("file"),
  generateQuestions,
);

module.exports = router;
