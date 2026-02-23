const Dashboard = require("../models/dashboard.models.js");
const { asyncHandler, APIERR, APIRES } = require("../../Utils/index.utils.js");

// ─── GET /api/company/dashboard ───────────────────────────────
// Returns stats, pipeline, recentJobs, recentInterviews in one call
const getDashboard = asyncHandler(async (req, res) => {
  const companyId = req.company.id;

  const data = await Dashboard.getDashboardData(companyId);

  return res
    .status(200)
    .json(new APIRES(200, data, "Dashboard data fetched successfully"));
});

// ─── GET /api/company/dashboard/stats ─────────────────────────
const getDashboardStats = asyncHandler(async (req, res) => {
  const companyId = req.company.id;

  const stats = await Dashboard.getStats(companyId);

  return res
    .status(200)
    .json(new APIRES(200, stats, "Stats fetched successfully"));
});

// ─── GET /api/company/dashboard/pipeline ──────────────────────
const getDashboardPipeline = asyncHandler(async (req, res) => {
  const companyId = req.company.id;

  const pipeline = await Dashboard.getPipeline(companyId);

  return res
    .status(200)
    .json(new APIRES(200, pipeline, "Pipeline fetched successfully"));
});

// ─── GET /api/company/dashboard/recent-jobs ───────────────────
const getRecentJobs = asyncHandler(async (req, res) => {
  const companyId = req.company.id;

  const recentJobs = await Dashboard.getRecentJobs(companyId);

  return res
    .status(200)
    .json(new APIRES(200, recentJobs, "Recent jobs fetched successfully"));
});

// ─── GET /api/company/dashboard/recent-interviews ─────────────
const getRecentInterviews = asyncHandler(async (req, res) => {
  const companyId = req.company.id;

  const recentInterviews = await Dashboard.getRecentInterviews(companyId);

  return res
    .status(200)
    .json(
      new APIRES(
        200,
        recentInterviews,
        "Recent interviews fetched successfully",
      ),
    );
});

module.exports = {
  getDashboard,
  getDashboardStats,
  getDashboardPipeline,
  getRecentJobs,
  getRecentInterviews,
};
