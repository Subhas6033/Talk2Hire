const { pool } = require("./Config/database.config.js");

const MIGRATIONS = [
  {
    table: "interviews (rebuild strengths as plain text)",
    sql: `ALTER TABLE interviews
      MODIFY COLUMN strengths    LONGTEXT NULL DEFAULT NULL,
      MODIFY COLUMN improvements LONGTEXT NULL DEFAULT NULL,
      MODIFY COLUMN summary      TEXT     NULL DEFAULT NULL`,
  },
  // Backfill after constraint is gone
  {
    table: "interviews (backfill eval columns)",
    sql: `UPDATE interviews i
      INNER JOIN interview_evaluations ie ON ie.interview_id = i.id
      SET i.score            = ie.overall_score,
          i.experience_level = ie.experience_level,
          i.hire_decision    = ie.hire_decision,
          i.strengths        = ie.strengths,
          i.improvements     = ie.weaknesses,
          i.summary          = ie.summary,
          i.status           = 'completed',
          i.updated_at       = NOW()
      WHERE i.score IS NULL OR i.score = 0`,
  },
];

async function inspectTable(connection, tableName) {
  const [exists] = await connection.query(`
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}';
  `);
  if (exists.length === 0) {
    console.log(`❌ '${tableName}' does NOT exist`);
    return false;
  }

  const [cols] = await connection.query(`
    SELECT ORDINAL_POSITION AS \`#\`, COLUMN_NAME AS \`Column\`,
           COLUMN_TYPE AS \`Type\`, IS_NULLABLE AS \`Nullable\`,
           COLUMN_DEFAULT AS \`Default\`, COLUMN_KEY AS \`Key\`,
           COLUMN_COMMENT AS \`Comment\`
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}'
    ORDER BY ORDINAL_POSITION;
  `);
  console.log(`\n📋 '${tableName}' — ${cols.length} columns:\n`);
  console.table(cols);
  return true;
}

const migrate = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log("✅ Connected to database\n");

    console.log("🔧 Running migrations…\n");
    for (const { table, sql } of MIGRATIONS) {
      try {
        await connection.query(sql);
        console.log(`✅ '${table}' — migration ready`);
      } catch (err) {
        console.error(`❌ '${table}' migration failed: ${err.message}`);
      }
    }
    console.log();

    console.log("🔍 Verifying columns…\n");
    await inspectTable(connection, "interviews");
  } catch (err) {
    console.error("❌ Script failed:", err.message);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
};

migrate();
