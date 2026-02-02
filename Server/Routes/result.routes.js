const express = require("express");
const {
  evaluateInterviewController,
  getEvaluationController,
  getEvaluationSummary,
} = require("../Controllers/evaluation.controller.js");
const authMiddleware = require("../Middlewares/auth.middlewares.js");

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router
  .post("/evaluate/:interviewId", evaluateInterviewController)
  .get("/results/:interviewId", getEvaluationController)
  .get("/summary/:interviewId", getEvaluationSummary);

module.exports = router;
