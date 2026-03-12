const { asyncHandler, APIERR, APIRES } = require("../../Utils/index.utils.js");
const { pool } = require("../../Config/database.config.js");

const getJobs = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;
  const search = req.query.search?.trim() || "";
  const status = req.query.status || "all";
  const type = req.query.type || "all";
  const sortBy = ["title", "created_at", "applicants", "posted"].includes(
    req.query.sortBy,
  )
    ? req.query.sortBy
    : "created_at";
  const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";

  let where = "WHERE 1=1";
  const params = [];

  if (search) {
    where +=
      " AND (j.title LIKE ? OR j.department LIKE ? OR j.location LIKE ? OR c.companyName LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status !== "all") {
    where += " AND j.status = ?";
    params.push(status);
  }

  if (type !== "all") {
    where += " AND j.type = ?";
    params.push(type);
  }

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM jobs j
     LEFT JOIN company_details c ON j.company_id = c.id ${where}`,
    params,
  );

  const [jobs] = await pool.execute(
    `SELECT j.id, j.title, j.department, j.location, j.type, j.experience,
            j.salary, j.status, j.applicants, j.posted, j.created_at,
            c.companyName, c.logo
     FROM jobs j
     LEFT JOIN company_details c ON j.company_id = c.id
     ${where}
     ORDER BY j.${sortBy} ${sortOrder}
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );

  res.status(200).json(
    new APIRES(
      200,
      {
        jobs,
        pagination: {
          total: Number(total),
          page,
          limit,
          totalPages: Math.ceil(Number(total) / limit),
          hasNext: page < Math.ceil(Number(total) / limit),
          hasPrev: page > 1,
        },
      },
      "Jobs fetched",
    ),
  );
});

const getJobById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [[job]] = await pool.execute(
    `SELECT j.*, c.companyName, c.logo, c.companyMail, c.industry
     FROM jobs j
     LEFT JOIN company_details c ON j.company_id = c.id
     WHERE j.id = ?`,
    [id],
  );
  if (!job) throw new APIERR(404, "Job not found.");
  res.status(200).json(new APIRES(200, { job }, "Job fetched"));
});

const updateJobStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!["active", "closed", "draft"].includes(status))
    throw new APIERR(400, "Status must be active, closed, or draft.");

  const [result] = await pool.execute(
    "UPDATE jobs SET status = ? WHERE id = ?",
    [status, id],
  );
  if (result.affectedRows === 0) throw new APIERR(404, "Job not found.");
  res.status(200).json(new APIRES(200, null, `Job marked as ${status}.`));
});

const deleteJob = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [result] = await pool.execute("DELETE FROM jobs WHERE id = ?", [id]);
  if (result.affectedRows === 0) throw new APIERR(404, "Job not found.");
  res.status(200).json(new APIRES(200, null, "Job deleted."));
});

module.exports = { getJobs, getJobById, updateJobStatus, deleteJob };
