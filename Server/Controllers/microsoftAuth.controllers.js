const { passport } = require("../Service/passport.service.js");
const {
  APIRES,
  buildUserWelcomeEmail,
  sendMail,
} = require("../Utils/index.utils.js");
const { generateRefreshAndAccessTokens } = require("./auth.controllers.js");
const User = require("../Models/user.models.js");

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

const userMicrosoftLogin = passport.authenticate("microsoft-user", {
  prompt: "select_account",
});

const userMicrosoftCallback = (req, res, next) => {
  passport.authenticate("microsoft-user", async (err, user, info) => {
    if (err) return next(err);

    if (!user) {
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
          id: user.id,
          email: user.email,
          role: user.role || "user",
        });

      await User.updateRefreshToken(user.id, refreshToken);

      // Fire-and-forget welcome email for new users
      if (user._isNewUser) {
        const fullName = user.fullName || user.email.split("@")[0];
        sendMail(
          user.email,
          "🎉 Welcome to Talk2Hire — You're In!",
          `Hi ${fullName}, welcome to Talk2Hire! Head to your dashboard to start exploring matched jobs.`,
          buildUserWelcomeEmail(fullName),
        ).catch((e) => console.warn("⚠️ Welcome email failed:", e.message));
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
        .redirect(`${process.env.CORS_ORIGIN}/user/microsoft/callback`);
    } catch (tokenErr) {
      return next(tokenErr);
    }
  })(req, res, next);
};

module.exports = { userMicrosoftLogin, userMicrosoftCallback };
