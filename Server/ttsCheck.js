const { pool } = require("./Config/database.config.js");

const migrations = `
 SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'interviews'
  AND TABLE_SCHEMA = DATABASE()
  ORDER BY ORDINAL_POSITION
`;

const runMigrations = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log("✅ Connected to database\n");

    const [rows] = await connection.query(migrations);

    console.table(rows);

    console.log("\n🎉 Query executed successfully!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
};

runMigrations();
