const express = require("express");
const multer = require("multer");
const {
  startRecording,
  uploadChunk,
  endInterview,
  getRecordingStatus,
} = require("../Controllers/interviewRecording.controllers.js");
const { authMiddleware } = require("../Middlewares/auth.middlewares.js");

const router = express.Router();
router.use(authMiddleware);

const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

router.post("/start-recording", startRecording);
router.post("/:interviewId/chunk", chunkUpload.single("chunk"), uploadChunk);
router.post("/:interviewId/end-recording", endInterview);
router.get("/:interviewId/recording-status", getRecordingStatus);

module.exports = router;
