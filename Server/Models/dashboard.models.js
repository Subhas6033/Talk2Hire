const { pool } = require("../Config/database.config.js");

const Dashboard = {
  // ── Stat cards ─────────────────────────────────────────────
  // Active jobs, total applicants, interviews done, hired this month
  async getStats(companyId) {
    const [rows] = await pool.execute(
      `SELECT
        -- Active jobs
        COUNT(DISTINCT CASE WHEN j.status = 'active' THEN j.id END)          AS activeJobs,

        -- Total applicants across all company jobs
        COALESCE(SUM(j.applicants), 0)                                         AS totalApplicants,

        -- Total interviews conducted for this company's jobs
        COUNT(DISTINCT i.id)                                                   AS interviewsDone,

        -- Hired this calendar month
        COUNT(DISTINCT CASE
          WHEN i.status = 'hired'
           AND MONTH(i.updated_at) = MONTH(CURRENT_DATE)
           AND YEAR(i.updated_at)  = YEAR(CURRENT_DATE)
          THEN i.id
        END)                                                                   AS hiredThisMonth,

        -- Change helpers (last 30 days)
        COUNT(DISTINCT CASE
          WHEN j.status = 'active'
           AND j.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          THEN j.id
        END)                                                                   AS newJobsThisMonth,

        COUNT(DISTINCT CASE
          WHEN i.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          THEN i.id
        END)                                                                   AS interviewsThisWeek,

        COUNT(DISTINCT CASE
          WHEN i.status = 'hired'
           AND MONTH(i.updated_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))
           AND YEAR(i.updated_at)  = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))
          THEN i.id
        END)                                                                   AS hiredLastMonth
      FROM jobs j
      LEFT JOIN interviews i ON i.job_id = j.id
      WHERE j.company_id = ?`,
      [companyId],
    );
    return rows[0];
  },

  // ── Hiring pipeline ────────────────────────────────────────
  async getPipeline(companyId) {
    const [rows] = await pool.execute(
      `SELECT
        COALESCE(SUM(j.applicants), 0)                                  AS applied,
        COUNT(DISTINCT i.id)                                             AS interviewed,
        COUNT(DISTINCT CASE WHEN i.status = 'pending'  THEN i.id END)  AS underReview,
        COUNT(DISTINCT CASE WHEN i.status = 'hired'    THEN i.id END)  AS hired
      FROM jobs j
      LEFT JOIN interviews i ON i.job_id = j.id
      WHERE j.company_id = ?`,
      [companyId],
    );
    return rows[0];
  },

  // ── Recent jobs (last 5) ───────────────────────────────────
  async getRecentJobs(companyId) {
    const [rows] = await pool.execute(
      `SELECT
        j.id,
        j.title,
        j.department   AS dept,
        j.location,
        j.applicants,
        j.status,
        j.posted
      FROM jobs j
      WHERE j.company_id = ?
      ORDER BY j.created_at DESC
      LIMIT 5`,
      [companyId],
    );

    return rows.map((r) => ({
      ...r,
      posted: formatPostedDate(r.posted),
    }));
  },

  // ── Recent interviews (last 5) ─────────────────────────────
  async getRecentInterviews(companyId) {
    const [rows] = await pool.execute(
      `SELECT
        i.id,
        i.candidate_name  AS candidate,
        j.title           AS role,
        i.score,
        i.status,
        i.created_at      AS date,
        i.avatar
      FROM interviews i
      JOIN jobs j ON j.id = i.job_id
      WHERE j.company_id = ?
      ORDER BY i.created_at DESC
      LIMIT 5`,
      [companyId],
    );

    return rows.map((r) => ({
      ...r,
      avatar: r.avatar || generateAvatar(r.candidate),
      date: formatInterviewDate(r.created_at || r.date),
    }));
  },

  // ── All-in-one dashboard fetch (single round trip) ─────────
  async getDashboardData(companyId) {
    const [stats, pipeline, recentJobs, recentInterviews] = await Promise.all([
      this.getStats(companyId),
      this.getPipeline(companyId),
      this.getRecentJobs(companyId),
      this.getRecentInterviews(companyId),
    ]);

    return { stats, pipeline, recentJobs, recentInterviews };
  },
};

function formatPostedDate(date) {
  if (!date) return "";
  const now = new Date();
  const posted = new Date(date);
  const diffMs = now - posted;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

function formatInterviewDate(date) {
  if (!date) return "";
  const now = new Date();
  const d = new Date(date);
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function generateAvatar(name = "") {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

module.exports = Dashboard;
