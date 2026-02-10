const { pool } = require("./Config/database.config.js");

async function migrateSkillsColumn() {
  try {
    console.log("🔄 Starting migration: Setting up skills columns...");

    // Step 1: Drop cv_extracted_skills column if it exists
    try {
      await pool.execute(`
        ALTER TABLE users 
        DROP COLUMN cv_extracted_skills;
      `);
      console.log("✅ Removed cv_extracted_skills column");
    } catch (err) {
      if (err.code === "ER_CANT_DROP_FIELD_OR_KEY") {
        console.log("⚠️ cv_extracted_skills column doesn't exist, skipping...");
      } else {
        throw err;
      }
    }

    // Step 2: Check if 'skill' column exists and rename to 'skills' if needed
    const [columns] = await pool.execute(`
      SHOW COLUMNS FROM users LIKE 'skill';
    `);

    if (columns.length > 0) {
      // Rename 'skill' to 'skills'
      await pool.execute(`
        ALTER TABLE users 
        CHANGE COLUMN skill skills TEXT;
      `);
      console.log("✅ Renamed 'skill' to 'skills' and changed to TEXT");
    } else {
      // Check if 'skills' already exists
      const [skillsColumns] = await pool.execute(`
        SHOW COLUMNS FROM users LIKE 'skills';
      `);

      if (skillsColumns.length === 0) {
        // Add new 'skills' column
        await pool.execute(`
          ALTER TABLE users 
          ADD COLUMN skills TEXT AFTER resume_upload_status;
        `);
        console.log("✅ Added new 'skills' column as TEXT");
      } else {
        // Just modify to TEXT if it exists but is too small
        await pool.execute(`
          ALTER TABLE users 
          MODIFY COLUMN skills TEXT;
        `);
        console.log("✅ Modified 'skills' column to TEXT");
      }
    }

    console.log("✅ Migration completed successfully!");
    console.log("📝 Final schema:");
    console.log("   - cv_extracted_skills: REMOVED");
    console.log(
      "   - skills: TEXT (can store large comma-separated skill lists)",
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateSkillsColumn();
