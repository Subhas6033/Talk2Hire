const Job = require("../Models/job.models.js");
const { APIERR, APIRES, asyncHandler } = require("../Utils/index.utils.js");
const { pool } = require("../Config/database.config.js");
const { sendJobAlertToAll } = require("../News/newsLetter.controllers.js");

const createJob = asyncHandler(async (req, res) => {
  const {
    title,
    department,
    location,
    type,
    experience,
    salary,
    status,
    description,
    responsibilities,
    requirements,
    skills,
  } = req.body;

  if (!title?.trim()) throw new APIERR(400, "Job title is required");
  if (!department?.trim()) throw new APIERR(400, "Department is required");
  if (!location?.trim()) throw new APIERR(400, "Location is required");
  if (!experience?.trim())
    throw new APIERR(400, "Experience level is required");
  if (!description?.trim())
    throw new APIERR(400, "Job description is required");

  const job = await Job.create({
    company_id: req.company.id,
    title: title.trim(),
    department: department.trim(),
    location: location.trim(),
    type,
    experience,
    salary: salary?.trim() || null,
    status,
    description: description.trim(),
    responsibilities: responsibilities?.trim() || null,
    requirements: requirements?.trim() || null,
    skills: Array.isArray(skills) ? skills : [],
  });

  if (status !== "draft") {
    sendJobAlertToAll({
      id: job.id,
      title: title.trim(),
      company: req.company.companyName || req.company.name || "Talk2Hire",
      location: location.trim(),
      type: type || "Full-time",
      salary: salary || null,
      description: description.trim(),
    }).catch((err) =>
      console.error("[createJob] Newsletter alert failed:", err.message),
    );
  }

  return res.status(201).json(new APIRES(201, job, "Job posted successfully"));
});

const getAllJobs = asyncHandler(async (req, res) => {
  const { status, department, search } = req.query;
  const company_id = req.company.id;

  const [jobs, counts] = await Promise.all([
    Job.findAll({ company_id, status, department, search }),
    Job.getCounts(company_id),
  ]);

  return res
    .status(200)
    .json(
      new APIRES(
        200,
        { jobs, counts, total: jobs.length },
        "Jobs fetched successfully",
      ),
    );
});

const getJobCounts = asyncHandler(async (req, res) => {
  const counts = await Job.getCounts(req.company.id);
  return res
    .status(200)
    .json(new APIRES(200, counts, "Job counts fetched successfully"));
});

const getCompanyJobById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) throw new APIERR(400, "Invalid job ID");

  const job = await Job.findById(Number(id));
  if (!job) throw new APIERR(404, "Job not found");
  if (job.company_id !== req.company.id)
    throw new APIERR(
      403,
      "Access denied. This job belongs to another company.",
    );

  return res.status(200).json(new APIRES(200, job, "Job fetched successfully"));
});

const updateJob = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) throw new APIERR(400, "Invalid job ID");

  const existing = await Job.findById(Number(id));
  if (!existing) throw new APIERR(404, "Job not found");
  if (existing.company_id !== req.company.id)
    throw new APIERR(
      403,
      "Access denied. This job belongs to another company.",
    );

  if (req.body.title !== undefined && !req.body.title?.trim())
    throw new APIERR(400, "Job title cannot be empty");
  if (req.body.department !== undefined && !req.body.department?.trim())
    throw new APIERR(400, "Department cannot be empty");
  if (req.body.location !== undefined && !req.body.location?.trim())
    throw new APIERR(400, "Location cannot be empty");
  if (req.body.description !== undefined && !req.body.description?.trim())
    throw new APIERR(400, "Description cannot be empty");

  const updatedJob = await Job.update(Number(id), req.body);
  return res
    .status(200)
    .json(new APIRES(200, updatedJob, "Job updated successfully"));
});

const toggleJobStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) throw new APIERR(400, "Invalid job ID");

  const existing = await Job.findById(Number(id));
  if (!existing) throw new APIERR(404, "Job not found");
  if (existing.company_id !== req.company.id)
    throw new APIERR(
      403,
      "Access denied. This job belongs to another company.",
    );
  if (existing.status === "draft")
    throw new APIERR(
      400,
      "Draft jobs cannot be toggled. Use update to change status.",
    );

  const updatedJob = await Job.toggleStatus(Number(id));
  const message =
    updatedJob.status === "active"
      ? "Job activated successfully"
      : "Job deactivated successfully";

  if (updatedJob.status === "active") {
    sendJobAlertToAll({
      id: updatedJob.id,
      title: updatedJob.title,
      company: req.company.companyName || req.company.name || "Talk2Hire",
      location: updatedJob.location,
      type: updatedJob.type || "Full-time",
      salary: updatedJob.salary || null,
      description: updatedJob.description,
    }).catch((err) =>
      console.error("[toggleJobStatus] Newsletter alert failed:", err.message),
    );
  }

  return res.status(200).json(new APIRES(200, updatedJob, message));
});

const incrementApplicants = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) throw new APIERR(400, "Invalid job ID");

  const existing = await Job.findById(Number(id));
  if (!existing) throw new APIERR(404, "Job not found");
  if (existing.status !== "active")
    throw new APIERR(400, "Cannot apply to a job that is not active");

  await Job.incrementApplicants(Number(id));
  return res
    .status(200)
    .json(new APIRES(200, null, "Application submitted successfully"));
});

const deleteJob = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) throw new APIERR(400, "Invalid job ID");

  const existing = await Job.findById(Number(id));
  if (!existing) throw new APIERR(404, "Job not found");
  if (existing.company_id !== req.company.id)
    throw new APIERR(
      403,
      "Access denied. This job belongs to another company.",
    );

  const deleted = await Job.delete(Number(id));
  if (!deleted)
    throw new APIERR(500, "Failed to delete job. Please try again.");

  return res
    .status(200)
    .json(new APIRES(200, { id: Number(id) }, "Job deleted successfully"));
});

const getPublicJobs = asyncHandler(async (req, res) => {
  const { search, department, location, type, experience } = req.query;
  const jobs = await Job.findAllPublic({
    search,
    department,
    location,
    type,
    experience,
  });
  return res
    .status(200)
    .json(
      new APIRES(
        200,
        { jobs, total: jobs.length },
        "Jobs fetched successfully",
      ),
    );
});

const searchJobs = async (req, res) => {
  try {
    const {
      q = "",
      location = "",
      type = "",
      department = "",
      experience = "",
      page = 1,
      limit = 9,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions = ["j.status = 'active'"];
    const params = [];

    if (q.trim()) {
      conditions.push(
        `(j.title LIKE ? OR j.department LIKE ? OR j.location LIKE ? OR j.description LIKE ?)`,
      );
      const like = `%${q.trim()}%`;
      params.push(like, like, like, like);
    }
    if (location.trim()) {
      conditions.push(`j.location LIKE ?`);
      params.push(`%${location.trim()}%`);
    }
    if (type.trim()) {
      conditions.push(`j.type = ?`);
      params.push(type.trim());
    }
    if (department.trim()) {
      conditions.push(`j.department = ?`);
      params.push(department.trim());
    }
    if (experience.trim()) {
      conditions.push(`j.experience = ?`);
      params.push(experience.trim());
    }

    const whereSQL = `WHERE ${conditions.join(" AND ")}`;

    const [[jobs], [[{ total }]]] = await Promise.all([
      pool.query(
        `SELECT j.id, j.company_id, j.title, j.department, j.location, j.type,
                j.experience, j.salary, j.description, j.skills, j.status,
                j.applicants, j.posted AS posted,
                c.companyName AS companyName, c.logo AS companyLogo
         FROM jobs j
         LEFT JOIN company_details c ON c.id = j.company_id
         ${whereSQL} ORDER BY j.posted DESC LIMIT ? OFFSET ?`,
        [...params, limitNum, offset],
      ),
      pool.query(`SELECT COUNT(*) AS total FROM jobs j ${whereSQL}`, params),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,
      data: {
        jobs,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
        filters: { q, location, type, department, experience },
      },
    });
  } catch (err) {
    console.error("[searchJobs]", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch jobs.",
      ...(process.env.NODE_ENV === "development" && { error: err.message }),
    });
  }
};

