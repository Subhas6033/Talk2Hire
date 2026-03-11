const { pool } = require("./Config/database.config.js");

const MIGRATIONS = [
  // Remove ENUM restriction — category can now be any free-text string
  {
    table: "blog_details — free-text category",
    sql: `ALTER TABLE blog_details
          MODIFY COLUMN category VARCHAR(100) NULL DEFAULT NULL
          COMMENT 'Post category — free text, no ENUM restriction'`,
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
    await inspectTable(connection, "blog_details");
  } catch (err) {
    console.error("❌ Script failed:", err.message);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
};

migrate();
