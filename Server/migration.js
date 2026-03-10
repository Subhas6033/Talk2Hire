const { pool } = require("./Config/database.config.js");

const MIGRATIONS = [
  {
    table: "company_details",
    sql: `
      ALTER TABLE company_details
        ADD COLUMN IF NOT EXISTS microsoft_id VARCHAR(255) NULL
          COMMENT 'Microsoft OAuth subject ID for SSO login'
          AFTER companyRegisterNumber,
        MODIFY COLUMN password VARCHAR(255) NULL;
    `,
  },
  {
    table: "users",
    sql: `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS microsoft_id VARCHAR(255) NULL
          COMMENT 'Microsoft OAuth subject ID for SSO login'
          AFTER role,
        MODIFY COLUMN hashPassword VARCHAR(255) NULL;
    `,
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
           COLUMN_DEFAULT AS \`Default\`, COLUMN_KEY AS \`Key\`
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}'
    ORDER BY ORDINAL_POSITION;
  `);
  console.log(`\n📋 '${tableName}' — ${cols.length} columns:\n`);
  console.table(cols);
  return true;
}

const inspect = async () => {
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
    await inspectTable(connection, "company_details");
    await inspectTable(connection, "users");

    const [msColCheck] = await connection.query(`
      SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, ORDINAL_POSITION
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND COLUMN_NAME IN ('microsoft_id', 'password', 'hashPassword')
        AND TABLE_NAME IN ('company_details', 'users')
      ORDER BY TABLE_NAME, COLUMN_NAME;
    `);

    if (msColCheck.length > 0) {
      console.log("\n✅ Verified columns:\n");
      console.table(msColCheck);
    }
  } catch (err) {
    console.error("❌ Script failed:", err.message);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
};

inspect();
