const { Router } = require("express");
const { getAdminStats } = require("../Controllers/adminStats.controllers.js");
const {
  adminAuthMiddleware,
} = require("../../Middlewares/auth.middlewares.js");

const router = Router();

router.get("/get-stats", adminAuthMiddleware, getAdminStats);

module.exports = router;
