const { Router } = require("express");
const {
  getJobs,
  getJobById,
  updateJobStatus,
  deleteJob,
} = require("../Controllers/adminJobManage.controllers.js");
const {
  adminAuthMiddleware,
  requireRole,
} = require("../../Middlewares/auth.middlewares.js");

const router = Router();

router.use(adminAuthMiddleware);

router.get("/", getJobs);
router.get("/:id", getJobById);
router.patch(
  "/:id/status",
  requireRole("super_admin", "admin", "moderator"),
  updateJobStatus,
);
router.delete("/:id", requireRole("super_admin", "admin"), deleteJob);

module.exports = router;
