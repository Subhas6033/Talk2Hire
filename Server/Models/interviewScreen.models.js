const { pool } = require("../Config/database.config.js");
const { APIERR } = require("../Utils/index.utils.js");

class InterviewScreenRecording {
  /**
   * Create a new screen recording record
   */
  static async create({
    interviewId,
    userId,
    originalFilename,
    fileSize = 0,
    totalChunks = 0,
    duration = null,
  }) {
    try {
      const query = `
        INSERT INTO interview_screen_recordings (
          interview_id,
          user_id,
          original_filename,
          file_size,
          total_chunks,
          duration,
          upload_status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
      `;

      const [result] = await pool.execute(query, [
        interviewId,
        userId,
        originalFilename,
        fileSize,
        totalChunks,
        duration,
      ]);

      console.log(
        `✅ Screen recording record created with ID: ${result.insertId}`,
      );
      return result.insertId;
    } catch (error) {
      console.error("❌ Error creating screen recording record:", error);
      throw new APIERR(500, "Failed to create screen recording record");
    }
  }

  /**
   * Get screen recording by ID
   */
  static async getById(screenRecordingId) {
    try {
      const query = `
        SELECT * FROM interview_screen_recordings 
        WHERE id = ?
      `;

      const [rows] = await pool.execute(query, [screenRecordingId]);

      if (rows.length === 0) {
        return null;
      }

      return rows[0];
    } catch (error) {
      console.error("❌ Error getting screen recording:", error);
      throw new APIERR(500, "Failed to get screen recording");
    }
  }

  /**
   * Get all screen recordings for an interview
   */
  static async getByInterviewId(interviewId) {
    try {
      const query = `
        SELECT * FROM interview_screen_recordings 
        WHERE interview_id = ?
        ORDER BY created_at DESC
      `;

      const [rows] = await pool.execute(query, [interviewId]);
      return rows;
    } catch (error) {
      console.error("❌ Error getting interview screen recordings:", error);
      throw new APIERR(500, "Failed to get interview screen recordings");
    }
  }

  /**
   * Update upload status
   */
  static async updateUploadStatus(screenRecordingId, status) {
    try {
      const validStatuses = ["pending", "uploading", "completed", "failed"];
      if (!validStatuses.includes(status)) {
        throw new APIERR(400, `Invalid status: ${status}`);
      }

      const query = `
        UPDATE interview_screen_recordings 
        SET upload_status = ?, updated_at = NOW()
        WHERE id = ?
      `;

      await pool.execute(query, [status, screenRecordingId]);

      console.log(
        `✅ Screen recording ${screenRecordingId} status updated to: ${status}`,
      );
    } catch (error) {
      console.error("❌ Error updating screen recording status:", error);
      throw error;
    }
  }

  /**
   * Update screen recording after upload
   */
  static async updateAfterUpload({
    screenRecordingId,
    ftpPath,
    ftpUrl,
    fileSize,
    duration,
  }) {
    try {
      const query = `
        UPDATE interview_screen_recordings 
        SET 
          ftp_path = ?,
          ftp_url = ?,
          file_size = ?,
          duration = ?,
          upload_status = 'completed',
          updated_at = NOW()
        WHERE id = ?
      `;

      await pool.execute(query, [
        ftpPath,
        ftpUrl,
        fileSize,
        duration,
        screenRecordingId,
      ]);

      console.log(
        `✅ Screen recording ${screenRecordingId} updated after upload`,
      );
    } catch (error) {
      console.error("❌ Error updating screen recording after upload:", error);
      throw new APIERR(500, "Failed to update screen recording");
    }
  }

  /**
   * Save chunk information
   */
  static async saveChunk({
    screenRecordingId,
    chunkNumber,
    chunkSize,
    tempFtpPath,
    checksum,
  }) {
    try {
      const query = `
        INSERT INTO screen_recording_chunks (
          screen_recording_id,
          chunk_number,
          chunk_size,
          temp_ftp_path,
          checksum,
          created_at
        ) VALUES (?, ?, ?, ?, ?, NOW())
      `;

      await pool.execute(query, [
        screenRecordingId,
        chunkNumber,
        chunkSize,
        tempFtpPath,
        checksum,
      ]);
    } catch (error) {
      console.error("❌ Error saving screen recording chunk:", error);
      throw new APIERR(500, "Failed to save screen recording chunk");
    }
  }

