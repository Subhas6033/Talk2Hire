const { pool } = require("./Config/database.config.js");

const MIGRATIONS = [
  {
    table: "newsletter_subscribers",
    sql: `
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id                  BIGINT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,

        email               VARCHAR(255)      NOT NULL
                              COMMENT 'Subscriber email address',
        unsubscribe_token   CHAR(64)          NOT NULL
                              COMMENT 'Unique token for 1-click unsubscribe links',
        is_active           TINYINT(1)        NOT NULL DEFAULT 1
                              COMMENT '1 = subscribed, 0 = unsubscribed',

        subscribed_at       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP
                              COMMENT 'When the user subscribed (or re-subscribed)',
        unsubscribed_at     DATETIME          NULL
                              COMMENT 'When the user unsubscribed, NULL if still active',

        created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at          DATETIME          NULL      ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uq_email             (email),
        UNIQUE KEY uq_unsubscribe_token (unsubscribe_token),
        INDEX      idx_is_active        (is_active),
        INDEX      idx_subscribed_at    (subscribed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Footer newsletter subscribers — receives job alert emails';
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
    console.log("🔍  Inspecting newsletter_subscribers table…\n");
    await inspectTable(connection, "newsletter_subscribers");

    // ── STEP 3: Subscriber summary ─────────────────────────────────────────
    const [subscriberSummary] = await connection
      .query(
        `
        SELECT
          DATE(subscribed_at)   AS date,
          COUNT(*)              AS total_subscribed,
          SUM(is_active = 1)    AS active,
          SUM(is_active = 0)    AS unsubscribed
        FROM newsletter_subscribers
        GROUP BY DATE(subscribed_at)
        ORDER BY date DESC
        LIMIT 10;
      `,
      )
      .catch(() => [[]]);

    if (subscriberSummary.length > 0) {
      console.log("\n📊  Subscriber summary (last 10 days):\n");
      console.table(subscriberSummary);
    }
  } catch (err) {
    console.error("❌ Script failed:", err.message);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
};

inspect();
