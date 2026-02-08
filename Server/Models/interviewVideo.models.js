const { connectDB } = require("../Config/database.config");
const { APIERR } = require("../Utils/index.utils.js");

const InterviewVideo = {
  async create({
    interviewId,
    userId,
    videoType,
    originalFilename,
    fileSize = 0,
    duration = null,
    ftpPath = "",
    ftpUrl = "",
    videoCodec = null,
    videoBitrate = null,
    resolution = null,
    frameRate = null,
    checksum = null,
    totalChunks = 1,
  }) {
    let db;
    try {
      db = await connectDB();

      console.log("💾 Creating video record:", {
        interviewId,
        userId,
        videoType,
        originalFilename,
      });

      const [result] = await db.execute(
        `INSERT INTO interview_videos 
         (interview_id, user_id, video_type, original_filename, file_size, duration,
          ftp_path, ftp_url, upload_status, video_codec, video_bitrate, resolution, 
          frame_rate, checksum, total_chunks, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
         original_filename = VALUES(original_filename),
         file_size = VALUES(file_size),
         upload_status = 'pending',
         started_at = NOW(),
         retry_count = retry_count + 1`,
        [
          interviewId,
          userId,
          videoType,
          originalFilename,
          fileSize,
          duration,
          ftpPath,
          ftpUrl,
          videoCodec,
          videoBitrate,
          resolution,
          frameRate,
          checksum,
          totalChunks,
        ],
      );

      console.log("✅ Video record created:", result.insertId);
      return result.insertId;
    } catch (error) {
      console.error("❌ Error creating video record:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async updateAfterUpload({
    videoId,
    ftpPath,
    ftpUrl,
    fileSize,
    duration = null,
  }) {
    let db;
    try {
      db = await connectDB();

      console.log("📤 Updating video after upload:", videoId);

      await db.execute(
        `UPDATE interview_videos 
         SET ftp_path = ?, 
             ftp_url = ?, 
             file_size = ?,
             duration = ?,
             upload_status = 'completed',
             upload_progress = 100,
             completed_at = NOW()
         WHERE id = ?`,
        [ftpPath, ftpUrl, fileSize, duration, videoId],
      );

      console.log("✅ Video record updated successfully");
      return true;
    } catch (error) {
      console.error("❌ Error updating video record:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async updateAfterMerge({ videoId, ftpUrl, fileSize, duration, checksum }) {
    let db;
    try {
      db = await connectDB();

      console.log("🎬 Updating video after merge:", videoId);

      await db.execute(
        `UPDATE interview_videos 
         SET ftp_url = ?,
             file_size = ?,
             duration = ?,
             checksum = ?,
             upload_status = 'completed',
             upload_progress = 100,
             completed_at = NOW()
         WHERE id = ?`,
        [ftpUrl, fileSize, duration, checksum, videoId],
      );

      console.log("✅ Video updated after merge");
      return true;
    } catch (error) {
      console.error("❌ Error updating after merge:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async updateUploadStatus(videoId, status, errorMessage = null) {
    let db;
    try {
      db = await connectDB();

      console.log(`📊 Updating upload status to: ${status}`);

      await db.execute(
        `UPDATE interview_videos 
         SET upload_status = ?,
             error_message = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [status, errorMessage, videoId],
      );

      return true;
    } catch (error) {
      console.error("❌ Error updating upload status:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async updateProgress(videoId, progress) {
    let db;
    try {
      db = await connectDB();

      const validProgress = Math.min(100, Math.max(0, Math.round(progress)));

      await db.execute(
        `UPDATE interview_videos 
       SET upload_progress = ?
       WHERE id = ?`,
        [validProgress, videoId],
      );

      return true;
    } catch (error) {
      console.error("❌ Error updating progress:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async updateChecksum(videoId, checksum) {
    let db;
    try {
      db = await connectDB();

      await db.execute(
        `UPDATE interview_videos 
         SET checksum = ?
         WHERE id = ?`,
        [checksum, videoId],
      );

      console.log("✅ Checksum updated:", checksum.substring(0, 16) + "...");
      return true;
    } catch (error) {
      console.error("❌ Error updating checksum:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async getById(videoId) {
    let db;
    try {
      db = await connectDB();

      const [rows] = await db.execute(
        `SELECT * FROM interview_videos WHERE id = ? LIMIT 1`,
        [videoId],
      );

      return rows[0] || null;
    } catch (error) {
      console.error("❌ Error getting video:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async getByInterviewId(interviewId) {
    let db;
    try {
      db = await connectDB();

      const [rows] = await db.execute(
        `SELECT * FROM interview_videos 
         WHERE interview_id = ?
         ORDER BY video_type ASC, created_at ASC`,
        [interviewId],
      );

      return rows;
    } catch (error) {
      console.error("❌ Error getting interview videos:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async getByInterviewAndType(interviewId, videoType) {
    let db;
    try {
      db = await connectDB();

      const [rows] = await db.execute(
        `SELECT * FROM interview_videos 
         WHERE interview_id = ? AND video_type = ?
         LIMIT 1`,
        [interviewId, videoType],
      );

      return rows[0] || null;
    } catch (error) {
      console.error("❌ Error getting video by type:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async getPendingUploads() {
    let db;
    try {
      db = await connectDB();

      const [rows] = await db.execute(
        `SELECT * FROM interview_videos 
         WHERE upload_status IN ('pending', 'uploading')
         AND retry_count < 3
         ORDER BY created_at ASC`,
      );

      return rows;
    } catch (error) {
      console.error("❌ Error getting pending uploads:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async markAsFailed(videoId, errorMessage) {
    let db;
    try {
      db = await connectDB();

      await db.execute(
        `UPDATE interview_videos 
         SET upload_status = 'failed',
             error_message = ?,
             retry_count = retry_count + 1
         WHERE id = ?`,
        [errorMessage, videoId],
      );

      return true;
    } catch (error) {
      console.error("❌ Error marking as failed:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async saveChunk({
    videoId,
    chunkNumber,
    chunkSize,
    tempFtpPath,
    checksum = null,
  }) {
    let db;
    try {
      db = await connectDB();

      await db.execute(
        `INSERT INTO interview_video_chunks 
         (video_id, chunk_number, chunk_size, temp_ftp_path, checksum, upload_status, uploaded_at)
         VALUES (?, ?, ?, ?, ?, 'uploaded', NOW())
         ON DUPLICATE KEY UPDATE
         chunk_size = VALUES(chunk_size),
         temp_ftp_path = VALUES(temp_ftp_path),
         checksum = VALUES(checksum),
         upload_status = 'uploaded',
         uploaded_at = NOW()`,
        [videoId, chunkNumber, chunkSize, tempFtpPath, checksum],
      );

      // Update parent video record
      await db.execute(
        `UPDATE interview_videos 
         SET uploaded_chunks = uploaded_chunks + 1
         WHERE id = ?`,
        [videoId],
      );

      return true;
    } catch (error) {
      console.error("❌ Error saving chunk:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async getChunks(videoId) {
    let db;
    try {
      db = await connectDB();

      const [rows] = await db.execute(
        `SELECT * FROM interview_video_chunks 
         WHERE video_id = ? 
         AND upload_status = 'uploaded'
         ORDER BY chunk_number ASC`,
        [videoId],
      );

      return rows;
    } catch (error) {
      console.error("❌ Error getting chunks:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async markChunksDeleted(videoId) {
    let db;
    try {
      db = await connectDB();

      console.log(`🗑️  Marking chunks as deleted for video ${videoId}...`);

      // Try to update with 'deleted' status
      try {
        await db.execute(
          `UPDATE interview_video_chunks 
           SET upload_status = 'deleted',
               deleted_at = NOW()
           WHERE video_id = ?`,
          [videoId],
        );
        console.log("✅ Chunks marked as deleted");
      } catch (statusError) {
        // If 'deleted' status fails (column too small), try alternative approach
        if (statusError.code === "WARN_DATA_TRUNCATED") {
          console.warn(
            "⚠️ 'deleted' status not supported, using alternative approach",
          );

          // Option 1: Just delete the records entirely
          await db.execute(
            `DELETE FROM interview_video_chunks WHERE video_id = ?`,
            [videoId],
          );
          console.log("✅ Chunks deleted from database");

          // Option 2: Use a shorter status (if you want to keep records)
          // await db.execute(
          //   `UPDATE interview_video_chunks
          //    SET upload_status = 'done',
          //        deleted_at = NOW()
          //    WHERE video_id = ?`,
          //   [videoId]
          // );
        } else {
          throw statusError;
        }
      }

      return true;
    } catch (error) {
      console.error("❌ Error marking chunks as deleted:", error);

      // Don't throw - this is cleanup and shouldn't fail the whole operation
      console.warn("⚠️ Continuing despite chunk cleanup error");
      return false;
    } finally {
      if (db) db.release();
    }
  },

  async getUploadStats(interviewId) {
    let db;
    try {
      db = await connectDB();

      const [rows] = await db.execute(
        `SELECT 
           COUNT(*) as total_videos,
           SUM(CASE WHEN upload_status = 'completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN upload_status = 'failed' THEN 1 ELSE 0 END) as failed,
           SUM(CASE WHEN upload_status = 'pending' THEN 1 ELSE 0 END) as pending,
           SUM(CASE WHEN upload_status = 'uploading' THEN 1 ELSE 0 END) as uploading,
           SUM(CASE WHEN upload_status = 'merging' THEN 1 ELSE 0 END) as merging,
           SUM(file_size) as total_size,
           AVG(duration) as avg_duration,
           SUM(duration) as total_duration
         FROM interview_videos
         WHERE interview_id = ?`,
        [interviewId],
      );

      return rows[0];
    } catch (error) {
      console.error("❌ Error getting upload stats:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async getDetailedStats(interviewId) {
    let db;
    try {
      db = await connectDB();

      // Get video stats
      const [videoStats] = await db.execute(
        `SELECT 
           video_type,
           upload_status,
           file_size,
           duration,
           total_chunks,
           uploaded_chunks,
           upload_progress,
           checksum,
           created_at,
           completed_at
         FROM interview_videos
         WHERE interview_id = ?`,
        [interviewId],
      );

      // Get chunk stats
      const [chunkStats] = await db.execute(
        `SELECT 
           v.video_type,
           COUNT(c.id) as chunk_count,
           SUM(c.chunk_size) as total_chunk_size,
           GROUP_CONCAT(c.chunk_number ORDER BY c.chunk_number) as chunk_numbers
         FROM interview_videos v
         LEFT JOIN interview_video_chunks c ON v.id = c.video_id
         WHERE v.interview_id = ?
         GROUP BY v.id, v.video_type`,
        [interviewId],
      );

      return {
        videos: videoStats,
        chunks: chunkStats,
      };
    } catch (error) {
      console.error("❌ Error getting detailed stats:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async delete(videoId) {
    let db;
    try {
      db = await connectDB();

      // Delete chunks first
      await db.execute(
        `DELETE FROM interview_video_chunks WHERE video_id = ?`,
        [videoId],
      );

      // Delete video
      await db.execute(`DELETE FROM interview_videos WHERE id = ?`, [videoId]);

      console.log("✅ Video record deleted:", videoId);
      return true;
    } catch (error) {
      console.error("❌ Error deleting video:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async cleanupOldFailedUploads(daysOld = 7) {
    let db;
    try {
      db = await connectDB();

      const [result] = await db.execute(
        `DELETE FROM interview_videos 
         WHERE upload_status = 'failed'
         AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [daysOld],
      );

      console.log(`✅ Cleaned up ${result.affectedRows} old failed uploads`);
      return result.affectedRows;
    } catch (error) {
      console.error("❌ Error cleaning up old uploads:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },

  async getFailedUploads() {
    let db;
    try {
      db = await connectDB();

      const [rows] = await db.execute(
        `SELECT * FROM interview_videos 
       WHERE upload_status = 'failed'
       AND retry_count < 3
       ORDER BY created_at ASC`,
      );

      return rows;
    } catch (error) {
      console.error("❌ Error getting failed uploads:", error);
      throw error;
    } finally {
      if (db) db.release();
    }
  },
};

module.exports = { InterviewVideo };
