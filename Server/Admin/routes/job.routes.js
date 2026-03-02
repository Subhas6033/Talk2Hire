const express = require("express");
const router = express.Router();
const {
  createJob,
  getAllJobs,
  getJobById,
  getJobCounts,
  updateJob,
  toggleJobStatus,
  incrementApplicants,
  deleteJob,
  getPublicJobs,
  getPublicJobById,
  searchJobs,
  getJob,
} = require("../Controllers/job.controllers.js");
const {
  companyAuthMiddleware,
  authMiddleware,
} = require("../../Middlewares/auth.middlewares.js");

router.get("/search", searchJobs);
router.get("/public-jobs", getPublicJobs);
router.get("/public/:id", getPublicJobById);

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

router.get("/:id", authMiddleware, companyAuthMiddleware, getJobById);

module.exports = router;
