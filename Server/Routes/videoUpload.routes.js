const express = require("express");
const multer = require("multer");
const {
  uploadVideoChunkController,
  uploadVideoFinalController,
  finalizeChunkedVideoController,
  getInterviewVideosController,
  getVideoStatsController,
  getDetailedStatsController,
  manualUploadVideosController,
  mergeCameraAnglesController,
  verifyVideoIntegrityController,
  deleteVideoController,
} = require("../Controllers/uploadVideo.controllers.js");
const { authMiddleware } = require("../Middlewares/auth.middlewares.js");

const router = express.Router();
router.use(authMiddleware);

// Configure multer for video uploads
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 100MB limit per chunk
  },
  fileFilter: (req, file, cb) => {
    // Accept video files
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"), false);
    }
  },
});

// Upload routes
router
  .post(
    "/upload-video-chunk",
    videoUpload.single("video"),
    uploadVideoChunkController,
  )

  .post(
    "/upload-video-final",
    videoUpload.single("video"),
    uploadVideoFinalController,
  )

  // Finalize chunked video (merge chunks)
  .post("/:interviewId/finalize-video/:videoId", finalizeChunkedVideoController)

  // Get videos and stats
  .get("/:interviewId/videos", getInterviewVideosController)

  .get("/:interviewId/video-stats", getVideoStatsController)

  .get("/:interviewId/video-stats-detailed", getDetailedStatsController)

  // Manual upload trigger
  .post("/:interviewId/upload-videos", manualUploadVideosController)

  // Multi-camera operations
  .post("/:interviewId/merge-cameras", mergeCameraAnglesController)

  // Video verification and management
  .post("/video/:videoId/verify", verifyVideoIntegrityController)

  .delete("/video/:videoId", deleteVideoController);

module.exports = router;
