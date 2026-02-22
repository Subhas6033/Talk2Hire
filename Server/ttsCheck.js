const { pool } = require("./Config/database.config.js");

const createTable = async () => {
  try {
    // Create Table
    const createTableSQL = `
  ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
`;

    await pool.query(createTableSQL);
    console.log("✅ Table 'company_details' created or already exists");
  } catch (error) {
    console.error("❌ Error creating table:", error.message);
  } finally {
    await pool.end();
    console.log("🔌 Pool closed");
  }
};

createTable();
