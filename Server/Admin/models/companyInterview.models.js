const { pool } = require("../../Config/database.config.js");
const { APIERR } = require("../../Utils/index.utils.js");

const CompanyInterview = {
  async findAll({ company_id, status, job_id, search } = {}) {
    const db = await pool;

    // Filter by company through the jobs table
    const conditions = ["j.company_id = ?"];
    const params = [company_id];

    if (status && status !== "all") {
      conditions.push("i.status = ?");
      params.push(status);
    }

    if (job_id && job_id !== "all") {
      conditions.push("i.job_id = ?");
      params.push(Number(job_id));
    }

    if (search) {
      conditions.push(
        "(u.fullName LIKE ? OR u.email LIKE ? OR j.title LIKE ?)",
      );
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const where = conditions.join(" AND ");

    const [rows] = await db.execute(
      `SELECT
         i.id,
         i.user_id,
         i.status,
         i.score,
         i.duration,
         i.summary,
         i.strengths,
         i.improvements,
         i.color,
         i.screen_recording_url,
         i.primary_recording_url,
         i.mobile_recording_url,
         i.created_at,

         u.fullName    AS candidate_name,
         u.email       AS candidate_email,
         u.mobile      AS candidate_phone,
         u.location    AS candidate_location,
         u.skills      AS candidate_skills,

         j.id          AS job_id,
         j.title       AS job_title

       FROM interviews i
       INNER JOIN jobs  j ON j.id = i.job_id
       LEFT  JOIN users u ON u.id = i.user_id
       WHERE ${where}
       ORDER BY i.created_at DESC`,
      params,
    );

    return rows.map(_shape);
  },

  async findById(interviewId) {
    const db = await pool;

    const [[row]] = await db.execute(
      `SELECT
         i.id,
         i.user_id,
         i.status,
         i.score,
         i.duration,
         i.summary,
         i.strengths,
         i.improvements,
         i.color,
         i.screen_recording_url,
         i.primary_recording_url,
         i.mobile_recording_url,
         i.created_at,

         u.fullName    AS candidate_name,
         u.email       AS candidate_email,
         u.mobile      AS candidate_phone,
         u.location    AS candidate_location,
         u.skills      AS candidate_skills,

         j.id          AS job_id,
         j.title       AS job_title,
         j.company_id  AS company_id

       FROM interviews i
       INNER JOIN jobs  j ON j.id = i.job_id
       LEFT  JOIN users u ON u.id = i.user_id
       WHERE i.id = ?
       LIMIT 1`,
      [interviewId],
    );

    if (!row) return null;

    const [answers] = await db.execute(
      `SELECT id, question, score, time_taken, order_index
       FROM interview_answers
       WHERE interview_id = ?
       ORDER BY order_index ASC`,
      [interviewId],
    );

    const videos = _buildVideos(row);

    return { ..._shape(row), answers, videos };
  },

  async getCounts(company_id) {
    const db = await pool;

    const [rows] = await db.execute(
      `SELECT i.status, COUNT(*) AS cnt
       FROM interviews i
       INNER JOIN jobs j ON j.id = i.job_id
       WHERE j.company_id = ?
       GROUP BY i.status`,
      [company_id],
    );

    const counts = { all: 0, pending: 0, hired: 0, rejected: 0 };
    rows.forEach(({ status, cnt }) => {
      counts[status] = Number(cnt);
      counts.all += Number(cnt);
    });

    const [[scoreRow]] = await db.execute(
      `SELECT ROUND(AVG(i.score), 0) AS avg_score
       FROM interviews i
       INNER JOIN jobs j ON j.id = i.job_id
       WHERE j.company_id = ?`,
      [company_id],
    );
    counts.avg_score = Number(scoreRow.avg_score ?? 0);

    return counts;
  },

  async getJobsWithInterviews(company_id) {
    const db = await pool;

    const [rows] = await db.execute(
      `SELECT j.id, j.title, COUNT(i.id) AS applicants
       FROM jobs j
       INNER JOIN interviews i ON i.job_id = j.id
       WHERE j.company_id = ?
       GROUP BY j.id, j.title
       ORDER BY j.title ASC`,
      [company_id],
    );

    return rows;
  },

  async updateStatus(interviewId, newStatus) {
    const db = await pool;

    const [result] = await db.execute(
      "UPDATE interviews SET status = ?, updated_at = NOW() WHERE id = ?",
      [newStatus, interviewId],
    );

    if (result.affectedRows === 0)
      throw new APIERR(500, "Failed to update interview status");

    return this.findById(interviewId);
  },
};

/* ── Private helpers ──────────────────────────────────────────────────────── */

function _parse(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function _shape(row) {
  const skills = row.candidate_skills
    ? String(row.candidate_skills)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const name = row.candidate_name ?? "Unknown";

  const avatar =
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => (w[0] ?? "").toUpperCase())
      .join("") || "??";

  return {
    id: row.id,
    status: row.status ?? "pending",
    score: row.score ?? 0,
    duration: row.duration ?? null,
    summary: row.summary ?? null,
    strengths: _parse(row.strengths) ?? [],
    improvements: _parse(row.improvements) ?? [],
    color: row.color ?? "#6366f1",
    created_at: row.created_at,
    // company_id is on the jobs row — expose it so the controller
    // can do the ownership check without a second query
    company_id: row.company_id ?? null,

    candidate: {
      id: row.user_id ?? null,
      name,
      avatar,
      email: row.candidate_email ?? null,
      phone: row.candidate_phone ?? null,
      location: row.candidate_location ?? null,
      experience: null,
      skills,
    },

    job: {
      id: row.job_id ?? null,
      title: row.job_title ?? "Unknown Position",
    },
  };
}

function _buildVideos(row) {
  return {
    screen: {
      url: row.screen_recording_url ?? null,
      available: !!row.screen_recording_url,
    },
    primary: {
      url: row.primary_recording_url ?? null,
      available: !!row.primary_recording_url,
    },
    mobile: {
      url: row.mobile_recording_url ?? null,
      available: !!row.mobile_recording_url,
    },
  };
}

module.exports = { CompanyInterview };