const getJob = async (req, res) => {
  try {
    const { id } = req.params;
    const [[job]] = await pool.query(
      `SELECT j.id, j.company_id, j.title, j.department, j.location, j.type FROM jobs j WHERE j.id = ? LIMIT 1`,
      [id],
    );
    if (!job)
      return res
        .status(404)
        .json({ success: false, message: "Job not found." });
    return res.status(200).json({ success: true, data: job });
  } catch (err) {
    console.error("[getJobById]", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch job.",
      ...(process.env.NODE_ENV === "development" && { error: err.message }),
    });
  }
};

// ─── Shared helpers ───────────────────────────────────────────

const shapeJob = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  department: row.department,
  location: row.location,
  type: row.type,
  experience: row.experience,
  salary: row.salary,
  status: row.status,
  skills: (() => {
    if (!row.skills) return [];
    try {
      return JSON.parse(row.skills);
    } catch {
      return row.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  })(),
  companyName: row.companyName || null,
  companyLogo: row.companyLogo || null,
  posted: row.created_at,
});

const JOB_SELECT = `
  j.id, j.title, j.description, j.department, j.location,
  j.type, j.experience, j.salary, j.status, j.skills, j.created_at,
  c.companyName AS companyName,
  c.logo   AS companyLogo
  FROM jobs j
  LEFT JOIN company_details c ON c.id = j.company_id
`;

// ─── Public job detail (with company join) ────────────────────

const getJobById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [rows] = await pool.execute(
    `SELECT ${JOB_SELECT} WHERE j.id = ? AND j.status = 'active'`,
    [id],
  );

  if (!rows[0]) throw new APIERR(404, "Job not found");
  res
    .status(200)
    .json(new APIRES(200, shapeJob(rows[0]), "Job fetched successfully"));
});

// ─── Saved jobs ───────────────────────────────────────────────

const saveJob = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { jobId } = req.params;

  const [jobCheck] = await pool.execute(
    `SELECT id FROM jobs WHERE id = ? AND status = 'active'`,
    [jobId],
  );
  if (!jobCheck[0]) throw new APIERR(404, "Job not found");

  await pool.execute(
    `INSERT IGNORE INTO saved_jobs (user_id, job_id) VALUES (?, ?)`,
    [userId, jobId],
  );
  res
    .status(200)
    .json(new APIRES(200, { saved: true }, "Job saved successfully"));
});

const unsaveJob = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { jobId } = req.params;

  await pool.execute(
    `DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?`,
    [userId, jobId],
  );
  res
    .status(200)
    .json(new APIRES(200, { saved: false }, "Job removed from saved"));
});

const getSavedJobs = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const offset = (page - 1) * limit;

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM saved_jobs WHERE user_id = ?`,
    [userId],
  );

  const [rows] = await pool.execute(
    `SELECT ${JOB_SELECT}
     INNER JOIN saved_jobs sj ON sj.job_id = j.id
     WHERE sj.user_id = ?
     ORDER BY sj.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset],
  );

  res.status(200).json(
    new APIRES(
      200,
      {
        jobs: rows.map(shapeJob),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
      "Saved jobs fetched successfully",
    ),
  );
});

const checkSavedJob = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { jobId } = req.params;

  const [rows] = await pool.execute(
    `SELECT id FROM saved_jobs WHERE user_id = ? AND job_id = ?`,
    [userId, jobId],
  );
  res
    .status(200)
    .json(new APIRES(200, { saved: rows.length > 0 }, "Check complete"));
});

module.exports = {
  createJob,
  getAllJobs,
  getCompanyJobById,
  getJobCounts,
  updateJob,
  toggleJobStatus,
  incrementApplicants,
  deleteJob,
  getPublicJobs,
  getJobById,
  getJob,
  searchJobs,
  saveJob,
  unsaveJob,
  getSavedJobs,
  checkSavedJob,
};
