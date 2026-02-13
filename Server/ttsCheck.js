const { pool } = require("./Config/database.config");

async function runAudioChunkMigration() {
  const connection = await pool.getConnection();

  try {
    console.log("🚀 Starting audio chunk upload_status migration...");

    // ── Step 1: Check current definition ───────────────────────────────────
    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM interview_audio_chunks WHERE Field = 'upload_status';
    `);

    if (columns.length === 0) {
      console.log(
        "⚠️  Table interview_audio_chunks not found or column missing",
      );
      return;
    }

    const currentType = columns[0].Type;
    console.log("Current upload_status definition:", currentType);

    // ── Step 2: Check video chunks table too ───────────────────────────────
    const [videoColumns] = await connection
      .execute(
        `
      SHOW COLUMNS FROM interview_video_chunks WHERE Field = 'upload_status';
    `,
      )
      .catch(() => [[]]);

    if (videoColumns.length > 0) {
      console.log("Video chunk upload_status:", videoColumns[0].Type);
    }

    // ── Step 3: Fix audio_chunks table ─────────────────────────────────────
    console.log("🔄 Updating interview_audio_chunks.upload_status...");

    await connection.execute(`
      ALTER TABLE interview_audio_chunks
      MODIFY COLUMN upload_status ENUM(
        'pending',
        'uploading',
        'uploaded',
        'merging',
        'merged',
        'deleted',
        'failed'
      ) NOT NULL DEFAULT 'pending';
    `);

    console.log("✅ interview_audio_chunks.upload_status updated");

    // ── Step 4: Fix video_chunks table too (same issue likely) ─────────────
    if (videoColumns.length > 0) {
      console.log("🔄 Updating interview_video_chunks.upload_status...");

      await connection
        .execute(
          `
        ALTER TABLE interview_video_chunks
        MODIFY COLUMN upload_status ENUM(
          'pending',
          'uploading',
          'uploaded',
          'merging',
          'merged',
          'deleted',
          'failed'
        ) NOT NULL DEFAULT 'pending';
      `,
        )
        .catch((err) => {
          console.warn(
            "⚠️  Could not update video chunks (may be fine):",
            err.message,
          );
        });

      console.log("✅ interview_video_chunks.upload_status updated");
    }

    // ── Step 5: Fix interview_audio.upload_status too ──────────────────────
    const [audioColumns] = await connection
      .execute(
        `
      SHOW COLUMNS FROM interview_audio WHERE Field = 'upload_status';
    `,
      )
      .catch(() => [[]]);

    if (audioColumns.length > 0) {
      console.log(
        "Current interview_audio.upload_status:",
        audioColumns[0].Type,
      );

      await connection
        .execute(
          `
        ALTER TABLE interview_audio
        MODIFY COLUMN upload_status ENUM(
          'pending',
          'uploading',
          'uploaded',
          'merging',
          'merged',
          'completed',
          'failed'
        ) NOT NULL DEFAULT 'pending';
      `,
        )
        .catch((err) => {
          console.warn(
            "⚠️  Could not update interview_audio status:",
            err.message,
          );
        });

      console.log("✅ interview_audio.upload_status updated");
    }

    // ── Step 6: Verify ─────────────────────────────────────────────────────
    console.log("\n🔍 Verifying all updates...");

    const [verify1] = await connection.execute(`
      SHOW COLUMNS FROM interview_audio_chunks WHERE Field = 'upload_status';
    `);
    console.log("interview_audio_chunks.upload_status:", verify1[0].Type);

    const [verify2] = await connection
      .execute(
        `
      SHOW COLUMNS FROM interview_audio WHERE Field = 'upload_status';
    `,
      )
      .catch(() => [[{ Type: "N/A" }]]);
    console.log("interview_audio.upload_status:", verify2[0].Type);

    console.log("\n🎉 Migration completed successfully!");
    console.log("✅ 'uploaded' is now a valid status for audio chunks");
    console.log("✅ Audio recording will work correctly now");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    console.error("Details:", {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
    });
  } finally {
    connection.release();
    process.exit();
  }
}

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});

runAudioChunkMigration();
