const { pool } = require("./Config/database.config.js");

const run = async () => {
  let connection;

  try {
    connection = await pool.getConnection();
    console.log("Connected to database\n");

    // Drop existing category column if it exists
    await connection.query(`
      ALTER TABLE interview_questions DROP COLUMN IF EXISTS category;
    `);
    console.log("Dropped existing category column (if it existed)");

    // Recreate it in the correct position — after the question column
    await connection.query(`
      ALTER TABLE interview_questions 
      ADD COLUMN category VARCHAR(50) NULL AFTER question;
    `);
    console.log("Added category column after question column");

    console.log("\nMigration completed successfully!");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
};

run();
