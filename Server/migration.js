const { pool } = require("./Config/database.config.js");

const MIGRATIONS = [
  {
    table: "drop old reviews table",
    sql: `DROP TABLE IF EXISTS reviews;`,
  },
  {
    table: "user_reviews",
    sql: `
      CREATE TABLE IF NOT EXISTS user_reviews (
        id          BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,

        full_name   VARCHAR(100)     NOT NULL
                      COMMENT 'Full name of the reviewer',
        email       VARCHAR(150)     NOT NULL
                      COMMENT 'Email address of the reviewer',
        subject     VARCHAR(255)     NOT NULL
                      COMMENT 'Subject of the review',
        message     TEXT             NOT NULL
                      COMMENT 'Review message body',

        created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME         NULL     ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_email      (email),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='User submitted reviews and contact messages';
    `,
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Inspection helpers
   ───────────────────────────────────────────────────────────────────────────── */

async function inspectTable(connection, tableName) {
  const [exists] = await connection.query(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = '${tableName}';
  `);

  if (exists.length === 0) {
    console.log(`❌  '${tableName}' does NOT exist`);
    return false;
  }

  const [cols] = await connection.query(`
    SELECT
      ORDINAL_POSITION AS \`#\`,
      COLUMN_NAME      AS \`Column\`,
      COLUMN_TYPE      AS \`Type\`,
      IS_NULLABLE      AS \`Nullable\`,
      COLUMN_DEFAULT   AS \`Default\`,
      COLUMN_KEY       AS \`Key\`,
      EXTRA            AS \`Extra\`
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = '${tableName}'
    ORDER BY ORDINAL_POSITION;
  `);

  console.log(`\n📋  '${tableName}' — ${cols.length} columns:\n`);
  console.table(cols);

  const [indexes] = await connection.query(`SHOW INDEX FROM \`${tableName}\`;`);
  if (indexes.length > 0) {
    console.log(`🗂️   Indexes:\n`);
    console.table(
      indexes.map((i) => ({
        Key: i.Key_name,
        Column: i.Column_name,
        Unique: i.Non_unique === 0 ? "YES" : "NO",
        Type: i.Index_type,
      })),
    );
  }

  const [[{ total }]] = await connection.query(
    `SELECT COUNT(*) AS total FROM \`${tableName}\``,
  );
  console.log(`📊  Total rows: ${total}`);

  if (total > 0) {
    const [sample] = await connection.query(
      `SELECT * FROM \`${tableName}\` ORDER BY id DESC LIMIT 3`,
    );
    console.log(`\n🔍  Last 3 rows:\n`);
    console.table(sample);
  }

  console.log("─".repeat(70) + "\n");
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main
   ───────────────────────────────────────────────────────────────────────────── */

const inspect = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log("✅ Connected to database\n");

    // ── STEP 1: Run migrations ─────────────────────────────────────────────
    console.log("🔧  Running migrations…\n");
    for (const { table, sql } of MIGRATIONS) {
      try {
        await connection.query(sql);
        console.log(`✅  '${table}' — ready`);
      } catch (err) {
        console.error(`❌  '${table}' migration failed: ${err.message}`);
      }
    }
    console.log();

    // ── STEP 2: Inspect table ──────────────────────────────────────────────
    console.log("🔍  Inspecting reviews table…\n");
    await inspectTable(connection, "user_reviews");

    // ── STEP 3: Reviews summary ────────────────────────────────────────────
    const [reviewSummary] = await connection
      .query(
        `
        SELECT
          DATE(created_at)  AS date,
          COUNT(*)          AS total_reviews,
          COUNT(DISTINCT email) AS unique_emails
        FROM reviews
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 10;
      `,
      )
      .catch(() => [[]]);

    if (reviewSummary.length > 0) {
      console.log("\n📊  Reviews summary (last 10 days):\n");
      console.table(reviewSummary);
    }
  } catch (err) {
    console.error("❌ Script failed:", err.message);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
};

inspect();
