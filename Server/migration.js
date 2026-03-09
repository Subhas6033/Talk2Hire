const { pool } = require("./Config/database.config.js");

const MIGRATIONS = [
  {
    table: "temp_registrations",
    sql: `
      ALTER TABLE temp_registrations
        ADD COLUMN IF NOT EXISTS registration_otp              VARCHAR(6)   NULL
          COMMENT '6-digit OTP sent to the extracted email for registration verification',
        ADD COLUMN IF NOT EXISTS registration_otp_expires_at   DATETIME     NULL
          COMMENT 'Expiry timestamp of the registration OTP',
        ADD COLUMN IF NOT EXISTS otp_verified                  TINYINT(1)   NOT NULL DEFAULT 0
          COMMENT '1 = email OTP verified, 0 = not yet verified';
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
    console.log("🔍  Inspecting temp_registrations table…\n");
    await inspectTable(connection, "temp_registrations");

    // ── STEP 3: OTP column verification ───────────────────────────────────
    const [otpCols] = await connection
      .query(
        `
        SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'temp_registrations'
          AND COLUMN_NAME  IN ('registration_otp', 'registration_otp_expires_at', 'otp_verified')
        ORDER BY ORDINAL_POSITION;
      `,
      )
      .catch(() => [[]]);

    if (otpCols.length > 0) {
      console.log("\n🔐  OTP columns on temp_registrations:\n");
      console.table(otpCols);
    } else {
      console.warn("⚠️  OTP columns not found — migration may have failed.");
    }
  } catch (err) {
    console.error("❌ Script failed:", err.message);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
};

inspect();
