/**
 * Migration: Add checksum and enhanced tracking to interview_videos table
 * This script executes the SQL exactly as provided — no changes.
 */

const mysql = require("mysql2/promise");
require("dotenv").config();
// This is the migration scripts
(async () => {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
    });

    console.log("🚀 Running migration: Add checksum & chunk tracking");

    //     const migrationSQL = `-- Migration: Add checksum and enhanced tracking to interview_videos table
    // -- Run this migration to support video integrity checks and chunk management

    // -- Add checksum column for integrity verification
    // ALTER TABLE interview_videos
    // ADD COLUMN IF NOT EXISTS checksum VARCHAR(64) NULL COMMENT 'SHA-256 checksum for integrity verification';

    // -- Add total_chunks column to track expected number of chunks
    // ALTER TABLE interview_videos
    // ADD COLUMN IF NOT EXISTS total_chunks INT DEFAULT 1 COMMENT 'Total number of chunks expected';

    // -- Add uploaded_chunks column to track upload progress
    // ALTER TABLE interview_videos
    // ADD COLUMN IF NOT EXISTS uploaded_chunks INT DEFAULT 0 COMMENT 'Number of chunks successfully uploaded';

    // -- Add index for faster checksum lookups
    // CREATE INDEX IF NOT EXISTS idx_checksum ON interview_videos(checksum);

    // -- Add index for status filtering
    // CREATE INDEX IF NOT EXISTS idx_upload_status ON interview_videos(upload_status, created_at);

    // -- Update interview_video_chunks table with checksum
    // ALTER TABLE interview_video_chunks
    // ADD COLUMN IF NOT EXISTS checksum VARCHAR(64) NULL COMMENT 'SHA-256 checksum for chunk integrity';

    // -- Add deleted_at column for soft delete tracking
    // ALTER TABLE interview_video_chunks
    // ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL COMMENT 'When chunk was deleted from FTP';

    // -- Add index for chunk queries
    // CREATE INDEX IF NOT EXISTS idx_video_chunk ON interview_video_chunks(video_id, chunk_number);

    // -- Add index for cleanup queries
    // CREATE INDEX IF NOT EXISTS idx_chunk_cleanup ON interview_video_chunks(created_at, upload_status);

    // -- Add 'merging' status to enum if not exists (depends on your database)
    // -- For MySQL 5.7+:
    // -- ALTER TABLE interview_videos
    // -- MODIFY COLUMN upload_status ENUM('pending', 'uploading', 'merging', 'completed', 'failed') DEFAULT 'pending';

    // -- Create a helper function to add enum value if your DB version supports it
    // -- Otherwise, manually add 'merging' to the upload_status enum

    // -- Add method to get failed uploads (for retry job)
    // -- This is just documentation - the actual query is in the model
    // -- SELECT * FROM interview_videos
    // -- WHERE upload_status = 'failed' AND retry_count < 3
    // -- ORDER BY created_at ASC;

    // -- Create view for monitoring video upload progress
    // CREATE OR REPLACE VIEW video_upload_progress AS
    // SELECT
    //     v.id,
    //     v.interview_id,
    //     v.video_type,
    //     v.upload_status,
    //     v.upload_progress,
    //     v.total_chunks,
    //     v.uploaded_chunks,
    //     v.file_size,
    //     v.duration,
    //     v.checksum,
    //     v.retry_count,
    //     v.error_message,
    //     v.created_at,
    //     v.started_at,
    //     v.completed_at,
    //     COUNT(c.id) as actual_chunk_count,
    //     SUM(c.chunk_size) as total_chunk_size
    // FROM interview_videos v
    // LEFT JOIN interview_video_chunks c ON v.id = c.video_id AND c.upload_status != 'deleted'
    // GROUP BY v.id;

    // -- Create view for interview video statistics
    // CREATE OR REPLACE VIEW interview_video_stats AS
    // SELECT
    //     interview_id,
    //     COUNT(*) as total_videos,
    //     SUM(CASE WHEN upload_status = 'completed' THEN 1 ELSE 0 END) as completed,
    //     SUM(CASE WHEN upload_status = 'failed' THEN 1 ELSE 0 END) as failed,
    //     SUM(CASE WHEN upload_status = 'pending' THEN 1 ELSE 0 END) as pending,
    //     SUM(CASE WHEN upload_status = 'uploading' THEN 1 ELSE 0 END) as uploading,
    //     SUM(CASE WHEN upload_status = 'merging' THEN 1 ELSE 0 END) as merging,
    //     SUM(file_size) as total_size,
    //     AVG(duration) as avg_duration,
    //     SUM(duration) as total_duration,
    //     MIN(created_at) as first_upload,
    //     MAX(completed_at) as last_completed
    // FROM interview_videos
    // GROUP BY interview_id;

    // -- Add comments for documentation
    // ALTER TABLE interview_videos
    // MODIFY COLUMN checksum VARCHAR(64) NULL
    // COMMENT 'SHA-256 checksum for integrity verification - calculated during upload';

    // ALTER TABLE interview_videos
    // MODIFY COLUMN total_chunks INT DEFAULT 1
    // COMMENT 'Total number of chunks expected for chunked uploads';

    // ALTER TABLE interview_videos
    // MODIFY COLUMN uploaded_chunks INT DEFAULT 0
    // COMMENT 'Number of chunks successfully uploaded - used for progress tracking';

    // -- Verification queries (run these to test the migration)
    // -- SELECT COUNT(*) as videos_with_checksums FROM interview_videos WHERE checksum IS NOT NULL;
    // -- SELECT COUNT(*) as pending_merges FROM interview_videos WHERE upload_status = 'merging';
    // -- SELECT * FROM video_upload_progress WHERE upload_status != 'completed' ORDER BY created_at DESC;
    // -- SELECT * FROM interview_video_stats ORDER BY interview_id DESC LIMIT 10;

    // -- Migration complete!`;

    const migrationSQL = `-- Fix for 'upload_status' column data truncation error
-- This script updates the interview_video_chunks table to support 'deleted' status

-- Option 1: If using VARCHAR, increase the length
ALTER TABLE interview_video_chunks 
MODIFY COLUMN upload_status VARCHAR(20) NOT NULL DEFAULT 'pending';

-- Option 2: If using ENUM, add 'deleted' to the allowed values
-- (Comment out Option 1 above and uncomment this if you're using ENUM)
-- ALTER TABLE interview_video_chunks 
-- MODIFY COLUMN upload_status ENUM('pending', 'uploading', 'uploaded', 'failed', 'deleted') NOT NULL DEFAULT 'pending';

-- Verify the change
DESCRIBE interview_video_chunks;

-- Check existing data
SELECT upload_status, COUNT(*) as count 
FROM interview_video_chunks 
GROUP BY upload_status;
`;

    await connection.query(migrationSQL);

    console.log("✅ Migration completed successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
})();
