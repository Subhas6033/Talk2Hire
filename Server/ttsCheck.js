const { pool } = require("./Config/database.config");

async function runMigration() {
  const connection = await pool.getConnection();

  try {
    console.log("🚀 Starting screen recording migration...");

    await connection.beginTransaction();

    // =====================================================
    // Create interview_screen_recordings table
    // =====================================================
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS interview_screen_recordings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        interview_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        original_filename VARCHAR(500) NOT NULL,
        ftp_path VARCHAR(1000) DEFAULT NULL,
        ftp_url VARCHAR(1000) DEFAULT NULL,
        file_size BIGINT DEFAULT 0,
        duration DECIMAL(10,2) DEFAULT NULL,
        video_codec VARCHAR(50) DEFAULT NULL,
        video_bitrate INT DEFAULT NULL,
        resolution VARCHAR(20) DEFAULT NULL,
        frame_rate DECIMAL(5,2) DEFAULT NULL,
        upload_status ENUM('pending','uploading','completed','failed') DEFAULT 'pending',
        upload_progress INT DEFAULT 0,
        total_chunks INT DEFAULT 0,
        checksum VARCHAR(64) DEFAULT NULL,
        error_message TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_interview_id (interview_id),
        INDEX idx_user_id (user_id),
        INDEX idx_upload_status (upload_status),
        INDEX idx_created_at (created_at),
        INDEX idx_interview_status (interview_id, upload_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("✅ interview_screen_recordings table ready");

    // =====================================================
    // Create screen_recording_chunks table
    // =====================================================
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS screen_recording_chunks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        screen_recording_id INT NOT NULL,
        chunk_number INT NOT NULL,
        chunk_size BIGINT NOT NULL,
        temp_ftp_path VARCHAR(1000) DEFAULT NULL,
        checksum VARCHAR(64) DEFAULT NULL,
        is_uploaded BOOLEAN DEFAULT TRUE,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_screen_recording_id (screen_recording_id),
        INDEX idx_chunk_number (chunk_number),
        INDEX idx_deleted_at (deleted_at),
        UNIQUE KEY unique_screen_chunk (screen_recording_id, chunk_number),
        CONSTRAINT fk_screen_recording
          FOREIGN KEY (screen_recording_id)
          REFERENCES interview_screen_recordings(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("✅ screen_recording_chunks table ready");

    // =====================================================
    // Additional index
    // =====================================================
    await connection.execute(`
      CREATE INDEX idx_failed_uploads
      ON interview_screen_recordings (upload_status, created_at);
    `);

    console.log("✅ Index created");

    await connection.commit();
    console.log("🎉 Migration completed successfully!");
  } catch (error) {
    await connection.rollback();
    console.error("❌ Migration failed:", error);
  } finally {
    connection.release();
    process.exit();
  }
}

runMigration();
