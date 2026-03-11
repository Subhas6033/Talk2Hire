const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../Middlewares/auth.middlewares.js");
const {
  getMyApplications,
  updateApplicationStatus,
  toggleApplicationStar,
  deleteApplication,
  updateApplicationNotes,
} = require("../Controllers/application.controllers.js");

router.use(authMiddleware);

router.get("/my", getMyApplications);
router.patch("/:id/status", updateApplicationStatus);
router.patch("/:id/star", toggleApplicationStar);
router.patch("/:id/notes", updateApplicationNotes);
router.delete("/:id", deleteApplication);

module.exports = router;
