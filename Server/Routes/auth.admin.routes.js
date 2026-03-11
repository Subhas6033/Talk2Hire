const { Router } = require("express");
const {
  registerCompany,
  loginCompany,
  logoutCompany,
  getCurrentCompany,
  updateCompanyProfile,
  updateCompanyLogoController,
  uploadLogoMiddleware,
} = require("../Controllers/auth.admin.controllers.js");
const { companyAuthMiddleware } = require("../Middlewares/auth.middlewares.js");

const router = Router();

router
  .post("/register", registerCompany)
  .post("/login", loginCompany)
  .post("/logout", logoutCompany)
  .get("/me", companyAuthMiddleware, getCurrentCompany)
  .patch("/update-details", companyAuthMiddleware, updateCompanyProfile)
  .patch(
    "/update-logo",
    companyAuthMiddleware,
    uploadLogoMiddleware,
    updateCompanyLogoController,
  );

module.exports = router;
