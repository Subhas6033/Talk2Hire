const { Router } = require("express");
const {
  getUsers,
  getUserById,
  deleteUser,
} = require("../Controllers/adminUser.controllers.js");
const {
  adminAuthMiddleware,
  requireRole,
} = require("../../Middlewares/auth.middlewares.js");

const router = Router();

router.use(adminAuthMiddleware);

router.get("/", getUsers);
router.get("/:id", getUserById);
router.delete("/:id", requireRole("super_admin"), deleteUser);

module.exports = router;
