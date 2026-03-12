const { asyncHandler, APIERR, APIRES } = require("../../Utils/index.utils.js");
const { pool } = require("../../Config/database.config.js");

const getAdminStats = asyncHandler(async (req, res) => {
  const [
    [usersRow],
    [companiesRow],
    [jobsRow],
    [blogsRow],
    usersThisWeek,
    companiesThisWeek,
    jobsThisWeek,
    blogsThisWeek,
    recentUsers,
    recentCompanies,
    weeklyScreenings,
    activityFeed,
  ] = await Promise.all([
    pool.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'user'"),
    pool.execute("SELECT COUNT(*) AS total FROM company_details"),
    pool.execute("SELECT COUNT(*) AS total FROM jobs"),
    pool.execute("SELECT COUNT(*) AS total FROM blog_details"),

    pool.execute(
      "SELECT COUNT(*) AS total FROM users WHERE role = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
    ),
    pool.execute(
      "SELECT COUNT(*) AS total FROM company_details WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
    ),
    pool.execute(
      "SELECT COUNT(*) AS total FROM jobs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
    ),
    pool.execute(
      "SELECT COUNT(*) AS total FROM blog_details WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
    ),

    pool.execute(
      `SELECT u.id, u.fullName, u.email, u.created_at, u.profile_image_path,
              'Candidate' AS type
       FROM users u WHERE u.role = 'user'
       ORDER BY u.created_at DESC LIMIT 4`,
    ),
    pool.execute(
      `SELECT c.id, c.companyName AS fullName, c.companyMail AS email, c.created_at,
              c.logo AS profile_image_path, 'Company' AS type
       FROM company_details c
       ORDER BY c.created_at DESC LIMIT 2`,
    ),

    pool.execute(
      `SELECT DAYNAME(created_at) AS day, DAYOFWEEK(created_at) AS dow,
              COUNT(*) AS val
       FROM interviews
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at), DAYNAME(created_at), DAYOFWEEK(created_at)
       ORDER BY dow`,
    ),

    pool.execute(
      `SELECT 'interview' AS type, i.candidate_name AS name,
              CONCAT(ROUND(i.score), '% score') AS detail,
              i.created_at
       FROM interviews i
       ORDER BY i.created_at DESC LIMIT 3`,
    ),
  ]);

  const totalUsers = Number(usersRow[0].total);
  const totalCompanies = Number(companiesRow[0].total);
  const totalJobs = Number(jobsRow[0].total);
  const totalBlogs = Number(blogsRow[0].total);

  const newUsers = Number(usersThisWeek[0].total);
  const newCompanies = Number(companiesThisWeek[0].total);
  const newJobs = Number(jobsThisWeek[0].total);
  const newBlogs = Number(blogsThisWeek[0].total);

  const pct = (part, total) =>
    total > 0 ? `${Math.round((part / total) * 100)}%` : "0%";

  const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
  const weekMap = {};
  weeklyScreenings[0].forEach((r) => {
    weekMap[r.dow] = { day: DAY_LABELS[r.dow - 1], val: Number(r.val) };
  });
  const WEEK = [1, 2, 3, 4, 5, 6, 7].map(
    (dow) => weekMap[dow] ?? { day: DAY_LABELS[dow - 1], val: 0 },
  );

  const combined = [...recentUsers[0], ...recentCompanies[0]].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );
  const RECENT = combined.slice(0, 6).map((u) => {
    const diff = Date.now() - new Date(u.created_at).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    const timeAgo =
      days > 0 ? `${days}d ago` : hrs > 0 ? `${hrs}h ago` : `${mins}m ago`;
    const initials = (u.fullName || "??")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return {
      name: u.fullName,
      role: u.type,
      status: "Active",
      init: initials,
      time: timeAgo,
      avatar: u.profile_image_path ?? null,
    };
  });

  const ACTIVITY = activityFeed[0].map((r) => {
    const diff = Date.now() - new Date(r.created_at).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const timeAgo = hrs > 0 ? `${hrs}h` : `${mins}m`;
    return {
      label: "Interview done",
      name: r.name,
      detail: r.detail,
      color: "bg-emerald-500",
      time: timeAgo,
    };
  });

  res.status(200).json(
    new APIRES(
      200,
      {
        stats: {
          totalUsers,
          totalCompanies,
          totalJobs,
          totalBlogs,
          usersWeeklyGrowth: pct(newUsers, totalUsers),
          companiesWeeklyGrowth: pct(newCompanies, totalCompanies),
          jobsWeeklyGrowth: pct(newJobs, totalJobs),
          blogsWeeklyChange: newBlogs,
        },
        weeklyScreenings: WEEK,
        recentActivity: RECENT,
        activityFeed: ACTIVITY,
      },
      "Admin stats fetched",
    ),
  );
});

module.exports = { getAdminStats };
