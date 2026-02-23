const express = require("express");
const HiringController = require("../Controllers/hiring.controller.js");
const { authMiddleware } = require("../Middlewares/auth.middlewares.js");

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get all candidates with filters
router.get("/candidates", HiringController.getCandidates);

// Get single candidate details
router.get("/candidates/:interviewId", HiringController.getCandidateDetails);

// Get hiring statistics
router.get("/stats", HiringController.getHiringStats);

module.exports = router;
