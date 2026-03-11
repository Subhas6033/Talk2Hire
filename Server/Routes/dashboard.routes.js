const express = require("express");
const router = express.Router();
const {
  getDashboard,
  getDashboardStats,
  getDashboardPipeline,
  getRecentJobs,
  getRecentInterviews,
} = require("../Controllers/companyDashboard.controllers.js");
const { companyAuthMiddleware } = require("../Middlewares/auth.middlewares.js");

router.use(companyAuthMiddleware);

router.get("/", getDashboard);
router.get("/stats", getDashboardStats);
router.get("/pipeline", getDashboardPipeline);
router.get("/recent-jobs", getRecentJobs);
router.get("/recent-interviews", getRecentInterviews);

module.exports = router;
