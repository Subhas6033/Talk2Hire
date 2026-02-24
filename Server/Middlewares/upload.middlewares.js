const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");

const uploadDir = path.join(os.tmpdir(), "interview-uploads");

console.log("📁 Upload directory:", uploadDir);

// Ensure upload directory exists with better error handling
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(" Upload directory created:", uploadDir);
  } else {
    console.log(" Upload directory already exists:", uploadDir);
  }
} catch (error) {
  console.error("❌ Error creating upload directory:", error);
  console.error("⚠️ This might cause upload failures. Check permissions.");
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // All files go to the same temp directory
    // We'll delete them after uploading to FTP anyway
    console.log("📥 Setting destination for file:", file.fieldname);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, "_");

    // For registration, user.id won't exist yet, so just use timestamp
    const userId = req.user?.id || "new";
    const fileName = `${userId}-${uniqueSuffix}-${sanitizedName}${ext}`;

    console.log("📝 Generated filename:", fileName);
    cb(null, fileName);
  },
});

// File filter with better logging
const fileFilter = (req, file, cb) => {
  console.log("🔍 Validating file:", {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
  });

  if (file.fieldname === "resume") {
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword", // .doc
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      console.log("✅ Resume file accepted");
      cb(null, true);
    } else {
      console.log("❌ Resume file rejected - not PDF or Word file");
      cb(
        new Error(
          "Only PDF or Word files (.doc, .docx) are allowed for resume",
        ),
        false,
      );
    }
  } else if (file.fieldname === "profileImage") {
    // Only accept images for profile
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      console.log(" Profile image accepted");
      cb(null, true);
    } else {
      console.log("❌ Profile image rejected - invalid type");
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"), false);
    }
  } else {
    console.log("❌ Invalid field name:", file.fieldname);
    cb(new Error("Invalid field name"), false);
  }
};

// Configure multer with better error handling
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, //  Increased to 10MB to be safe
    files: 2, // Maximum 2 files at once
  },
});

// Add error handling wrapper for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("❌ Multer error:", err);

    // Handle specific multer errors
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 10MB",
        error: err.message,
      });
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files uploaded",
        error: err.message,
      });
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected field in form data",
        error: err.message,
      });
    }

    return res.status(400).json({
      success: false,
      message: "File upload error",
      error: err.message,
    });
  }

  if (err) {
    console.error("❌ Upload error:", err);
    return res.status(400).json({
      success: false,
      message: err.message || "File upload failed",
    });
  }

  next();
};

// Middleware to handle multiple file fields (for profile updates)
const uploadProfileFiles = upload.fields([
  { name: "resume", maxCount: 1 },
  { name: "profileImage", maxCount: 1 },
]);

// Wrapper with error handling
const uploadProfileFilesWithErrorHandling = (req, res, next) => {
  uploadProfileFiles(req, res, (err) => {
    handleMulterError(err, req, res, next);
  });
};

// Single file upload wrapper with error handling
const uploadSingleWithErrorHandling = (fieldName) => {
  return (req, res, next) => {
    const uploadSingle = upload.single(fieldName);
    uploadSingle(req, res, (err) => {
      handleMulterError(err, req, res, next);
    });
  };
};

module.exports = {
  upload,
  uploadProfileFiles: uploadProfileFilesWithErrorHandling,
  uploadSingle: uploadSingleWithErrorHandling,
  handleMulterError,
};
