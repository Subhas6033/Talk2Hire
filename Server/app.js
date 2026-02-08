const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./Routes/auth.routes.js");
const questionRoutes = require("./Middlewares/multer.middlewares.js");
const speechRoutes = require("./Middlewares/multer.middlewares.js");
const resultRouter = require("./Routes/result.routes.js");
const videoUploadRoutes = require("./Routes/videoUpload.routes.js");
const VideoProcessingJobs = require("./Jobs/videoProcessing.jobs.js");
const hiringRoutes = require("./Routes/hiring.routes.js");

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: "100mb",
  }),
);

app.use(
  express.urlencoded({
    limit: "100mb",
    extended: true,
  }),
);

app.use(cookieParser());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/questions", questionRoutes);
app.use("/api/v1/speech", speechRoutes);
app.use("/api/v1/result", resultRouter);
app.use("/api/v1/interview", videoUploadRoutes);
app.use("/api/v1/hiring", hiringRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

VideoProcessingJobs.startScheduledJobs();

// Background jobs for video processing
const {
  retryFailedUploads,
  cleanupOldChunks,
} = require("./Service/videoUpload.service.js");

// Retry failed uploads every hour
if (process.env.ENABLE_VIDEO_RETRY === "true") {
  console.log("✅ Video retry service enabled (runs every hour)");

  setInterval(
    async () => {
      try {
        console.log("🔄 Running scheduled retry for failed video uploads...");
        const result = await retryFailedUploads();
        console.log("✅ Retry complete:", result);
      } catch (error) {
        console.error("❌ Scheduled retry failed:", error);
      }
    },
    60 * 60 * 1000,
  ); // Every hour
}

// Cleanup old chunks every day
if (process.env.ENABLE_CHUNK_CLEANUP === "true") {
  console.log("✅ Chunk cleanup service enabled (runs every 24 hours)");

  setInterval(
    async () => {
      try {
        console.log("🧹 Running scheduled cleanup for old video chunks...");
        const result = await cleanupOldChunks(7); // Delete chunks older than 7 days
        console.log("✅ Cleanup complete:", result);
      } catch (error) {
        console.error("❌ Scheduled cleanup failed:", error);
      }
    },
    24 * 60 * 60 * 1000,
  ); // Every 24 hours
}

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);

  // Handle specific error types
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "File too large. Maximum size is 100MB.",
      error: err.message,
    });
  }

  if (err.code === "ETIMEDOUT" || err.code === "ESOCKETTIMEDOUT") {
    return res.status(408).json({
      success: false,
      message: "Request timeout. Please try again.",
      error: err.message,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? err : undefined,
  });
});

module.exports = app;
