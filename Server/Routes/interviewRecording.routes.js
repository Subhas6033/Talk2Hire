const express = require("express");
const multer = require("multer");
const {
  startRecording,
  uploadChunk,
  endRecording,
  getRecordingStatus,
  getRecordingUrls,
  getAnalysisResult,
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
router.post("/:interviewId/end-recording", endRecording);
router.get("/:interviewId/recording-status", getRecordingStatus);
router.get("/:interviewId/urls", getRecordingUrls);
router.get("/:interviewId/analysis", getAnalysisResult);

module.exports = router;
