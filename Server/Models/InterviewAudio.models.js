const { pool } = require("../Config/database.config");

class InterviewAudio {
  /**
   * Create new audio record
   */
  static async create({
    interviewId,
    userId,
    audioType = "mixed_audio",
    fileSize = 0,
    totalChunks = 0,
  }) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO interview_audio 
         (interview_id, user_id, audio_type, file_size, total_chunks, upload_status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [interviewId, userId, audioType, fileSize, totalChunks],
      );

      console.log("✅ Audio record created:", result.insertId);
      return result.insertId;
    } catch (error) {
      console.error("❌ Error creating audio record:", error);
      throw error;
    }
  }

  /**
   * Get audio record by ID
   */
  static async getById(audioId) {
    try {
      const [rows] = await pool.execute(
        `SELECT * FROM interview_audio WHERE id = ?`,
        [audioId],
      );

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("❌ Error getting audio record:", error);
      throw error;
    }
  }

  /**
   * Get audio by interview ID
   */
  static async getByInterviewId(interviewId) {
    try {
      const [rows] = await pool.execute(
        `SELECT * FROM interview_audio WHERE interview_id = ?`,
        [interviewId],
      );

      return rows;
    } catch (error) {
      console.error("❌ Error getting audio by interview:", error);
      throw error;
    }
  }

  /**
   * Save audio chunk information
   */
  static async saveChunk({ audioId, chunkNumber, chunkSize, ftpPath }) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO interview_audio_chunks 
         (audio_id, chunk_number, chunk_size, temp_ftp_path, upload_status)
         VALUES (?, ?, ?, ?, 'uploaded')`,
        [audioId, chunkNumber, chunkSize, ftpPath],
      );

      return result.insertId;
    } catch (error) {
      console.error("❌ Error saving audio chunk:", error);
      throw error;
    }
  }

  /**
   * Get all chunks for an audio record
   */
  static async getChunks(audioId) {
    try {
      const [rows] = await pool.execute(
        `SELECT * FROM interview_audio_chunks 
         WHERE audio_id = ? 
         ORDER BY chunk_number ASC`,
        [audioId],
      );

      return rows;
    } catch (error) {
      console.error("❌ Error getting audio chunks:", error);
      throw error;
    }
  }

  /**
   * Update upload status
   */
  static async updateUploadStatus(audioId, status) {
    try {
      await pool.execute(
        `UPDATE interview_audio 
         SET upload_status = ?,
             completed_at = CASE WHEN ? = 'completed' THEN NOW() ELSE completed_at END
         WHERE id = ?`,
        [status, status, audioId],
      );

      console.log(`✅ Audio ${audioId} status updated to: ${status}`);
    } catch (error) {
      console.error("❌ Error updating audio status:", error);
      throw error;
    }
  }

  /**
   * Update after merge
   */
  static async updateAfterMerge({
    audioId,
    ftpUrl,
    ftpPath,
    fileSize,
    duration,
  }) {
    try {
      await pool.execute(
        `UPDATE interview_audio 
         SET ftp_url = ?, 
             ftp_path = ?,
             file_size = ?, 
             duration = ?,
             upload_status = 'completed',
             completed_at = NOW()
         WHERE id = ?`,
        [ftpUrl, ftpPath, fileSize, duration, audioId],
      );

      console.log(`✅ Audio ${audioId} updated after merge`);
    } catch (error) {
      console.error("❌ Error updating audio after merge:", error);
      throw error;
    }
  }

  /**
   * Mark as failed
   */
  static async markAsFailed(audioId, errorMessage) {
    try {
      await pool.execute(
        `UPDATE interview_audio 
         SET upload_status = 'failed',
             error_message = ?
         WHERE id = ?`,
        [errorMessage, audioId],
      );

      console.log(`❌ Audio ${audioId} marked as failed: ${errorMessage}`);
    } catch (error) {
      console.error("❌ Error marking audio as failed:", error);
      throw error;
    }
  }

  /**
   * Delete audio chunks after merge
   */
  static async markChunksDeleted(audioId) {
    try {
      await pool.execute(
        `UPDATE interview_audio_chunks 
         SET upload_status = 'deleted'
         WHERE audio_id = ?`,
        [audioId],
      );

      console.log(`🧹 Audio chunks for ${audioId} marked as deleted`);
    } catch (error) {
      console.error("❌ Error marking chunks as deleted:", error);
      throw error;
    }
  }

  /**
   * Get pending uploads
   */
  static async getPendingUploads() {
    try {
      const [rows] = await pool.execute(
        `SELECT * FROM interview_audio 
         WHERE upload_status IN ('pending', 'uploading')
         ORDER BY created_at ASC`,
      );

      return rows;
    } catch (error) {
      console.error("❌ Error getting pending audio uploads:", error);
      throw error;
    }
  }

  /**
   * Get upload statistics
   */
  static async getUploadStats(interviewId) {
    try {
      const [stats] = await pool.execute(
        `SELECT 
           COUNT(*) as total_audio,
           SUM(CASE WHEN upload_status = 'completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN upload_status = 'pending' THEN 1 ELSE 0 END) as pending,
           SUM(CASE WHEN upload_status = 'uploading' THEN 1 ELSE 0 END) as uploading,
           SUM(CASE WHEN upload_status = 'failed' THEN 1 ELSE 0 END) as failed,
           SUM(file_size) as total_size,
           SUM(duration) as total_duration
         FROM interview_audio 
         WHERE interview_id = ?`,
        [interviewId],
      );

      return stats[0];
    } catch (error) {
      console.error("❌ Error getting upload stats:", error);
      throw error;
    }
  }

  /**
   * Delete audio record and chunks
   */
  static async delete(audioId) {
    try {
      // Delete chunks first
      await pool.execute(
        `DELETE FROM interview_audio_chunks WHERE audio_id = ?`,
        [audioId],
      );

      // Delete audio record
      await pool.execute(`DELETE FROM interview_audio WHERE id = ?`, [audioId]);

      console.log(`✅ Audio ${audioId} deleted`);
    } catch (error) {
      console.error("❌ Error deleting audio:", error);
      throw error;
    }
  }
}

module.exports = { InterviewAudio };
