const jwt = require("jsonwebtoken");
const { APIERR } = require("../Utils/index.utils");

const authMiddleware = (req, res, next) => {
  try {
    let token;

    // First priority: Check cookies (recommended)
    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    // Fallback: Check Authorization header (for flexibility)
    else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // No token found
    if (!token) {
      throw new APIERR(401, "Authentication required. Please login.");
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Attach user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
    };

    console.log("✅ Authenticated user:", req.user.id);

    // Continue to next middleware/route
    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === "TokenExpiredError") {
      return next(new APIERR(401, "Token expired. Please login again."));
    }

    if (error.name === "JsonWebTokenError") {
      return next(new APIERR(401, "Invalid token. Please login again."));
    }

    // If it's already an APIERR, pass it along
    if (error instanceof APIERR) {
      return next(error);
    }

    // Generic error
    next(new APIERR(401, "Unauthorized access."));
  }
};

module.exports = authMiddleware;
