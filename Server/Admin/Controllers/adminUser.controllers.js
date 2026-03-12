const { asyncHandler, APIERR, APIRES } = require("../../Utils/index.utils.js");
const { pool } = require("../../Config/database.config.js");

const getUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;
  const search = req.query.search?.trim() || "";
  const sortBy = ["fullName", "email", "created_at"].includes(req.query.sortBy)
    ? req.query.sortBy
    : "created_at";
  const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";

  let where = "WHERE role = 'user'";
  const params = [];

  if (search) {
    where += " AND (fullName LIKE ? OR email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM users ${where}`,
    params,
  );

  const [users] = await pool.execute(
    `SELECT id, fullName, email, mobile, location, profile_image_path, role, created_at
     FROM users ${where}
     ORDER BY ${sortBy} ${sortOrder}
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );

  res.status(200).json(
    new APIRES(
      200,
      {
        users,
        pagination: {
          total: Number(total),
          page,
          limit,
          totalPages: Math.ceil(Number(total) / limit),
          hasNext: page < Math.ceil(Number(total) / limit),
          hasPrev: page > 1,
        },
      },
      "Users fetched",
    ),
  );
});

const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [[user]] = await pool.execute(
    `SELECT id, fullName, email, mobile, location, profile_image_path, role, created_at
     FROM users WHERE id = ? AND role = 'user'`,
    [id],
  );
  if (!user) throw new APIERR(404, "User not found.");
  res.status(200).json(new APIRES(200, { user }, "User fetched"));
});

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [result] = await pool.execute(
    "DELETE FROM users WHERE id = ? AND role = 'user'",
    [id],
  );
  if (result.affectedRows === 0) throw new APIERR(404, "User not found.");
  res.status(200).json(new APIRES(200, null, "User deleted."));
});

module.exports = { getUsers, getUserById, deleteUser };
