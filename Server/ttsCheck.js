const { connectDB } = require("./Config/database.config.js");

async function migrateUserTable() {
  const db = await connectDB();

  try {
    console.log("🔄 Starting user table migration...");

    // Check if columns exist first
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME IN ('resume', 'resume_upload_status', 'profile_image_path', 'reset_password_otp', 'reset_password_otp_expires_at')
    `);

    const existingColumns = columns.map((col) => col.COLUMN_NAME);
    console.log("📋 Existing columns:", existingColumns);

    // Add resume column if not exists
    if (!existingColumns.includes("resume")) {
      console.log("➕ Adding 'resume' column...");
      await db.execute(`
        ALTER TABLE users 
        ADD COLUMN resume TEXT AFTER skill
      `);
      console.log("✅ Added 'resume' column");
    } else {
      console.log("⏭️  'resume' column already exists");
    }

    // Add resume_upload_status column if not exists
    if (!existingColumns.includes("resume_upload_status")) {
      console.log("➕ Adding 'resume_upload_status' column...");
      await db.execute(`
        ALTER TABLE users 
        ADD COLUMN resume_upload_status ENUM('uploading', 'completed', 'failed') 
        DEFAULT 'completed' 
        AFTER resume
      `);
      console.log("✅ Added 'resume_upload_status' column");
    } else {
      console.log("⏭️  'resume_upload_status' column already exists");
    }

    // Add profile_image_path column if not exists
    if (!existingColumns.includes("profile_image_path")) {
      console.log("➕ Adding 'profile_image_path' column...");
      await db.execute(`
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
      await db.execute(`
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
      await db.execute(`
        ALTER TABLE users 
        ADD COLUMN reset_password_otp_expires_at DATETIME AFTER reset_password_otp
      `);
      console.log("✅ Added 'reset_password_otp_expires_at' column");
    } else {
      console.log("⏭️  'reset_password_otp_expires_at' column already exists");
    }

    // Add indexes for better performance
    console.log("🔍 Adding indexes...");

    try {
      await db.execute(`
        CREATE INDEX idx_resume_upload_status 
        ON users(resume_upload_status)
      `);
      console.log("✅ Added index on resume_upload_status");
    } catch (err) {
      if (err.code === "ER_DUP_KEYNAME") {
        console.log("⏭️  Index idx_resume_upload_status already exists");
      } else {
        throw err;
      }
    }

    console.log("✅ Migration completed successfully!");

    // Show final table structure
    const [tableInfo] = await db.execute(`DESCRIBE users`);
    console.log("\n📊 Final table structure:");
    console.table(tableInfo);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await db.end();
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
