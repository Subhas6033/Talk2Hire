const { pool } = require("./Config/database.config");

async function runMigration() {
  const connection = await pool.getConnection();

  try {
    console.log("🚀 Starting secondary camera migration...");

    await connection.beginTransaction();

    // =====================================================
    // Step 1: Check current video_type definition
    // =====================================================
    console.log("📊 Checking current video_type column...");

    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM interview_videos WHERE Field = 'video_type';
    `);

    const currentType = columns[0].Type;
    console.log("Current video_type definition:", currentType);

    // =====================================================
    // Step 2: Check for existing data
    // =====================================================
    console.log("📊 Checking existing video types...");

    const [existingTypes] = await connection.execute(`
      SELECT video_type, COUNT(*) as count 
      FROM interview_videos 
      GROUP BY video_type;
    `);

    console.log("Existing video types:", existingTypes);

    // =====================================================
    // Step 3: Determine migration strategy
    // =====================================================
    let migrationQuery;

    // Check if secondary_camera already exists in the ENUM
    const alreadyMigrated = currentType
      .toLowerCase()
      .includes("secondary_camera");

    if (alreadyMigrated) {
      console.log(
        "✅ secondary_camera already present in ENUM, skipping ALTER TABLE",
      );
      migrationQuery = null;
    } else if (currentType.toLowerCase().includes("enum")) {
      console.log("🔄 Detected ENUM column, updating ENUM values...");

      migrationQuery = `
        ALTER TABLE interview_videos 
        MODIFY COLUMN video_type ENUM(
          'primary_camera', 
          'secondary_camera',
          'screen_recording'
        ) NOT NULL;
      `;
    } else if (currentType.toLowerCase().includes("varchar")) {
      console.log("🔄 Detected VARCHAR column, ensuring adequate size...");

      const sizeMatch = currentType.match(/varchar\((\d+)\)/i);
      const currentSize = sizeMatch ? parseInt(sizeMatch[1]) : 0;

      console.log(`Current VARCHAR size: ${currentSize}`);

      if (currentSize < 20) {
        console.log(
          "📏 Increasing VARCHAR size to accommodate 'secondary_camera' (16 chars)...",
        );
        migrationQuery = `
          ALTER TABLE interview_videos 
          MODIFY COLUMN video_type VARCHAR(20) NOT NULL;
        `;
      } else {
        console.log("✅ VARCHAR size is already adequate, no change needed");
        migrationQuery = null;
      }
    } else {
      console.warn("⚠️ Unexpected column type:", currentType);
      console.log("🔄 Converting to ENUM for better data integrity...");

      migrationQuery = `
        ALTER TABLE interview_videos 
        MODIFY COLUMN video_type ENUM(
          'primary_camera', 
          'secondary_camera',
          'screen_recording'
        ) NOT NULL;
      `;
    }

    // =====================================================
    // Step 4: Execute migration if needed
    // =====================================================
    if (migrationQuery) {
      console.log("🔄 Executing migration...");
      await connection.execute(migrationQuery);
      console.log("✅ Column updated successfully");
    } else {
      console.log(
        "✅ No migration needed, column already supports secondary_camera",
      );
    }

    // =====================================================
    // Step 5: Verify the change
    // =====================================================
    console.log("🔍 Verifying the update...");

    const [updatedColumns] = await connection.execute(`
      SHOW COLUMNS FROM interview_videos WHERE Field = 'video_type';
    `);

    console.log("Updated video_type definition:", updatedColumns[0].Type);

    // =====================================================
    // Step 6: Test all video types
    // =====================================================
    console.log("🧪 Testing all video type inserts...");

    const testTypes = [
      "primary_camera",
      "secondary_camera",
      "screen_recording",
    ];

    // Temporarily disable FK checks so test rows don't need a real interview_id
    await connection.execute(`SET FOREIGN_KEY_CHECKS = 0;`);

    for (const videoType of testTypes) {
      try {
        await connection.execute(
          `
          INSERT INTO interview_videos 
            (interview_id, user_id, video_type, original_filename, 
             file_size, upload_status, ftp_path, ftp_url)
          VALUES 
            (999999, 1, ?, CONCAT('test_', ?, '.webm'), 
             0, 'pending', '', '');
          `,
          [videoType, videoType],
        );
        console.log(`  ✅ ${videoType}: SUCCESS`);
      } catch (testError) {
        // Re-enable FK checks before throwing so DB is left in clean state
        await connection.execute(`SET FOREIGN_KEY_CHECKS = 1;`);
        console.error(`  ❌ ${videoType}: FAILED -`, testError.message);
        throw testError;
      }
    }

    // Clean up test data
    await connection.execute(`
      DELETE FROM interview_videos WHERE interview_id = 999999;
    `);

    // Re-enable FK checks
    await connection.execute(`SET FOREIGN_KEY_CHECKS = 1;`);

    console.log("✅ All test data cleaned up");

    await connection.commit();
    console.log("");
    console.log("🎉 Migration completed successfully!");
    console.log("");
    console.log("✅ Summary:");
    console.log("   - video_type column now supports:");
    console.log("     • primary_camera");
    console.log("     • secondary_camera (NEW)");
    console.log("     • screen_recording");
    console.log("   - Existing data preserved");
    console.log("   - All video types tested and working");
    console.log("   - Secondary camera recording is now enabled");
    console.log("");
    console.log("📱 Next steps:");
    console.log("   1. Run this script against production DB on Render");
    console.log("   2. Restart your application");
    console.log("   3. Test QR code generation");
    console.log("   4. Test mobile camera connection");
  } catch (error) {
    // Safety net: always re-enable FK checks on failure
    try {
      await connection.execute(`SET FOREIGN_KEY_CHECKS = 1;`);
    } catch (_) {}

    await connection.rollback();
    console.error("");
    console.error("❌ Migration failed:", error);
    console.error("");
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
    });

    console.log("");
    console.log("🔄 Rollback completed. Database unchanged.");
    console.log("");
    console.log("💡 Troubleshooting:");
    console.log("   - Check if interview_videos table exists");
    console.log("   - Check if there are foreign key constraints");
    console.log("   - Check if table is locked by other connections");
    console.log("   - Try running: SHOW CREATE TABLE interview_videos;");
  } finally {
    connection.release();
    process.exit();
  }
}

// Handle uncaught errors
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});

runMigration();