  /**
   * Get all chunks for a screen recording
   */
  static async getChunks(screenRecordingId) {
    try {
      const query = `
        SELECT * FROM screen_recording_chunks 
        WHERE screen_recording_id = ?
        ORDER BY chunk_number ASC
      `;

      const [rows] = await pool.execute(query, [screenRecordingId]);
      return rows;
    } catch (error) {
      console.error("❌ Error getting screen recording chunks:", error);
      throw new APIERR(500, "Failed to get screen recording chunks");
    }
  }

  /**
   * Update progress
   */
  static async updateProgress(screenRecordingId, progress) {
    try {
      const query = `
        UPDATE interview_screen_recordings 
        SET upload_progress = ?, updated_at = NOW()
        WHERE id = ?
      `;

      await pool.execute(query, [progress, screenRecordingId]);
    } catch (error) {
      console.error("❌ Error updating screen recording progress:", error);
      throw error;
    }
  }

  /**
   * Update after merge
   */
  static async updateAfterMerge({
    screenRecordingId,
    ftpUrl,
    fileSize,
    duration,
    checksum,
  }) {
    try {
      const query = `
        UPDATE interview_screen_recordings 
        SET 
          ftp_url = ?,
          file_size = ?,
          duration = ?,
          checksum = ?,
          upload_status = 'completed',
          updated_at = NOW()
        WHERE id = ?
      `;

      await pool.execute(query, [
        ftpUrl,
        fileSize,
        duration,
        checksum,
        screenRecordingId,
      ]);

      console.log(
        `✅ Screen recording ${screenRecordingId} updated after merge`,
      );
    } catch (error) {
      console.error("❌ Error updating screen recording after merge:", error);
      throw error;
    }
  }

  /**
   * Mark as failed
   */
  static async markAsFailed(screenRecordingId, errorMessage) {
    try {
      const query = `
        UPDATE interview_screen_recordings 
        SET 
          upload_status = 'failed',
          error_message = ?,
          updated_at = NOW()
        WHERE id = ?
      `;

      await pool.execute(query, [errorMessage, screenRecordingId]);

      console.log(`❌ Screen recording ${screenRecordingId} marked as failed`);
    } catch (error) {
      console.error("❌ Error marking screen recording as failed:", error);
      throw error;
    }
  }

  /**
   * Mark chunks as deleted
   */
  static async markChunksDeleted(screenRecordingId) {
    try {
      const query = `
        UPDATE screen_recording_chunks 
        SET deleted_at = NOW()
        WHERE screen_recording_id = ?
      `;

      await pool.execute(query, [screenRecordingId]);
    } catch (error) {
      console.error(
        "❌ Error marking screen recording chunks as deleted:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get pending uploads
   */
  static async getPendingUploads() {
    try {
      const query = `
        SELECT * FROM interview_screen_recordings 
        WHERE upload_status IN ('pending', 'uploading')
        ORDER BY created_at ASC
      `;

      const [rows] = await pool.execute(query);
      return rows;
    } catch (error) {
      console.error(
        "❌ Error getting pending screen recording uploads:",
        error,
      );
      throw new APIERR(500, "Failed to get pending uploads");
    }
  }

  /**
   * Get upload statistics
   */
  static async getUploadStats(interviewId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN upload_status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN upload_status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN upload_status = 'uploading' THEN 1 ELSE 0 END) as uploading,
          SUM(CASE WHEN upload_status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(file_size) as total_size,
          AVG(upload_progress) as avg_progress
        FROM interview_screen_recordings
        WHERE interview_id = ?
      `;

      const [rows] = await pool.execute(query, [interviewId]);
      return rows[0];
    } catch (error) {
      console.error("❌ Error getting screen recording upload stats:", error);
      throw new APIERR(500, "Failed to get upload stats");
    }
  }
}

module.exports = { InterviewScreenRecording };
