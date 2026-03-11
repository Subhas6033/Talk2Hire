const passport = require("passport");
const MicrosoftStrategy = require("passport-microsoft").Strategy;

const {
  getCompanyByEmail,
  createCompany,
  getCompanyById,
} = require("../Models/admin.model.js");
const User = require("../Models/user.models.js");
const { pool } = require("../Config/database.config.js");

// ─── Strategy 1 — Company ────────────────────────────────────────────────────
passport.use(
  "microsoft-company",
  new MicrosoftStrategy(
    {
      clientID: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      callbackURL: process.env.MICROSOFT_COMPANY_REDIRECT_URI,
      scope: ["user.read"],
      tenant: "common",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("✅ Company profile:", JSON.stringify(profile));

        const email =
          profile.emails?.[0]?.value ||
          profile._json?.userPrincipalName ||
          profile._json?.mail ||
          null;

        console.log("📧 Email:", email);

        if (!email)
          return done(null, false, { message: "No email from Microsoft" });

        const displayName = profile.displayName || email.split("@")[0];
        let company = await getCompanyByEmail(email);
        console.log("🏢 Existing company:", company);

        if (!company) {
          const result = await createCompany({
            companyName: displayName,
            industry: "Not specified",
            companySize: "Not specified",
            companyMail: email,
            companyMobile: "0000000000",
            companySite: "https://example.com",
            companyAddress: "Not specified",
            companyLocation: "Not specified",
            companyRegisterNumber: `MS-${profile.id.slice(0, 12)}`,
            password: null,
            role: "company",
            microsoftId: profile.id,
          });
          console.log("✅ Created company result:", result);
          company = await getCompanyById(result.insertId);
          company._isNewUser = true;
        } else {
          company._isNewUser = false;
        }

        return done(null, company);
      } catch (err) {
        console.error("❌ Company strategy error:", err);
        return done(err);
      }
    },
  ),
);

// ─── Strategy 2 — User ───────────────────────────────────────────────────────
passport.use(
  "microsoft-user",
  new MicrosoftStrategy(
    {
      clientID: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      callbackURL: process.env.MICROSOFT_USER_REDIRECT_URI,
      scope: ["user.read"],
      tenant: "common",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("✅ User profile:", JSON.stringify(profile));

        const email =
          profile.emails?.[0]?.value ||
          profile._json?.userPrincipalName ||
          profile._json?.mail ||
          null;

        console.log("📧 Email:", email);

        if (!email)
          return done(null, false, { message: "No email from Microsoft" });

        const displayName = profile.displayName || email.split("@")[0];
        let user = await User.findByEmail(email);
        console.log("👤 Existing user:", user);
        let isNewUser = false;

        if (!user) {
          isNewUser = true;
          const [result] = await pool.execute(
            `INSERT INTO users
               (email, hashPassword, fullName, mobile, location, skills,
                resume, resume_upload_status, created_at, updated_at, role, microsoft_id)
             VALUES (?, NULL, ?, NULL, NULL, '', NULL, 'pending', NOW(), NOW(), 'user', ?)`,
            [email, displayName, profile.id],
          );
          console.log("✅ Created user result:", result);
          user = await User.findById(result.insertId);
        }

        user._isNewUser = isNewUser;
        return done(null, user);
      } catch (err) {
        console.error("❌ User strategy error:", err);
        return done(err);
      }
    },
  ),
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

module.exports = { passport };
