const { pool } = require("../Config/database.config");
const { asyncHandler, APIERR, APIRES } = require("../Utils/index.utils");

const parseDetails = (v) => ({
  ...v,
  details:
    typeof v.details === "string"
      ? (() => {
          try {
            return JSON.parse(v.details);
          } catch {
            return {};
          }
        })()
      : (v.details ?? {}),
});

// Verify the interview belongs to this company before returning violation data
const verifyCompanyOwnership = async (interviewId, companyId) => {
  const [[row]] = await pool.execute(
    `SELECT i.id FROM interviews i
     INNER JOIN jobs j ON j.id = i.job_id
     WHERE i.id = ? AND j.company_id = ?`,
    [interviewId, companyId],
  );
  if (!row) throw new APIERR(404, "Interview not found");
};

// GET /api/v1/company/violation/:interviewId — full timeline for one interview
const getViolations = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;
  const companyId = req.user?.id;
  if (!companyId) throw new APIERR(401, "Unauthorized");

  await verifyCompanyOwnership(interviewId, companyId);

  const [rows] = await pool.execute(
    `SELECT id, interview_id, user_id, violation_type,
            start_time, end_time, duration_seconds,
            warning_count, resolved, details, created_at
     FROM interview_violations
     WHERE interview_id = ?
     ORDER BY start_time ASC`,
    [interviewId],
  );

  const violations = rows.map(parseDetails);
  res
    .status(200)
    .json(new APIRES(200, { violations, total: violations.length }, "OK"));
});

// GET /api/v1/company/violation/summary/:interviewId — grouped by type
const getViolationSummary = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;
  const companyId = req.user?.id;
  if (!companyId) throw new APIERR(401, "Unauthorized");

  await verifyCompanyOwnership(interviewId, companyId);

  const [summary] = await pool.execute(
    `SELECT
        violation_type,
        COUNT(*)                              AS occurrences,
        SUM(warning_count)                    AS total_warnings,
        SUM(COALESCE(duration_seconds, 0))    AS total_duration_seconds,
        MIN(start_time)                       AS first_occurrence,
        MAX(start_time)                       AS last_occurrence
     FROM interview_violations
     WHERE interview_id = ?
     GROUP BY violation_type
     ORDER BY occurrences DESC`,
    [interviewId],
  );

  res.status(200).json(new APIRES(200, { summary }, "OK"));
});

// GET /api/v1/company/violation/company — all violations across all company interviews
const getCompanyViolations = asyncHandler(async (req, res) => {
  const companyId = req.user?.id;
  if (!companyId) throw new APIERR(401, "Unauthorized");

  const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
  const limit = Math.min(100, parseInt(req.query.limit ?? "20", 10));
  const type = req.query.type ?? null;
  const offset = (page - 1) * limit;

  const typeFilter = type ? "AND iv.violation_type = ?" : "";
  const params = type
    ? [companyId, type, limit, offset]
    : [companyId, limit, offset];

  const [rows] = await pool.execute(
    `SELECT
        i.id              AS interview_id,
        i.candidate_name,
        i.created_at      AS interview_date,
        iv.violation_type,
        iv.start_time,
        iv.end_time,
        iv.duration_seconds,
        iv.warning_count,
        iv.resolved,
        iv.details,
        iv.id             AS violation_id
     FROM interview_violations iv
     JOIN interviews i ON i.id = iv.interview_id
     JOIN jobs j       ON j.id = i.job_id
     WHERE j.company_id = ? ${typeFilter}
     ORDER BY iv.start_time DESC
     LIMIT ? OFFSET ?`,
    params,
  );

  const countParams = type ? [companyId, type] : [companyId];
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM interview_violations iv
     JOIN interviews i ON i.id = iv.interview_id
     JOIN jobs j       ON j.id = i.job_id
     WHERE j.company_id = ? ${typeFilter}`,
    countParams,
  );

  res.status(200).json(
    new APIRES(
      200,
      {
        violations: rows.map(parseDetails),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
      "OK",
    ),
  );
});

module.exports = { getViolations, getViolationSummary, getCompanyViolations };
