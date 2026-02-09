const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directories exist
const uploadDirs = {
  resumes: path.join(__dirname, "..", "public", "resumes"),
  profileImages: path.join(__dirname, "..", "public", "profile-images"),
};
console.log("Upload directories:", uploadDirs);
Object.values(uploadDirs).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "resume") {
      cb(null, uploadDirs.resumes);
    } else if (file.fieldname === "profileImage") {
      cb(null, uploadDirs.profileImages);
    } else {
      cb(new Error("Invalid field name"));
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, "_");

    // For registration, user.id won't exist yet, so just use timestamp
    const userId = req.user?.id || "new";
    cb(null, `${userId}-${uniqueSuffix}-${sanitizedName}${ext}`);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "resume") {
    // Only accept PDF files for resume
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed for resume"), false);
    }
  } else if (file.fieldname === "profileImage") {
    // Only accept images for profile
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"), false);
    }
  } else {
    cb(new Error("Invalid field name"), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

// Middleware to handle multiple file fields (for profile updates)
const uploadProfileFiles = upload.fields([
  { name: "resume", maxCount: 1 },
  { name: "profileImage", maxCount: 1 },
]);

module.exports = {
  uploadProfileFiles,
  upload,
};
