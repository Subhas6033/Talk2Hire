const { asyncHandler, APIERR, APIRES } = require("../../Utils/index.utils.js");
const {
  createCompany,
  getCompanyByEmail,
  updateRefreshToken,
} = require("../models/admin.model.js");
const {
  generateRefreshAndAccessTokens,
} = require("../../Controllers/auth.controllers.js");
const bcrypt = require("bcrypt");

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
};

const registerCompany = asyncHandler(async (req, res) => {
  const {
    companyName,
    industry,
    companySize,
    companyMail,
    companyMobile,
    companySite,
    companyAddress,
    companyLocation,
    companyRegisterNumber,
    password,
  } = req.body;

  if (
    [
      companyName,
      industry,
      companySize,
      companyMail,
      companyMobile,
      companySite,
      companyAddress,
      companyLocation,
      companyRegisterNumber,
      password,
    ].some((field) => !field || field.trim() === "")
  ) {
    throw new APIERR("All fields are required", 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyMail)) {
    throw new APIERR("Invalid email format", 400);
  }

  if (!/^\d{10}$/.test(companyMobile)) {
    throw new APIERR("Invalid mobile number format", 400);
  }

  if (
    !/^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w- ./?%&=]*)?$/.test(companySite)
  ) {
    throw new APIERR("Invalid website URL format", 400);
  }

  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password) ||
    !/[@$!%*?&]/.test(password)
  ) {
    throw new APIERR(
      "Password must be at least 8 characters long and include uppercase, lowercase, digit, and special characters",
      400,
    );
  }

  // Check if company already exists
  const existingCompany = await getCompanyByEmail(companyMail);
  if (existingCompany) {
    throw new APIERR("Company with this email already exists", 409);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  let role = "";
  // Create company
  const result = await createCompany({
    companyName,
    industry,
    companySize,
    companyMail,
    companyMobile,
    companySite,
    companyAddress,
    companyLocation,
    companyRegisterNumber,
    password: hashedPassword,
    role: "company",
  });

  // Generate tokens
  const newCompany = { id: result.insertId, companyMail };
  const { accessToken, refreshToken } =
    await generateRefreshAndAccessTokens(newCompany);

  // Save refresh token in DB
  await updateRefreshToken(result.insertId, refreshToken);

  return res
    .status(201)
    .cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000,
    })
    .cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 15 * 24 * 60 * 60 * 1000,
    })
    .json(
      new APIRES(
        201,
        { id: result.insertId, role },
        "Company created successfully",
      ),
    );
});

const loginCompany = asyncHandler(async (req, res) => {
  const { companyMail, password } = req.body;

  if (!companyMail || !password) {
    throw new APIERR(400, "Please enter all the fields");
  }

  const isCompanyExist = await getCompanyByEmail(companyMail);
  if (!isCompanyExist) {
    throw new APIERR(404, "Sorry we can't find any company with this mail");
  }

  const isPasswordCorrect = await bcrypt.compare(
    password,
    isCompanyExist.password,
  );
  if (!isPasswordCorrect) {
    throw new APIERR(401, "Incorrect password");
  }

  const { accessToken, refreshToken } = await generateRefreshAndAccessTokens({
    id: isCompanyExist.id,
    companyMail,
  });

  await updateRefreshToken(isCompanyExist.id, refreshToken);

  res
    .status(200)
    .cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000,
    })
    .cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 15 * 24 * 60 * 60 * 1000,
    })
    .json(
      new APIRES(
        200,
        {
          id: isCompanyExist.id,
          companyName: isCompanyExist.companyName,
          companyMail: isCompanyExist.companyMail,
          role: isCompanyExist.role,
        },
        "Successfully logged in as a company",
      ),
    );
});

const logoutCompany = asyncHandler(async (req, res) => {});

module.exports = {
  registerCompany,
  loginCompany,
  logoutCompany,
};
