const express = require("express");
const {
  evaluateInterviewController,
  triggerEvaluationByIdController,
  getEvaluationController,
  getEvaluationSummary,
} = require("../Controllers/evaluation.controller.js");
const { authMiddleware } = require("../Middlewares/auth.middlewares.js");

const router = express.Router();
router.use(authMiddleware);

router
  .post("/evaluate/:interviewId", evaluateInterviewController)
  .post("/trigger/:interviewId", triggerEvaluationByIdController)
  .get("/results/:interviewId", getEvaluationController)
  .get("/summary/:interviewId", getEvaluationSummary);

module.exports = router;
