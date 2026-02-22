const { pool } = require("../../Config/database.config.js");

// Create Company
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
  } = companyData;

  const sql = `
    INSERT INTO company_details 
    (companyName, industry, companySize, companyMail, companyMobile, companySite, companyAddress, companyLocation, companyRegisterNumber, password, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  ]);

  return result;
};

// Get All Companies
const getAllCompanies = async () => {
  const [rows] = await pool.query("SELECT * FROM company_details");
  return rows;
};

// Get Company By ID
const getCompanyById = async (id) => {
  const [rows] = await pool.query(
    "SELECT * FROM company_details WHERE id = ?",
    [id],
  );
  return rows[0];
};

// Get Company By Email
const getCompanyByEmail = async (companyMail) => {
  const [rows] = await pool.query(
    "SELECT * FROM company_details WHERE companyMail = ?",
    [companyMail],
  );
  return rows[0];
};

// Update Company
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
    companyName = ?,
    industry = ?,
    companySize = ?,
    companyMail = ?,
    companyMobile = ?,
    companySite = ?,
    companyAddress = ?,
    companyLocation = ?,
    companyRegisterNumber = ?
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

// Delete Company
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

module.exports = {
  createCompany,
  getAllCompanies,
  getCompanyById,
  getCompanyByEmail,
  updateCompany,
  deleteCompany,
  updateRefreshToken,
};
