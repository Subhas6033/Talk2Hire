const jwt = require("jsonwebtoken");
const { APIERR } = require("../Utils/index.utils");

const authMiddleware = (req, res, next) => {
  try {
    let token;

    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw new APIERR(401, "Authentication required");
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    req.user = {
      id: decoded.id,
      email: decoded.email,
    };

    next();
  } catch (error) {
    console.log("Auth Middleware Error:", error);
    next(error);
  }
};

module.exports = authMiddleware;
