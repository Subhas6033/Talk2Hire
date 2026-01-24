const multer = require("multer");
const { Router } = require("express");
const authMiddleware = require("./auth.middlewares.js");
const {
  uploadAndProcessFile,
} = require("../Controllers/aiResponse.controllers.js");

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

router.post(
  "/file-process",
  authMiddleware,
  upload.single("file"),
  uploadAndProcessFile
);

module.exports = router;
