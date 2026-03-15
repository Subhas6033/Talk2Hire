const { CompanyInterview } = require("../Models/companyInterview.models.js");
const { asyncHandler, APIERR, APIRES } = require("../Utils/index.utils.js");

const DECIDABLE_STATUSES = ["pending", "completed"];

const getAllInterviews = asyncHandler(async (req, res) => {
  const { status, job_id, search } = req.query;
  const company_id = req.company.id;

  const [interviews, counts, jobs] = await Promise.all([
    CompanyInterview.findAll({ company_id, status, job_id, search }),
    CompanyInterview.getCounts(company_id),
    CompanyInterview.getJobsWithInterviews(company_id),
  ]);

  return res
    .status(200)
    .json(
      new APIRES(
        200,
        { interviews, counts, jobs },
        "Interviews fetched successfully",
      ),
    );
});

const getInterviewCounts = asyncHandler(async (req, res) => {
  const counts = await CompanyInterview.getCounts(req.company.id);
  return res
    .status(200)
    .json(new APIRES(200, counts, "Counts fetched successfully"));
});

const getInterviewById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) throw new APIERR(400, "Invalid interview ID");

  const interview = await CompanyInterview.findById(Number(id));
  if (!interview) throw new APIERR(404, "Interview not found");

  if (interview.company_id !== req.company.id)
    throw new APIERR(403, "Access denied.");

  return res
    .status(200)
    .json(new APIRES(200, interview, "Interview fetched successfully"));
});

const hireCandidate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) throw new APIERR(400, "Invalid interview ID");

  const interview = await CompanyInterview.findById(Number(id));
  if (!interview) throw new APIERR(404, "Interview not found");
  if (interview.company_id !== req.company.id)
    throw new APIERR(403, "Access denied.");
  if (!DECIDABLE_STATUSES.includes(interview.status))
    throw new APIERR(
      400,
      `Cannot hire: current status is "${interview.status}"`,
    );

  const updated = await CompanyInterview.updateStatus(Number(id), "hired");
  return res
    .status(200)
    .json(new APIRES(200, updated, "Candidate hired successfully"));
});

const rejectCandidate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) throw new APIERR(400, "Invalid interview ID");

  const interview = await CompanyInterview.findById(Number(id));
  if (!interview) throw new APIERR(404, "Interview not found");
  if (interview.company_id !== req.company.id)
    throw new APIERR(403, "Access denied.");
  if (!DECIDABLE_STATUSES.includes(interview.status))
    throw new APIERR(
      400,
      `Cannot reject: current status is "${interview.status}"`,
    );

  const updated = await CompanyInterview.updateStatus(Number(id), "rejected");
  return res
    .status(200)
    .json(new APIRES(200, updated, "Candidate rejected successfully"));
});

module.exports = {
  getAllInterviews,
  getInterviewCounts,
  getInterviewById,
  hireCandidate,
  rejectCandidate,
};
