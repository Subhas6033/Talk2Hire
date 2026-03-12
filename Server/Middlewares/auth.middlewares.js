const jwt = require("jsonwebtoken");
const { APIERR } = require("../Utils/index.utils");

const authMiddleware = (req, res, next) => {
  try {
    let token;

    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) throw new APIERR(401, "Authentication required. Please login.");

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError")
      return next(new APIERR(401, "Token expired. Please login again."));
    if (error.name === "JsonWebTokenError")
      return next(new APIERR(401, "Invalid token. Please login again."));
    if (error instanceof APIERR) return next(error);
    next(new APIERR(401, "Unauthorized access."));
  }
};

const companyAuthMiddleware = (req, res, next) => {
  try {
    let token;

    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) throw new APIERR(401, "Authentication required. Please login.");

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    if (decoded.role !== "company")
      throw new APIERR(403, "Access denied. Company accounts only.");

    req.company = { id: decoded.id, email: decoded.email, role: decoded.role };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError")
      return next(new APIERR(401, "Token expired. Please login again."));
    if (error.name === "JsonWebTokenError")
      return next(new APIERR(401, "Invalid token. Please login again."));
    if (error instanceof APIERR) return next(error);
    next(new APIERR(401, "Unauthorized access."));
  }
};

const adminAuthMiddleware = (req, res, next) => {
  try {
    let token;

    if (req.cookies?.adminAccessToken) {
      token = req.cookies.adminAccessToken;
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) throw new APIERR(401, "Authentication required. Please login.");

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const adminRoles = ["super_admin", "admin", "moderator", "support"];

    if (!adminRoles.includes(decoded.role))
      throw new APIERR(403, "Access denied. Admin accounts only.");

    req.admin = { id: decoded.id, email: decoded.email, role: decoded.role };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError")
      return next(new APIERR(401, "Token expired. Please login again."));
    if (error.name === "JsonWebTokenError")
      return next(new APIERR(401, "Invalid token. Please login again."));
    if (error instanceof APIERR) return next(error);
    next(new APIERR(401, "Unauthorized access."));
  }
};

const requireRole =
  (...roles) =>
  (req, res, next) => {
    try {
      if (!req.admin)
        throw new APIERR(401, "Authentication required. Please login.");

      if (!roles.includes(req.admin.role))
        throw new APIERR(
          403,
          `Access denied. Required role(s): ${roles.join(", ")}.`,
        );

      next();
    } catch (error) {
      if (error instanceof APIERR) return next(error);
      next(new APIERR(403, "Forbidden."));
    }
  };

module.exports = {
  authMiddleware,
  companyAuthMiddleware,
  adminAuthMiddleware,
  requireRole,
};
