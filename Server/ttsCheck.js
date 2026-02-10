const { pool } = require("./Config/database.config.js");

async function migrateUserTable() {
  try {
    console.log("🔄 Starting user table migration...");

    // Check which columns already exist
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME IN (
        'resume', 
        'resume_upload_status', 
        'profile_image_path', 
        'reset_password_otp', 
        'reset_password_otp_expires_at'
      )
    `);

    const existingColumns = columns.map((col) => col.COLUMN_NAME);
    console.log("📋 Existing columns:", existingColumns);

    // Add resume column if not exists
    if (!existingColumns.includes("resume")) {
      console.log("➕ Adding 'resume' column...");
      await pool.execute(`
        ALTER TABLE users 
        ADD COLUMN resume TEXT AFTER skill
      `);
      console.log("✅ Added 'resume' column");
    } else {
      console.log("⏭️  'resume' column already exists");
    }

    // ✅ FIX: Added 'pending' to ENUM — this was causing the truncation error
    if (!existingColumns.includes("resume_upload_status")) {
      console.log("➕ Adding 'resume_upload_status' column...");
      await pool.execute(`
        ALTER TABLE users 
        ADD COLUMN resume_upload_status 
          ENUM('pending', 'uploading', 'completed', 'failed') 
          DEFAULT 'pending' 
        AFTER resume
      `);
      console.log("✅ Added 'resume_upload_status' column");
    } else {
      // ✅ FIX: If column exists but was created without 'pending', patch the ENUM
      console.log(
        "🔧 Ensuring 'resume_upload_status' ENUM includes 'pending'...",
      );
      await pool.execute(`
        ALTER TABLE users 
        MODIFY COLUMN resume_upload_status 
          ENUM('pending', 'uploading', 'completed', 'failed') 
          DEFAULT 'pending'
      `);
      console.log("✅ 'resume_upload_status' ENUM updated");
    }

    // Add profile_image_path column if not exists
    if (!existingColumns.includes("profile_image_path")) {
      console.log("➕ Adding 'profile_image_path' column...");
      await pool.execute(`
        ALTER TABLE users 
        ADD COLUMN profile_image_path TEXT AFTER resume_upload_status
      `);
      console.log("✅ Added 'profile_image_path' column");
    } else {
      console.log("⏭️  'profile_image_path' column already exists");
    }

    // Add reset_password_otp column if not exists
    if (!existingColumns.includes("reset_password_otp")) {
      console.log("➕ Adding 'reset_password_otp' column...");
      await pool.execute(`
        ALTER TABLE users 
        ADD COLUMN reset_password_otp VARCHAR(6) AFTER profile_image_path
      `);
      console.log("✅ Added 'reset_password_otp' column");
    } else {
      console.log("⏭️  'reset_password_otp' column already exists");
    }

    // Add reset_password_otp_expires_at column if not exists
    if (!existingColumns.includes("reset_password_otp_expires_at")) {
      console.log("➕ Adding 'reset_password_otp_expires_at' column...");
      await pool.execute(`
        ALTER TABLE users 
        ADD COLUMN reset_password_otp_expires_at DATETIME AFTER reset_password_otp
      `);
      console.log("✅ Added 'reset_password_otp_expires_at' column");
    } else {
      console.log("⏭️  'reset_password_otp_expires_at' column already exists");
    }

    // Add indexes safely
    console.log("🔍 Adding indexes...");

    const indexes = [
      {
        name: "idx_email",
        sql: "CREATE INDEX idx_email ON users(email)",
      },
      {
        name: "idx_resume_upload_status",
        sql: "CREATE INDEX idx_resume_upload_status ON users(resume_upload_status)",
      },
    ];

    for (const index of indexes) {
      try {
        await pool.execute(index.sql);
        console.log(`✅ Added index: ${index.name}`);
      } catch (err) {
        if (err.code === "ER_DUP_KEYNAME") {
          console.log(`⏭️  Index '${index.name}' already exists`);
        } else {
          throw err;
        }
      }
    }

    console.log("\n✅ Migration completed successfully!");

    // Show final table structure
    const [tableInfo] = await pool.execute(`DESCRIBE users`);
    console.log("\n📊 Final table structure:");
    console.table(tableInfo);

    // ✅ FIX: Removed db.end() — never destroy the pool,
    // it kills all DB connections for the entire running server
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateUserTable()
    .then(() => {
      console.log("✅ Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Migration script failed:", error);
      process.exit(1);
    });
}

module.exports = { migrateUserTable };
