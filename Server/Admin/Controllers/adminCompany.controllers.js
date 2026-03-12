const { asyncHandler, APIERR, APIRES } = require("../../Utils/index.utils.js");
const { pool } = require("../../Config/database.config.js");

const getCompanies = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;
  const search = req.query.search?.trim() || "";
  const sortBy = [
    "companyName",
    "companyMail",
    "created_at",
    "industry",
  ].includes(req.query.sortBy)
    ? req.query.sortBy
    : "created_at";
  const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";

  let where = "WHERE 1=1";
  const params = [];

  if (search) {
    where +=
      " AND (companyName LIKE ? OR companyMail LIKE ? OR industry LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM company_details ${where}`,
    params,
  );

  const [companies] = await pool.execute(
    `SELECT id, companyName, companyMail, companyMobile, logo, industry,
            companySize, companyLocation, companySite, created_at
     FROM company_details ${where}
     ORDER BY ${sortBy} ${sortOrder}
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );

  res.status(200).json(
    new APIRES(
      200,
      {
        companies,
        pagination: {
          total: Number(total),
          page,
          limit,
          totalPages: Math.ceil(Number(total) / limit),
          hasNext: page < Math.ceil(Number(total) / limit),
          hasPrev: page > 1,
        },
      },
      "Companies fetched",
    ),
  );
});

const getCompanyById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [[company]] = await pool.execute(
    `SELECT id, companyName, companyMail, companyMobile, logo, industry,
            companySize, companyLocation, companySite, companyAddress,
            companyRegisterNumber, created_at
     FROM company_details WHERE id = ?`,
    [id],
  );
  if (!company) throw new APIERR(404, "Company not found.");
  res.status(200).json(new APIRES(200, { company }, "Company fetched"));
});

const deleteCompany = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [result] = await pool.execute(
    "DELETE FROM company_details WHERE id = ?",
    [id],
  );
  if (result.affectedRows === 0) throw new APIERR(404, "Company not found.");
  res.status(200).json(new APIRES(200, null, "Company deleted."));
});

module.exports = { getCompanies, getCompanyById, deleteCompany };
