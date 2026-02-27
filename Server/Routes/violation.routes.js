const express = require("express");
const router = express.Router();
const {
  getViolations,
  getViolationSummary,
  getCompanyViolations,
} = require("../Controllers/violation.controllers.js");

// your existing auth middleware — swap for whatever you use
const { authMiddleware } = require("../Middlewares/auth.middlewares.js");

// All routes require auth
router.use(authMiddleware);

/**
 * GET /api/v1/violations/company
 * All violations across all interviews for this company/user.
 * Query: ?page=1&limit=20&type=NO_FACE
 */
router.get("/company", getCompanyViolations);

/**
 * GET /api/v1/violations/:interviewId
 * All violations for a single interview (timeline view).
 */
router.get("/:interviewId", getViolations);

/**
 * GET /api/v1/violations/summary/:interviewId
 * Grouped counts + durations per violation type.
 */
router.get("/summary/:interviewId", getViolationSummary);

module.exports = router;
