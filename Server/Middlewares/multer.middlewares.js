const multer = require("multer");
const { Router } = require("express");
const uploadFile = require("../Controllers/uploadFile.controllers.js");
const authMiddleware = require("./auth.middlewares.js");

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

router.post("/upload", upload.single("file"), authMiddleware, uploadFile);

module.exports = router;
