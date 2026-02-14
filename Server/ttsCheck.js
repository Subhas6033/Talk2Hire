// Migration Script: Create temp_registrations table
// Run this file with: node migrations/001_create_temp_registrations.js

const mysql = require("mysql2/promise");
require("dotenv").config();

const migration = {
  name: "001_create_temp_registrations",

  up: `
    CREATE TABLE IF NOT EXISTS temp_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      resume_url TEXT NOT NULL,
      resume_mimetype VARCHAR(100) NOT NULL,
      resume_filename VARCHAR(255) NOT NULL,
      status ENUM('processing', 'completed', 'failed') DEFAULT 'processing',
      extracted_email VARCHAR(255) NULL,
      extracted_fullname VARCHAR(255) NULL,
      extracted_mobile VARCHAR(50) NULL,
      extracted_location VARCHAR(255) NULL,
      extracted_skills TEXT NULL,
      error_message TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      INDEX idx_session (session_id),
      INDEX idx_status (status),
      INDEX idx_expires (expires_at),
      INDEX idx_email (extracted_email)
    ) ENGINE=InnoDB 
      DEFAULT CHARSET=utf8mb4 
      COLLATE=utf8mb4_unicode_ci;
  `,

  down: `
    DROP TABLE IF EXISTS temp_registrations;
  `,

  verify: `
    SELECT 
      TABLE_NAME,
      TABLE_ROWS,
      CREATE_TIME
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'temp_registrations';
  `,
};

async function runMigration() {
  let connection;

  try {
    console.log("🔄 Connecting to database...");

    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "interview_db",
      port: process.env.DB_PORT || 3306,
    });

    console.log("✅ Connected to database");

    // Run the UP migration
    console.log(`\n📊 Running migration: ${migration.name}`);
    await connection.query(migration.up);
    console.log("✅ Table created successfully");

    // Verify the migration
    console.log("\n🔍 Verifying table creation...");
    const [rows] = await connection.query(migration.verify);

    if (rows.length > 0) {
      console.log("✅ Table verified:");
      console.table(rows);

      // Show table structure
      console.log("\n📋 Table structure:");
      const [columns] = await connection.query("DESCRIBE temp_registrations");
      console.table(columns);
    } else {
      console.log("❌ Table not found after migration!");
      process.exit(1);
    }

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    console.error("\nFull error:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("\n🔌 Database connection closed");
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration();
}

// Export for use in migration runner
module.exports = { migration, runMigration };
