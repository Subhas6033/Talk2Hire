const { pool } = require("../Config/database.config.js");

const generateSlug = (title) => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 280);
};

const makeUniqueSlug = async (connection, baseSlug, excludeId = null) => {
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const query = excludeId
      ? `SELECT id FROM blog_details WHERE slug = ? AND id != ? LIMIT 1`
      : `SELECT id FROM blog_details WHERE slug = ? LIMIT 1`;
    const params = excludeId ? [slug, excludeId] : [slug];
    const [rows] = await connection.query(query, params);
    if (rows.length === 0) return slug;
    slug = `${baseSlug}-${counter++}`;
  }
};

const BlogModel = {
  async create(data, authorId) {
    const connection = await pool.getConnection();
    try {
      const baseSlug = generateSlug(data.title);
      const slug = await makeUniqueSlug(connection, baseSlug);
      const publishedAt = data.status === "published" ? new Date() : null;

      const [result] = await connection.query(
        `INSERT INTO blog_details
          (title, subtitle, slug, content, excerpt, cover_image,
           category, tags, status, word_count, read_time,
           seo_title, seo_description, author_id, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.title,
          data.subtitle || null,
          slug,
          data.content || null,
          data.excerpt || null,
          data.cover_image || null,
          data.category || null,
          data.tags ? JSON.stringify(data.tags) : null,
          data.status || "draft",
          data.word_count || 0,
          data.read_time || 1,
          data.seo_title || null,
          data.seo_description || null,
          authorId,
          publishedAt,
        ],
      );
      return { id: result.insertId, slug };
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT b.*, a.full_name AS author_name, a.username AS author_username
       FROM blog_details b
       LEFT JOIN admins a ON a.id = b.author_id
       WHERE b.id = ? AND b.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    if (!rows[0]) return null;
    if (rows[0].tags) rows[0].tags = JSON.parse(rows[0].tags);
    return rows[0];
  },

  async findBySlug(slug) {
    const [rows] = await pool.query(
      `SELECT b.*, a.full_name AS author_name, a.username AS author_username
       FROM blog_details b
       LEFT JOIN admins a ON a.id = b.author_id
       WHERE b.slug = ? AND b.deleted_at IS NULL
       LIMIT 1`,
      [slug],
    );
    if (!rows[0]) return null;
    if (rows[0].tags) rows[0].tags = JSON.parse(rows[0].tags);
    return rows[0];
  },

  async findAll({ status, category, search, sortBy, page, limit } = {}) {
    const conditions = ["b.deleted_at IS NULL"];
    const params = [];

    if (status === "deleted") {
      conditions.length = 0;
      conditions.push("b.deleted_at IS NOT NULL");
    } else if (status && status !== "all") {
      conditions.push("b.status = ?");
      params.push(status);
    }

    if (category) {
      conditions.push("b.category = ?");
      params.push(category);
    }
    if (search) {
      conditions.push("(b.title LIKE ? OR b.excerpt LIKE ? OR b.tags LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const orderMap = {
      updatedAt: "b.updated_at DESC",
      createdAt: "b.created_at DESC",
      publishedAt: "b.published_at DESC",
      title: "b.title ASC",
      views: "b.views DESC",
      wordCount: "b.word_count DESC",
    };
    const orderClause = orderMap[sortBy] || "b.updated_at DESC";

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * pageSize;

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM blog_details b ${whereClause}`,
      params,
    );

    const [rows] = await pool.query(
      `SELECT b.id, b.title, b.subtitle, b.slug, b.excerpt, b.cover_image,
              b.category, b.tags, b.status, b.word_count, b.read_time,
              b.views, b.comments_count, b.author_id,
              a.full_name AS author_name, a.username AS author_username,
              b.published_at, b.created_at, b.updated_at
       FROM blog_details b
       LEFT JOIN admins a ON a.id = b.author_id
       ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    rows.forEach((r) => {
      if (r.tags) r.tags = JSON.parse(r.tags);
    });

    return {
      data: rows,
      pagination: {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async getStats() {
    const [[stats]] = await pool.query(`
      SELECT
        COUNT(*)                                          AS total,
        SUM(status = 'published' AND deleted_at IS NULL) AS published,
        SUM(status = 'draft'     AND deleted_at IS NULL) AS draft,
        SUM(deleted_at IS NOT NULL)                      AS deleted,
        COALESCE(SUM(CASE WHEN status = 'published' THEN views END), 0)     AS total_views,
        COALESCE(SUM(CASE WHEN deleted_at IS NULL THEN word_count END), 0)  AS total_words
      FROM blog_details
    `);
    return stats;
  },

  async update(id, data) {
    const connection = await pool.getConnection();
    try {
      const setParts = [];
      const params = [];

      if (data.title !== undefined) {
        const baseSlug = generateSlug(data.title);
        const slug = await makeUniqueSlug(connection, baseSlug, id);
        setParts.push("title = ?", "slug = ?");
        params.push(data.title, slug);
      }

      const simpleFields = [
        "subtitle",
        "content",
        "excerpt",
        "cover_image",
        "word_count",
        "read_time",
        "seo_title",
        "seo_description",
        "category", // free text — no validation needed
      ];
      simpleFields.forEach((f) => {
        if (data[f] !== undefined) {
          setParts.push(`${f} = ?`);
          params.push(data[f] ?? null);
        }
      });

      if (data.tags !== undefined) {
        setParts.push("tags = ?");
        params.push(data.tags ? JSON.stringify(data.tags) : null);
      }

      if (data.status !== undefined) {
        setParts.push("status = ?");
        params.push(data.status);

        if (data.status === "published") {
          setParts.push("published_at = COALESCE(published_at, NOW())");
        }
        if (data.status === "deleted") {
          setParts.push("deleted_at = NOW()");
        }
        if (data.status === "draft") {
          setParts.push("deleted_at = NULL");
        }
      }

      if (!setParts.length) return false;

      params.push(id);
      await connection.query(
        `UPDATE blog_details SET ${setParts.join(", ")} WHERE id = ?`,
        params,
      );
      return true;
    } finally {
      connection.release();
    }
  },

  async softDelete(id) {
    const [result] = await pool.query(
      `UPDATE blog_details SET status = 'deleted', deleted_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return result.affectedRows > 0;
  },

  async restore(id) {
    const [result] = await pool.query(
      `UPDATE blog_details SET status = 'draft', deleted_at = NULL
       WHERE id = ? AND deleted_at IS NOT NULL`,
      [id],
    );
    return result.affectedRows > 0;
  },

  async permanentDelete(id) {
    const [result] = await pool.query(
      `DELETE FROM blog_details WHERE id = ? AND deleted_at IS NOT NULL`,
      [id],
    );
    return result.affectedRows > 0;
  },

  async emptyTrash() {
    const [result] = await pool.query(
      `DELETE FROM blog_details WHERE deleted_at IS NOT NULL`,
    );
    return result.affectedRows;
  },

  async incrementViews(id) {
    await pool.query(
      `UPDATE blog_details SET views = views + 1
       WHERE id = ? AND status = 'published'`,
      [id],
    );
  },

  async findPublishedBySlug(slug) {
    const [rows] = await pool.query(
      `SELECT b.*, a.full_name AS author_name, a.username AS author_username
       FROM blog_details b
       LEFT JOIN admins a ON a.id = b.author_id
       WHERE b.slug = ? AND b.status = 'published' AND b.deleted_at IS NULL
       LIMIT 1`,
      [slug],
    );
    if (!rows[0]) return null;
    if (rows[0].tags) rows[0].tags = JSON.parse(rows[0].tags);
    return rows[0];
  },

  async findRelated(excludeId, category) {
    if (!category) return [];
    const [rows] = await pool.query(
      `SELECT id, title, slug, excerpt, cover_image, category,
              read_time, views, published_at
       FROM blog_details
       WHERE category = ? AND id != ? AND status = 'published' AND deleted_at IS NULL
       ORDER BY published_at DESC
       LIMIT 4`,
      [category, excludeId],
    );
    return rows;
  },
};

module.exports = BlogModel;
