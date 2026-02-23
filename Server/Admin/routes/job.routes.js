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
} = require("../Controllers/job.controllers.js");
const {
  companyAuthMiddleware,
  authMiddleware,
} = require("../../Middlewares/auth.middlewares.js");

router.get("/public-jobs", getPublicJobs).get("/public/:id", getPublicJobById);
router
  .get("/counts", authMiddleware, companyAuthMiddleware, getJobCounts)

  .post("/", authMiddleware, companyAuthMiddleware, createJob)
  .get("/", authMiddleware, companyAuthMiddleware, getAllJobs)
  .get("/:id", authMiddleware, companyAuthMiddleware, getJobById)
  .put("/:id", authMiddleware, companyAuthMiddleware, updateJob)
  .delete("/:id", authMiddleware, companyAuthMiddleware, deleteJob)

  .patch(
    "/:id/toggle-status",
    authMiddleware,
    companyAuthMiddleware,
    toggleJobStatus,
  )
  .patch(
    "/:id/applicants",
    authMiddleware,
    companyAuthMiddleware,
    incrementApplicants,
  );

module.exports = router;
