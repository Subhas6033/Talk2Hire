const { pool } = require("./Config/database.config.js");

const run = async () => {
  let connection;

  try {
    connection = await pool.getConnection();
    console.log("Connected to database\n");

    // Check existing columns in interviews table
    const [existingCols] = await connection.query(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'interviews'
      ORDER BY ORDINAL_POSITION;
    `);

    const existing = existingCols.map((r) => r.COLUMN_NAME);
    console.log("Existing interviews columns:", existing.join(", "), "\n");

    // Drop s3_key first (if exists)
    if (existing.includes("s3_key")) {
      console.log("Dropping: s3_key...");
      await connection.query(`
        ALTER TABLE interviews
        DROP COLUMN \`s3_key\`;
      `);
      console.log("  Dropped: s3_key");
    } else {
      console.log("  Skipped: s3_key does not exist");
    }

    // Drop egress_id (if exists)
    if (existing.includes("egress_id")) {
      console.log("Dropping: egress_id...");
      await connection.query(`
        ALTER TABLE interviews
        DROP COLUMN \`egress_id\`;
      `);
      console.log("  Dropped: egress_id");
    } else {
      console.log("  Skipped: egress_id does not exist");
    }

    // Verify final column structure
    const [finalCols] = await connection.query(`
      SELECT
        ORDINAL_POSITION AS \`#\`,
        COLUMN_NAME      AS \`Column\`,
        COLUMN_TYPE      AS \`Type\`,
        IS_NULLABLE      AS \`Nullable\`,
        COLUMN_DEFAULT   AS \`Default\`
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'interviews'
      ORDER BY ORDINAL_POSITION;
    `);

    console.log("\nFinal interviews column order:\n");
    console.table(finalCols);

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
};

run();
