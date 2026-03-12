const { Router } = require("express");
const {
  getCompanies,
  getCompanyById,
  deleteCompany,
} = require("../Controllers/adminCompany.controllers.js");
const {
  adminAuthMiddleware,
  requireRole,
} = require("../../Middlewares/auth.middlewares.js");

const router = Router();

router.use(adminAuthMiddleware);

router.get("/", getCompanies);
router.get("/:id", getCompanyById);
router.delete("/:id", requireRole("super_admin"), deleteCompany);

module.exports = router;
