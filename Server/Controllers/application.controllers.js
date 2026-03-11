const { pool } = require("../Config/database.config.js");

const getMyApplications = async (req, res) => {
  try {
    const userId = req.user.id;

    const [applications] = await pool.query(
      `SELECT
        i.id,
        i.status,
        i.created_at          AS appliedAt,
        NULL                  AS notes,
        0                     AS starred,
        j.id                  AS jobId,
        j.title               AS role,
        j.type,
        j.location,
        j.salary,
        j.department,
        j.skills,
        c.id                  AS companyId,
        c.companyName         AS company,
        c.logo                AS companyLogo
      FROM interviews i
      JOIN jobs j             ON j.id = i.job_id
      JOIN company_details c  ON c.id = j.company_id
      WHERE i.user_id = ?
      ORDER BY i.created_at DESC`,
      [userId],
    );

    return res.status(200).json({ success: true, data: applications });
  } catch (err) {
    console.error("[getMyApplications]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const VALID = ["applied", "screening", "interviewing", "offer", "rejected"];
    if (!VALID.includes(status))
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });

    const [result] = await pool.query(
      `UPDATE applications SET status = ? WHERE id = ? AND user_id = ?`,
      [status, id, userId],
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ success: false, message: "Application not found" });

    return res
      .status(200)
      .json({ success: true, data: { id: Number(id), status } });
  } catch (err) {
    console.error("[updateApplicationStatus]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const toggleApplicationStar = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [[app]] = await pool.query(
      `SELECT starred FROM applications WHERE id = ? AND user_id = ?`,
      [id, userId],
    );
    if (!app)
      return res.status(404).json({ success: false, message: "Not found" });

    const newStarred = app.starred ? 0 : 1;
    await pool.query(
      `UPDATE applications SET starred = ? WHERE id = ? AND user_id = ?`,
      [newStarred, id, userId],
    );

    return res
      .status(200)
      .json({ success: true, data: { id: Number(id), starred: !!newStarred } });
  } catch (err) {
    console.error("[toggleApplicationStar]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [result] = await pool.query(
      `DELETE FROM applications WHERE id = ? AND user_id = ?`,
      [id, userId],
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: "Not found" });

    return res.status(200).json({ success: true, data: { id: Number(id) } });
  } catch (err) {
    console.error("[deleteApplication]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateApplicationNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user.id;

    await pool.query(
      `UPDATE applications SET notes = ? WHERE id = ? AND user_id = ?`,
      [notes, id, userId],
    );

    return res
      .status(200)
      .json({ success: true, data: { id: Number(id), notes } });
  } catch (err) {
    console.error("[updateApplicationNotes]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getMyApplications,
  updateApplicationStatus,
  toggleApplicationStar,
  deleteApplication,
  updateApplicationNotes,
};
