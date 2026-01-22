const { asyncHandler, APIERR, APIRES } = require("../Utils/index.utils.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../Models/user.models.js");

const generateRefreshAndAccessTokens = async (user) => {
  const refreshToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "15d",
    }
  );

  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "1d",
    }
  );

  return { refreshToken, accessToken };
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;

  if (
    [fullName, email, password].some((field) => !field || field.trim() === "")
  ) {
    throw new APIERR(400, "All fields are required");
  }

  if (password.length < 6) {
    throw new APIERR(400, "Password must be at least 6 characters");
  }

  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    throw new APIERR(409, "Email is already registered");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const userId = await User.create({
    fullName,
    email,
    hashPassword: passwordHash,
  });

  const { refreshToken, accessToken } = await generateRefreshAndAccessTokens({
    id: userId,
    email,
  });

  await User.updateRefreshToken(userId, refreshToken);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 15 * 24 * 60 * 60 * 1000, // 15day
  });

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000, //1day
  });

  res.status(201).json(
    new APIRES(
      201,
      {
        id: userId,
        fullName,
        email,
      },
      "User registered successfully"
    )
  );
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if ([email, password].some((fields) => !fields || fields.trim() === "")) {
    throw new APIERR(400, "Email and Password are required");
  }

  const isUserExist = await User.findByEmail(email);
  if (!isUserExist) {
    throw new APIERR(404, "No account found with this mail");
  }
  const isPasswordValid = await bcrypt.compare(
    password,
    isUserExist.hashPassword
  );
  if (!isPasswordValid) {
    throw new APIERR(401, "Incorrect Password");
  }

  const { refreshToken, accessToken } = await generateRefreshAndAccessTokens({
    id: isUserExist.id,
    email,
  });

  await User.updateRefreshToken(isUserExist.id, refreshToken);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 15 * 24 * 60 * 60 * 1000, //15 day
  });

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000, //1 day
  });

  res.status(200).json(
    new APIRES(
      200,
      {
        id: isUserExist.id,
        email,
        fullName: isUserExist.fullName,
      },
      "Successfully logged in"
    )
  );
});

const logoutUser = asyncHandler(async (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });

  res.status(200).json(new APIRES("User Logged out successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    throw new APIERR(404, "User not found");
  }

  // Delete the sensitive data from the response
  delete user.hashPassword;
  delete user.refreshToken;

  res.status(200).json(new APIRES(200, user, "User fetched"));
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new APIERR(400, "Please enter the mail");
  }

  const isUserExist = await User.findByEmail(email);
  if (!isUserExist) {
    throw new APIERR(
      404,
      "User with this mail not found. Please sign up first"
    );
  }
  // TODO: sent the mail
  // await sendMail(email)
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw new APIERR(401, "Refresh token missing");
  }

  const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

  const user = await User.findById(decoded.id);

  if (!user || user.refreshToken !== refreshToken) {
    throw new APIERR(401, "Invalid refresh token");
  }

  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "1d",
    }
  );

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.status(200).json(new APIRES(200, null, "Access token refreshed"));
});

module.exports = {
  generateRefreshAndAccessTokens,
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  getCurrentUser,
  refreshAccessToken,
};
