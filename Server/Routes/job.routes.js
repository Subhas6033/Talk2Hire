const express = require("express");
const router = express.Router();
const {
  createJob,
  getAllJobs,
  getCompanyJobById,
  getJobCounts,
  updateJob,
  toggleJobStatus,
  incrementApplicants,
  deleteJob,
  getPublicJobs,
  getJobById,
  getJob,
  searchJobs,
  saveJob,
  unsaveJob,
  getSavedJobs,
  checkSavedJob,
} = require("../Controllers/job.controllers.js");
const {
  companyAuthMiddleware,
  authMiddleware,
} = require("../Middlewares/auth.middlewares.js");

// ─── Public (no auth) ─────────────────────────────────────────
router.get("/search", searchJobs);
router.get("/public-jobs", getPublicJobs);
router.get("/public/:id", getJobById); // returns companyName + companyLogo via JOIN

// ─── Saved jobs (user auth) ───────────────────────────────────
router.get("/saved-jobs", authMiddleware, getSavedJobs);
router.get("/saved-jobs/check/:jobId", authMiddleware, checkSavedJob);
router.post("/saved-jobs/:jobId", authMiddleware, saveJob);
router.delete("/saved-jobs/:jobId", authMiddleware, unsaveJob);

// ─── Company admin (company auth) ────────────────────────────
router.get("/counts", authMiddleware, companyAuthMiddleware, getJobCounts);
router.post("/", authMiddleware, companyAuthMiddleware, createJob);
router.get("/", authMiddleware, companyAuthMiddleware, getAllJobs);
router.put("/:id", authMiddleware, companyAuthMiddleware, updateJob);
router.delete("/:id", authMiddleware, companyAuthMiddleware, deleteJob);
router.patch(
  "/:id/toggle-status",
  authMiddleware,
  companyAuthMiddleware,
  toggleJobStatus,
);
router.patch(
  "/:id/applicants",
  authMiddleware,
  companyAuthMiddleware,
  incrementApplicants,
);
router.get("/:id", authMiddleware, companyAuthMiddleware, getCompanyJobById);

module.exports = router;
