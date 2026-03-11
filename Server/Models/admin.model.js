const { pool } = require("../Config/database.config.js");

const createCompany = async (companyData) => {
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
    role = "company",
    microsoftId = null,
  } = companyData;

  const sql = `
    INSERT INTO company_details 
    (companyName, industry, companySize, companyMail, companyMobile, companySite,
     companyAddress, companyLocation, companyRegisterNumber, password, role, microsoft_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const [result] = await pool.query(sql, [
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
    role,
    microsoftId,
  ]);

  return result;
};

const getAllCompanies = async () => {
  const [rows] = await pool.query("SELECT * FROM company_details");
  return rows;
};

const getCompanyById = async (id) => {
  const [rows] = await pool.query(
    "SELECT * FROM company_details WHERE id = ?",
    [id],
  );
  return rows[0];
};

const getCompanyByEmail = async (companyMail) => {
  const [rows] = await pool.query(
    "SELECT * FROM company_details WHERE companyMail = ?",
    [companyMail],
  );
  return rows[0];
};

const updateCompany = async (id, companyData) => {
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
  } = companyData;

  const sql = `
    UPDATE company_details SET
    companyName = ?, industry = ?, companySize = ?, companyMail = ?,
    companyMobile = ?, companySite = ?, companyAddress = ?,
    companyLocation = ?, companyRegisterNumber = ?
    WHERE id = ?
  `;

  const [result] = await pool.query(sql, [
    companyName,
    industry,
    companySize,
    companyMail,
    companyMobile,
    companySite,
    companyAddress,
    companyLocation,
    companyRegisterNumber,
    id,
  ]);

  return result;
};

const deleteCompany = async (id) => {
  const [result] = await pool.query(
    "DELETE FROM company_details WHERE id = ?",
    [id],
  );
  return result;
};

const updateRefreshToken = async (id, refreshToken) => {
  const [result] = await pool.query(
    "UPDATE company_details SET refreshToken = ? WHERE id = ?",
    [refreshToken, id],
  );
  return result;
};

const updateCompanyLogoUrl = async (companyId, logoUrl) => {
  const [result] = await pool.execute(
    "UPDATE company_details SET logo = ? WHERE id = ?",
    [logoUrl, companyId],
  );
  return result;
};

module.exports = {
  createCompany,
  getAllCompanies,
  getCompanyById,
  getCompanyByEmail,
  updateCompany,
  deleteCompany,
  updateRefreshToken,
  updateCompanyLogoUrl,
};
