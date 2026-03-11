const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const AdminModel = require("../models/admin.models.js");

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINS = 30;
const SALT_ROUNDS = 12;

const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
  });

  const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  });

  return { accessToken, refreshToken };
};

const getClientIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.socket?.remoteAddress ||
  null;

const register = async (req, res) => {
  try {
    const { full_name, email, username, password, role } = req.body;

    const missing = ["full_name", "email", "username", "password"].filter(
      (f) => !req.body[f]?.toString().trim(),
    );
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format." });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const allowedRoles = ["super_admin", "admin", "moderator", "support"];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed: ${allowedRoles.join(", ")}`,
      });
    }

    const [emailTaken, usernameTaken] = await Promise.all([
      AdminModel.emailExists(email),
      AdminModel.usernameExists(username),
    ]);

    if (emailTaken) {
      return res
        .status(409)
        .json({ success: false, message: "Email is already registered." });
    }
    if (usernameTaken) {
      return res
        .status(409)
        .json({ success: false, message: "Username is already taken." });
    }

    const hashPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const adminId = await AdminModel.create({
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      username: username.trim(),
      hashPassword,
      role: role || "admin",
    });

    const newAdmin = await AdminModel.findById(adminId);

    return res.status(201).json({
      success: true,
      message: "Admin registered successfully.",
      data: { admin: AdminModel.sanitize(newAdmin) },
    });
  } catch (err) {
    console.error("❌ [AdminController.register]:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required." });
    }

    const admin = await AdminModel.findByEmail(email.toLowerCase().trim());

    if (!admin) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials." });
    }

    if (admin.status === "suspended") {
      return res
        .status(403)
        .json({ success: false, message: "Account has been suspended." });
    }

    if (admin.status === "inactive") {
      return res
        .status(403)
        .json({ success: false, message: "Account is inactive." });
    }

    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      const unlockAt = new Date(admin.locked_until).toISOString();
      return res.status(423).json({
        success: false,
        message: `Account is locked until ${unlockAt}.`,
      });
    }

    if (!admin.hashPassword) {
      return res.status(401).json({
        success: false,
        message: "This account uses SSO login. Please sign in with Microsoft.",
      });
    }

    const passwordMatch = await bcrypt.compare(password, admin.hashPassword);

    if (!passwordMatch) {
      await AdminModel.incrementFailedLogin(admin.id);

      if (admin.failed_login_count + 1 >= MAX_FAILED_ATTEMPTS) {
        await AdminModel.lockAccount(admin.id, LOCK_DURATION_MINS);
        return res.status(423).json({
          success: false,
          message: `Too many failed attempts. Account locked for ${LOCK_DURATION_MINS} minutes.`,
        });
      }

      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials." });
    }

    const tokenPayload = { id: admin.id, email: admin.email, role: admin.role };
    const { accessToken, refreshToken } = generateTokens(tokenPayload);

    await Promise.all([
      AdminModel.updateRefreshToken(admin.id, refreshToken),
      AdminModel.updateLastLogin(admin.id, getClientIp(req)),
    ]);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      accessToken,
      refreshToken,
      data: { admin: AdminModel.sanitize(admin) },
    });
  } catch (err) {
    console.error("❌ [AdminController.login]:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Refresh token is required." });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired refresh token." });
    }

    const admin = await AdminModel.findById(decoded.id);

    if (!admin || admin.refresh_token !== token) {
      return res.status(401).json({
        success: false,
        message: "Refresh token mismatch or revoked.",
      });
    }

    if (admin.status !== "active") {
      return res
        .status(403)
        .json({ success: false, message: "Account is no longer active." });
    }

    const tokenPayload = { id: admin.id, email: admin.email, role: admin.role };
    const { accessToken, refreshToken: newRefreshToken } =
      generateTokens(tokenPayload);

    await AdminModel.updateRefreshToken(admin.id, newRefreshToken);

    return res.status(200).json({
      success: true,
      message: "Token refreshed.",
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("❌ [AdminController.refreshToken]:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

const logout = async (req, res) => {
  try {
    await AdminModel.clearRefreshToken(req.admin.id);

    return res
      .status(200)
      .json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("❌ [AdminController.logout]:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

const getProfile = async (req, res) => {
  try {
    const admin = await AdminModel.findById(req.admin.id);

    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found." });
    }

    return res.status(200).json({
      success: true,
      data: { admin: AdminModel.sanitize(admin) },
    });
  } catch (err) {
    console.error("❌ [AdminController.getProfile]:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  }
};

module.exports = { register, login, refreshToken, logout, getProfile };
