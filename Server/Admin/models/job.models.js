const { pool } = require("../../Config/database.config.js");

// ─── Job Model ────────────────────────────────────────────────
const Job = {
  // ── CREATE ─────────────────────────────────────────────────
  async create(data) {
    const {
      company_id,
      title,
      department,
      location,
      type = "Full-time",
      experience,
      salary = null,
      status = "active",
      description,
      responsibilities = null,
      requirements = null,
      skills = [],
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO jobs
       (company_id, title, department, location, type, experience, salary,
        status, description, responsibilities, requirements, skills, posted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)`,
      [
        company_id,
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
        JSON.stringify(skills),
      ],
    );

    return { id: result.insertId, ...data, applicants: 0 };
  },

  // ── FIND ALL ────────────────────────────────────────────────
  async findAll(filters = {}) {
    const conditions = ["company_id = ?"];
    const params = [filters.company_id];

    if (filters.status && filters.status !== "all") {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters.department && filters.department !== "all") {
      conditions.push("department = ?");
      params.push(filters.department);
    }
    if (filters.search) {
      conditions.push("(title LIKE ? OR department LIKE ?)");
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const [rows] = await pool.execute(
      `SELECT * FROM jobs ${where} ORDER BY created_at DESC`,
      params,
    );

    return rows.map(parseRow);
  },

  // ── FIND ALL PUBLIC (for candidates — joins company info) ───
  async findAllPublic({ search, department, location, type, experience } = {}) {
    let query = `
      SELECT j.*, cd.companyName, cd.companyLocation, cd.industry
      FROM jobs j
      LEFT JOIN company_details cd ON j.company_id = cd.id
      WHERE j.status = 'active'
    `;
    const params = [];

    if (search) {
      query += ` AND (j.title LIKE ? OR j.description LIKE ? OR cd.companyName LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (department) {
      query += ` AND j.department = ?`;
      params.push(department);
    }
    if (location) {
      query += ` AND j.location LIKE ?`;
      params.push(`%${location}%`);
    }
    if (type) {
      query += ` AND j.type = ?`;
      params.push(type);
    }
    if (experience) {
      query += ` AND j.experience = ?`;
      params.push(experience);
    }

    query += ` ORDER BY j.created_at DESC`;

    const [rows] = await pool.execute(query, params);
    return rows.map(parseRow);
  },

  // ── FIND BY ID ──────────────────────────────────────────────
  async findById(id) {
    const [rows] = await pool.execute("SELECT * FROM jobs WHERE id = ?", [id]);
    return rows.length ? parseRow(rows[0]) : null;
  },

  // ── UPDATE ──────────────────────────────────────────────────
  async update(id, data) {
    const allowed = [
      "title",
      "department",
      "location",
      "type",
      "experience",
      "salary",
      "status",
      "description",
      "responsibilities",
      "requirements",
      "skills",
    ];

    const fields = [];
    const params = [];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(key === "skills" ? JSON.stringify(data[key]) : data[key]);
      }
    }

    if (!fields.length) throw new Error("No valid fields to update");

    params.push(id);
    await pool.execute(
      `UPDATE jobs SET ${fields.join(", ")} WHERE id = ?`,
      params,
    );

    return this.findById(id);
  },

  // ── TOGGLE STATUS ───────────────────────────────────────────
  async toggleStatus(id) {
    await pool.execute(
      `UPDATE jobs
       SET status = IF(status = 'active', 'closed', 'active')
       WHERE id = ?`,
      [id],
    );
    return this.findById(id);
  },

  // ── INCREMENT APPLICANTS ────────────────────────────────────
  async incrementApplicants(id) {
    await pool.execute(
      "UPDATE jobs SET applicants = applicants + 1 WHERE id = ?",
      [id],
    );
  },

  // ── DELETE ──────────────────────────────────────────────────
  async delete(id) {
    const [result] = await pool.execute("DELETE FROM jobs WHERE id = ?", [id]);
    return result.affectedRows > 0;
  },

  // ── COUNTS BY STATUS ────────────────────────────────────────
  async getCounts(company_id) {
    const [rows] = await pool.execute(
      "SELECT status, COUNT(*) AS count FROM jobs WHERE company_id = ? GROUP BY status",
      [company_id],
    );
    const counts = { all: 0, active: 0, closed: 0, draft: 0 };
    rows.forEach(({ status, count }) => {
      counts[status] = Number(count);
      counts.all += Number(count);
    });
    return counts;
  }, // ← comma, not semicolon (it's an object method, not a standalone function)
}; // ← closes the Job object

// ─── Helper: parse JSON skills & format posted date ───────────
function parseRow(row) {
  return {
    ...row,
    skills:
      typeof row.skills === "string"
        ? JSON.parse(row.skills)
        : (row.skills ?? []),
    posted: row.posted
      ? new Date(row.posted).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null,
  };
}

module.exports = Job;
