const { pool } = require("./Config/database.config.js");

const run = async () => {
  let connection;

  try {
    connection = await pool.getConnection();
    console.log("✅ Connected to database\n");

    await connection.query(`
      ALTER TABLE company_details
      ADD COLUMN logo VARCHAR(500) NULL AFTER companyName
    `);

    console.log(
      "✅ Column 'logo' added after 'companyName' in company_details",
    );
    console.log("\n🎉 Migration completed successfully!");
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log("⚠️  Column 'logo' already exists — skipping.");
    } else {
      console.error("❌ Error:", err.message);
    }
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
};

run();
