const { passport } = require("../../Service/passport.service.js");
const {
  APIRES,
  sendMail,
  buildCompanyWelcomeEmail,
} = require("../../Utils/index.utils.js");
const { updateRefreshToken } = require("../models/admin.model.js");
const {
  generateRefreshAndAccessTokens,
} = require("../../Controllers/auth.controllers.js");

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  domain:
    process.env.NODE_ENV === "production"
      ? process.env.COOKIE_DOMAIN
      : "localhost",
};

const microsoftLogin = passport.authenticate("microsoft-company", {
  prompt: "select_account",
});

const microsoftCallback = (req, res, next) => {
  passport.authenticate("microsoft-company", async (err, company, info) => {
    if (err) return next(err);

    if (!company) {
      return res
        .status(401)
        .json(
          new APIRES(
            401,
            {},
            info?.message || "Microsoft authentication failed",
          ),
        );
    }

    try {
      const { accessToken, refreshToken } =
        await generateRefreshAndAccessTokens({
          id: company.id,
          companyMail: company.companyMail,
          role: company.role,
        });

      await updateRefreshToken(company.id, refreshToken);

      // Fire-and-forget welcome email for new companies
      if (company._isNewUser) {
        const companyName =
          company.companyName || company.companyMail.split("@")[0];
        sendMail(
          company.companyMail,
          "🏢 Welcome to Talk2Hire — Start Hiring Today!",
          `Hi ${companyName}, your Talk2Hire company account is ready. Post your first job and start finding top talent.`,
          buildCompanyWelcomeEmail(companyName),
        ).catch((e) =>
          console.warn("⚠️ Company welcome email failed:", e.message),
        );
      }

      return res
        .cookie("accessToken", accessToken, {
          ...cookieOptions,
          maxAge: 24 * 60 * 60 * 1000,
        })
        .cookie("refreshToken", refreshToken, {
          ...cookieOptions,
          maxAge: 15 * 24 * 60 * 60 * 1000,
        })
        .redirect(`${process.env.CORS_ORIGIN}/company/microsoft/callback`);
    } catch (tokenErr) {
      return next(tokenErr);
    }
  })(req, res, next);
};

module.exports = { microsoftLogin, microsoftCallback };
