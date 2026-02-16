const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./Routes/auth.routes.js");
const questionRoutes = require("./Middlewares/multer.middlewares.js");
// const speechRoutes = require("./Middlewares/multer.middlewares.js");
const resultRouter = require("./Routes/result.routes.js");
const videoUploadRoutes = require("./Routes/videoUpload.routes.js");
const VideoProcessingJobs = require("./Jobs/videoProcessing.jobs.js");
const hiringRoutes = require("./Routes/hiring.routes.js");

dotenv.config();

const app = express();

const allowedOrigins = [process.env.CORS_ORIGIN];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

/* app.options("/api/v1/auth/register", cors());
app.options("/api/v1/auth/update-profile", cors()); */

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

// Request timeout middleware - Add BEFORE routes
app.use((req, res, next) => {
  // Set timeout for all requests (2 minutes)
  req.setTimeout(120000);
  res.setTimeout(120000);

  // Handle timeout event
  req.on("timeout", () => {
    console.error("⏱️ Request timeout");
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        message: "Request timeout. Please try again.",
      });
    }
  });

  next();
});

// Request tracking middleware - UPDATED
app.use((req, res, next) => {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  req.requestId = requestId;

  console.log(
    `📥 [${requestId}] ${new Date().toISOString()} - ${req.method} ${req.path}`,
  );

  // Track response completion
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    console.log(
      ` [${requestId}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`,
    );
  });

  // Detect hanging requests (warning after 30s)
  const hangTimeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error(
        `⚠️ [${requestId}] Request hanging: ${req.method} ${req.path} (>30s)`,
      );
    }
  }, 30000);

  res.on("finish", () => clearTimeout(hangTimeout));
  res.on("close", () => clearTimeout(hangTimeout));

  next();
});

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/questions", questionRoutes);
app.use("/api/v1/result", resultRouter);
app.use("/api/v1/interview", videoUploadRoutes);
app.use("/api/v1/hiring", hiringRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

VideoProcessingJobs.startScheduledJobs();
/*
// Background jobs for video processing
const {
  retryFailedUploads,
  cleanupOldChunks,
} = require("./Service/videoUpload.service.js");

// Retry failed uploads every hour
if (process.env.ENABLE_VIDEO_RETRY === "true") {
  console.log(" Video retry service enabled (runs every hour)");

  setInterval(
    async () => {
      try {
        console.log("🔄 Running scheduled retry for failed video uploads...");
        const result = await retryFailedUploads();
        console.log(" Retry complete:", result);
      } catch (error) {
        console.error("❌ Scheduled retry failed:", error);
      }
    },
    60 * 60 * 1000,
  ); // Every hour
}

// Cleanup old chunks every day
if (process.env.ENABLE_CHUNK_CLEANUP === "true") {
  console.log(" Chunk cleanup service enabled (runs every 24 hours)");

  setInterval(
    async () => {
      try {
        console.log("🧹 Running scheduled cleanup for old video chunks...");
        const result = await cleanupOldChunks(7); // Delete chunks older than 7 days
        console.log(" Cleanup complete:", result);
      } catch (error) {
        console.error("❌ Scheduled cleanup failed:", error);
      }
    },
    24 * 60 * 60 * 1000,
  ); // Every 24 hours
}
*/

// 404 Handler - Must be AFTER all routes but BEFORE error handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler - UPDATED
app.use((err, req, res, next) => {
  const requestId = req.requestId || "unknown";
  console.error(`❌ [${requestId}] Unhandled error:`, err);

  // Prevent sending response if headers already sent
  if (res.headersSent) {
    console.error(
      `⚠️ [${requestId}] Headers already sent, delegating to default error handler`,
    );
    return next(err);
  }

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

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "CORS policy: Origin not allowed",
      error: err.message,
    });
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      error: err.message,
    });
  }

  // Generic error response
  const statusCode = err.status || err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
      requestId: requestId,
    }),
  });
});

// Graceful shutdown handlers
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
  // Log but don't exit in production - this keeps server running
  if (process.env.NODE_ENV !== "production") {
    console.error("Exiting due to uncaught exception (development mode)");
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
  // Just log - don't exit
});

// Handle SIGTERM for graceful shutdown
process.on("SIGTERM", () => {
  console.log("👋 SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

module.exports = app;
