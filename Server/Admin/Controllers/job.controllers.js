const Job = require("../models/job.models.js");
const { APIERR, APIRES, asyncHandler } = require("../../Utils/index.utils.js");

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

const getJobById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) throw new APIERR(400, "Invalid job ID");

  const job = await Job.findById(Number(id));
  if (!job) throw new APIERR(404, "Job not found");

  // Prevent companies from accessing other companies' jobs
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

const getPublicJobById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) throw new APIERR(400, "Invalid job ID");

  const job = await Job.findById(Number(id));
  if (!job) throw new APIERR(404, "Job not found");
  if (job.status !== "active") throw new APIERR(404, "Job not found");

  return res.status(200).json(new APIRES(200, job, "Job fetched successfully"));
});

module.exports = {
  createJob,
  getAllJobs,
  getJobById,
  getJobCounts,
  updateJob,
  toggleJobStatus,
  incrementApplicants,
  deleteJob,
  getPublicJobs,
  getPublicJobById,
};
