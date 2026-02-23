const jwt = require("jsonwebtoken");
const { APIERR } = require("../Utils/index.utils");

// ─── Generic Auth ─────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  try {
    let token;

    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw new APIERR(401, "Authentication required. Please login.");
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    console.log("✅ Authenticated user:", req.user.id);

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new APIERR(401, "Token expired. Please login again."));
    }
    if (error.name === "JsonWebTokenError") {
      return next(new APIERR(401, "Invalid token. Please login again."));
    }
    if (error instanceof APIERR) {
      return next(error);
    }
    next(new APIERR(401, "Unauthorized access."));
  }
};

// ─── Company Auth ─────────────────────────────────────────────
// Use after authMiddleware — confirms the logged-in user is a company
const companyAuthMiddleware = (req, res, next) => {
  try {
    let token;

    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw new APIERR(401, "Authentication required. Please login.");
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    if (decoded.role !== "company") {
      throw new APIERR(403, "Access denied. Company accounts only.");
    }

    req.company = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    console.log("✅ Authenticated company:", req.company.id);

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new APIERR(401, "Token expired. Please login again."));
    }
    if (error.name === "JsonWebTokenError") {
      return next(new APIERR(401, "Invalid token. Please login again."));
    }
    if (error instanceof APIERR) {
      return next(error);
    }
    next(new APIERR(401, "Unauthorized access."));
  }
};

module.exports = { authMiddleware, companyAuthMiddleware };
