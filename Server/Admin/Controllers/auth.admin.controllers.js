const { asyncHandler, APIERR, APIRES } = require("../../Utils/index.utils.js");
const {
  createCompany,
  getCompanyByEmail,
  getCompanyById,
  updateRefreshToken,
  updateCompany,
  updateCompanyLogoUrl,
} = require("../models/admin.model.js");
const {
  generateRefreshAndAccessTokens,
} = require("../../Controllers/auth.controllers.js");
const bcrypt = require("bcrypt");
const multer = require("multer");
const {
  uploadFileMicro,
} = require("../../Controllers/uploadFile.controllers.js");
const { deleteFileFromFTP } = require("../../Upload/uploadOnFTP");

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new APIERR(400, "Only JPEG, PNG, WEBP, and GIF images are allowed"),
        false,
      );
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadLogoMiddleware = upload.single("logo");

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" ? true : false,
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
    throw new APIERR(400, "All fields are required");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyMail)) {
    throw new APIERR(400, "Invalid email format");
  }

  if (!/^\d{10}$/.test(companyMobile)) {
    throw new APIERR(400, "Invalid mobile number format");
  }

  if (
    !/^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w- ./?%&=]*)?$/.test(companySite)
  ) {
    throw new APIERR(400, "Invalid website URL format");
  }

  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password) ||
    !/[@$!%*?&]/.test(password)
  ) {
    throw new APIERR(
      400,
      "Password must be at least 8 characters long and include uppercase, lowercase, digit, and special characters",
    );
  }

  const existingCompany = await getCompanyByEmail(companyMail);
  if (existingCompany) {
    throw new APIERR(409, "Company with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

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

  const newCompany = { id: result.insertId, companyMail, role: "company" };
  const { accessToken, refreshToken } =
    await generateRefreshAndAccessTokens(newCompany);
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
        { id: result.insertId, role: "company" },
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
    role: "company",
  });

  await updateRefreshToken(isCompanyExist.id, refreshToken);

  return res
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
          companyMobile: isCompanyExist.companyMobile,
          companySite: isCompanyExist.companySite,
          companyAddress: isCompanyExist.companyAddress,
          companyLocation: isCompanyExist.companyLocation,
          companyRegisterNumber: isCompanyExist.companyRegisterNumber,
          companySize: isCompanyExist.companySize,
          industry: isCompanyExist.industry,
          logo: isCompanyExist.logo,
          role: isCompanyExist.role,
        },
        "Successfully logged in as a company",
      ),
    );
});

const logoutCompany = asyncHandler(async (req, res) => {
  if (req.company?.id) {
    await updateRefreshToken(req.company.id, null);
  }

  const clearOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  };

  return res
    .status(200)
    .clearCookie("accessToken", clearOptions)
    .clearCookie("refreshToken", clearOptions)
    .json(new APIRES(200, {}, "Logged out successfully"));
});

const getCurrentCompany = asyncHandler(async (req, res) => {
  const company = await getCompanyById(req.company.id);
  if (!company) throw new APIERR(404, "Company not found");

  const { password, refreshToken, ...safeCompany } = company;
  return res
    .status(200)
    .json(new APIRES(200, safeCompany, "Company profile fetched successfully"));
});

const updateCompanyProfile = asyncHandler(async (req, res) => {
  const companyId = req.company.id;
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
  } = req.body;

  const hasUpdate = [
    companyName,
    industry,
    companySize,
    companyMail,
    companyMobile,
    companySite,
    companyAddress,
    companyLocation,
    companyRegisterNumber,
  ].some((val) => val !== undefined && val !== null && val !== "");

  if (!hasUpdate) throw new APIERR(400, "No valid fields provided for update");

  const existing = await getCompanyById(companyId);
  if (!existing) throw new APIERR(404, "Company not found");

  if (companyMail && companyMail !== existing.companyMail) {
    const emailTaken = await getCompanyByEmail(companyMail);
    if (emailTaken && emailTaken.id !== companyId) {
      throw new APIERR(409, "This email is already in use by another account");
    }
  }

  const updatePayload = {
    companyName: companyName ?? existing.companyName,
    industry: industry ?? existing.industry,
    companySize: companySize ?? existing.companySize,
    companyMail: companyMail ?? existing.companyMail,
    companyMobile: companyMobile ?? existing.companyMobile,
    companySite: companySite ?? existing.companySite,
    companyAddress: companyAddress ?? existing.companyAddress,
    companyLocation: companyLocation ?? existing.companyLocation,
    companyRegisterNumber:
      companyRegisterNumber ?? existing.companyRegisterNumber,
  };

  const result = await updateCompany(companyId, updatePayload);
  if (result.affectedRows === 0)
    throw new APIERR(500, "Update failed — no rows were modified");

  const updated = await getCompanyById(companyId);
  const { password, refreshToken, ...safeUpdated } = updated;
  return res
    .status(200)
    .json(new APIRES(200, safeUpdated, "Company profile updated successfully"));
});

const updateCompanyLogoController = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new APIERR(400, "No image file provided");
  }

  const companyId = req.company.id;

  const existing = await getCompanyById(companyId);
  if (!existing) throw new APIERR(404, "Company not found");
  const ftpResult = await uploadFileMicro(
    {
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    },
    "/public/companyLogo",
  );

  const logoUrl = ftpResult.url;

  // Persist the FTP URL in the database
  await updateCompanyLogoUrl(companyId, logoUrl);

  if (existing.logo) {
    deleteFileFromFTP(existing.logo).catch((err) =>
      console.warn("⚠️  Could not delete old logo from FTP:", err.message),
    );
  }

  return res
    .status(200)
    .json(new APIRES(200, { logo: logoUrl }, "Logo updated successfully"));
});

module.exports = {
  registerCompany,
  loginCompany,
  logoutCompany,
  getCurrentCompany,
  updateCompanyProfile,
  updateCompanyLogoController,
  uploadLogoMiddleware,
};
