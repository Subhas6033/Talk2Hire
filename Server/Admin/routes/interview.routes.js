const express = require("express");
const router = express.Router();
const {
  getAllInterviews,
  getInterviewCounts,
  getInterviewById,
  hireCandidate,
  rejectCandidate,
} = require("../Controllers/interview.controllers.js");
const {
  companyAuthMiddleware,
} = require("../../Middlewares/auth.middlewares.js");

router.use(companyAuthMiddleware);

router.get("/", getAllInterviews);
router.get("/counts", getInterviewCounts);
router.get("/:id", getInterviewById);
router.patch("/:id/hire", hireCandidate);
router.patch("/:id/reject", rejectCandidate);

module.exports = router;
