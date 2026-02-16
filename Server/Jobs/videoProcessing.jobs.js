const { InterviewVideo } = require("../Models/interviewVideo.models");
const {
  autoUploadInterviewVideos,
  finalizeVideoUpload,
  verifyVideoIntegrity,
} = require("../Upload/uploadVideoOnFTP");
const VideoChunkMerger = require("../Service/videoMerger.service");
const config = require("../Config/videoProcessing.config");

class VideoProcessingJobs {
  constructor() {
    this.isProcessing = false;
    this.processingQueue = new Set();
    this.mergeQueue = new Set();
  }

  async autoMergeCompletedInterviews() {
    try {
      console.log(
        "🎬 Checking for completed interviews needing video merge...",
      );

      const interviewsNeedingMerge =
        await this.getCompletedInterviewsNeedingMerge();

      if (interviewsNeedingMerge.length === 0) {
        console.log(" No interviews need video merging");
        return { success: true, merged: 0 };
      }

      console.log(
        `🎬 Found ${interviewsNeedingMerge.length} interviews needing merge`,
      );

      const results = [];

      for (const interview of interviewsNeedingMerge) {
        if (this.mergeQueue.has(interview.id)) {
          console.log(`⏭️ Interview ${interview.id} already being merged`);
          continue;
        }

        this.mergeQueue.add(interview.id);

        try {
          console.log(`🎬 Starting auto-merge for interview ${interview.id}`);

          // Use extended timeout settings for background jobs
          const mergeResult = await this.mergeInterviewVideos(interview.id, {
            timeoutMs: config.merge.maxTimeoutMs,
            skipOnError: config.merge.skipOnError,
            maxRetries: config.merge.maxRetries,
            retryDelayMs: config.merge.initialRetryDelayMs,
          });

          results.push({
            interviewId: interview.id,
            success: true,
            ...mergeResult,
          });

          console.log(` Interview ${interview.id} videos merged successfully`);
        } catch (error) {
          console.error(`❌ Failed to merge interview ${interview.id}:`, error);
          results.push({
            interviewId: interview.id,
            success: false,
            error: error.message,
          });
        } finally {
          this.mergeQueue.delete(interview.id);
        }
      }

      const successCount = results.filter((r) => r.success).length;
      console.log(
        ` Auto-merge complete: ${successCount}/${interviewsNeedingMerge.length} successful`,
      );

      return {
        success: true,
        total: interviewsNeedingMerge.length,
        merged: successCount,
        failed: interviewsNeedingMerge.length - successCount,
        results,
      };
    } catch (error) {
      console.error("❌ Error in auto-merge process:", error);
      throw error;
    }
  }

  /**
   *  Get interviews that are completed but videos not merged
   */
  async getCompletedInterviewsNeedingMerge() {
    try {
      const { pool } = require("../Config/database.config");
      const db = await pool;

      const [interviews] = await db.execute(
        `SELECT DISTINCT i.id, i.user_id, i.created_at,
              COUNT(DISTINCT q.id) as question_count,
              GROUP_CONCAT(DISTINCT v.video_type) as video_types
       FROM interviews i
       LEFT JOIN interview_questions q ON i.id = q.interview_id
       INNER JOIN interview_videos v ON i.id = v.interview_id
       INNER JOIN interview_video_chunks c ON v.id = c.video_id
       WHERE (SELECT COUNT(*) FROM interview_questions WHERE interview_id = i.id) >= 10
       AND c.upload_status = 'uploaded'
       AND (v.ftp_url IS NULL OR v.ftp_url = '' OR v.checksum IS NULL)
       GROUP BY i.id
       HAVING question_count >= 10
       ORDER BY i.created_at DESC
       LIMIT 10`,
      );

      console.log(
        `📊 Found ${interviews.length} interviews with unmerged chunks`,
      );
      return interviews;
    } catch (error) {
      console.error("❌ Error getting interviews needing merge:", error);
      throw error;
    }
  }

  /**
   *  Merge all videos for a specific interview with timeout and retry
   */
  async mergeInterviewVideos(interviewId, options = {}) {
    const {
      timeoutMs = config.merge.baseTimeoutMs,
      skipOnError = config.merge.skipOnError,
      maxRetries = config.merge.maxRetries,
      retryDelayMs = config.merge.initialRetryDelayMs,
    } = options;

    try {
      console.log(`🎬 Merging videos for interview ${interviewId}...`);

      // Get all finalized videos for this interview
      const videos = await InterviewVideo.getByInterviewId(interviewId);

      if (!videos || videos.length === 0) {
        throw new Error(`No videos found for interview ${interviewId}`);
      }

      console.log(`📹 Found ${videos.length} videos to merge`);

      const mergedVideos = [];
      const errors = [];

      // Merge each video's chunks
      for (const video of videos) {
        try {
          // Skip if already has merged video (ftp_url exists and has checksum)
          if (video.ftp_url && video.checksum && video.file_size > 0) {
            console.log(
              `⏭️ Video ${video.video_type} already merged, skipping`,
            );
            mergedVideos.push({
              videoType: video.video_type,
              videoId: video.id,
              ftpUrl: video.ftp_url,
              fileSize: video.file_size,
              alreadyMerged: true,
            });
            continue;
          }

          // Check if video has chunks
          const chunks = await InterviewVideo.getChunks(video.id);
          if (!chunks || chunks.length === 0) {
            console.warn(`⚠️ Video ${video.video_type} has no chunks to merge`);
            continue;
          }

          console.log(
            `🔄 Merging ${chunks.length} chunks for ${video.video_type}...`,
          );

          // Mark as merging
          await InterviewVideo.updateUploadStatus(video.id, "merging");

          // Merge with timeout and retry protection
          const mergeResult = await this.mergeWithTimeoutAndRetry(
            video,
            interviewId,
            chunks.length,
            { timeoutMs, maxRetries, retryDelayMs },
          );

          console.log(` Merged ${video.video_type}:`, mergeResult.ftpUrl);

          mergedVideos.push({
            videoType: video.video_type,
            videoId: video.id,
            ftpUrl: mergeResult.ftpUrl,
            fileSize: mergeResult.fileSize,
            duration: mergeResult.duration,
            checksum: mergeResult.checksum,
          });
        } catch (mergeError) {
          console.error(`❌ Failed to merge ${video.video_type}:`, mergeError);

          errors.push({
            videoType: video.video_type,
            videoId: video.id,
            error: mergeError.message,
            timeout: mergeError.name === "TimeoutError",
          });

          // Mark video as failed
          await InterviewVideo.markAsFailed(video.id, mergeError.message);

          // If skipOnError is false, throw immediately
          if (!skipOnError) {
            throw mergeError;
          }
        }
      }

      console.log(` Merge complete for interview ${interviewId}:`, {
        totalVideos: videos.length,
        merged: mergedVideos.length,
        failed: errors.length,
      });

      return {
        totalVideos: videos.length,
        mergedVideos: mergedVideos.length,
        videos: mergedVideos,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error(`❌ Error merging interview ${interviewId}:`, error);
      throw error;
    }
  }

  /**
   *  Merge with timeout protection and retry logic
   */
  async mergeWithTimeoutAndRetry(video, interviewId, chunkCount, options) {
    const { timeoutMs, maxRetries, retryDelayMs } = options;

    // Calculate dynamic timeout based on chunk count
    const estimatedTime = chunkCount * config.merge.timeoutPerChunkMs;
    const dynamicTimeout = Math.min(
      Math.max(timeoutMs, estimatedTime),
      config.merge.maxTimeoutMs,
    );

    console.log(
      `⏱️ Timeout set to ${Math.round(dynamicTimeout / 1000)}s for ${chunkCount} chunks`,
    );

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Merge attempt ${attempt}/${maxRetries}...`);

        // Wrap merge operation with timeout
        const mergeResult = await this.withTimeout(
          VideoChunkMerger.mergeVideoChunks(video.id, interviewId),
          dynamicTimeout,
          `Merge timeout for ${video.video_type} after ${Math.round(dynamicTimeout / 1000)}s`,
        );

        return mergeResult;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;

        if (error.name === "TimeoutError") {
          console.error(`⏱️ Timeout on attempt ${attempt}/${maxRetries}`);

          if (isLastAttempt) {
            throw new Error(
              `Merge timeout after ${maxRetries} attempts (${chunkCount} chunks)`,
            );
          }

          // Exponential backoff
          const delay =
            retryDelayMs *
            Math.pow(config.merge.retryBackoffMultiplier, attempt - 1);
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        } else {
          // Non-timeout error
          console.error(`❌ Merge error on attempt ${attempt}:`, error.message);

          if (isLastAttempt) {
            throw error;
          }

          await this.sleep(retryDelayMs);
        }
      }
    }
  }

  /**
   *  Timeout wrapper utility
   */
  async withTimeout(promise, timeoutMs, errorMessage) {
    let timeoutHandle;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const error = new Error(
          errorMessage || `Operation timed out after ${timeoutMs}ms`,
        );
        error.name = "TimeoutError";
        reject(error);
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutHandle);
      return result;
    } catch (error) {
      clearTimeout(timeoutHandle);
      throw error;
    }
  }

  /**
   *  Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Process pending video uploads
   * Run every 5 minutes
   */
  async processPendingUploads() {
    if (this.isProcessing) {
      console.log("⚠️ Already processing uploads, skipping...");
      return;
    }

    this.isProcessing = true;

    try {
      console.log("🤖 Starting automated pending upload processing...");

      const pendingVideos = await InterviewVideo.getPendingUploads();

      if (pendingVideos.length === 0) {
        console.log(" No pending uploads to process");
        return;
      }

      console.log(`📹 Found ${pendingVideos.length} pending videos`);

      // Group videos by interview
      const videosByInterview = pendingVideos.reduce((acc, video) => {
        if (!acc[video.interview_id]) {
          acc[video.interview_id] = [];
        }
        acc[video.interview_id].push(video);
        return acc;
      }, {});

      const results = [];

      // Process each interview's videos
      for (const [interviewId, videos] of Object.entries(videosByInterview)) {
        if (this.processingQueue.has(interviewId)) {
          console.log(`⚠️ Interview ${interviewId} already in queue, skipping`);
          continue;
        }

        this.processingQueue.add(interviewId);

        try {
          console.log(
            `📤 Processing ${videos.length} videos for interview ${interviewId}`,
          );

          const result = await autoUploadInterviewVideos(interviewId);
          results.push({ interviewId, ...result });

          console.log(` Interview ${interviewId} processed:`, result);
        } catch (error) {
          console.error(
            `❌ Failed to process interview ${interviewId}:`,
            error,
          );
          results.push({
            interviewId,
            success: false,
            error: error.message,
          });
        } finally {
          this.processingQueue.delete(interviewId);
        }
      }

      console.log(" Automated upload processing complete:", {
        totalInterviews: Object.keys(videosByInterview).length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      });

      return results;
    } catch (error) {
      console.error("❌ Error in automated upload processing:", error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retry failed video uploads
   * Run every 30 minutes
   */
  async retryFailedUploads() {
    try {
      console.log("🔄 Starting retry for failed video uploads...");

      const failedVideos = await InterviewVideo.getFailedUploads();

      if (failedVideos.length === 0) {
        console.log(" No failed uploads to retry");
        return { success: true, retried: 0 };
      }

      console.log(`📹 Found ${failedVideos.length} failed videos to retry`);

      const results = [];

      for (const video of failedVideos) {
        try {
          console.log(
            `🔄 Retrying video ${video.id} (attempt ${video.retry_count + 1})...`,
          );

          // Reset status to pending
          await InterviewVideo.updateUploadStatus(video.id, "pending");

          // Check if video has chunks that need merging
          const chunks = await InterviewVideo.getChunks(video.id);

          if (chunks && chunks.length > 0) {
            // Attempt to finalize/merge
            const result = await finalizeVideoUpload({
              videoId: video.id,
              interviewId: video.interview_id,
            });

            results.push({ videoId: video.id, success: true, merged: true });
          } else {
            // No chunks, mark as needs re-upload
            console.warn(
              `⚠️ Video ${video.id} has no chunks, needs complete re-upload`,
            );
            results.push({
              videoId: video.id,
              success: false,
              reason: "No chunks available",
            });
          }
        } catch (error) {
          console.error(`❌ Retry failed for video ${video.id}:`, error);
          await InterviewVideo.markAsFailed(video.id, error.message);
          results.push({
            videoId: video.id,
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      console.log(
        ` Retry complete: ${successCount}/${failedVideos.length} successful`,
      );

      return {
        success: true,
        total: failedVideos.length,
        retried: successCount,
        failed: failedVideos.length - successCount,
        results,
      };
    } catch (error) {
      console.error("❌ Error in retry process:", error);
      throw error;
    }
  }

  /**
   * Clean up old temporary video chunks
   * Run daily
   */
  async cleanupOldChunks(daysOld = config.cleanup.chunkRetentionDays) {
    try {
      console.log(`🧹 Cleaning up video chunks older than ${daysOld} days...`);

      const { pool } = require("../Config/database.config");
      const db = await pool;

      // Get old chunks to delete from FTP
      const [oldChunks] = await db.execute(
        `SELECT * FROM interview_video_chunks 
         WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
         AND upload_status != 'deleted'`,
        [daysOld],
      );

      console.log(`📦 Found ${oldChunks.length} old chunks to clean up`);

      const { deleteFileFromFTP } = require("../Upload/uploadOnFTP");
      let deletedCount = 0;

      // Delete from FTP
      for (const chunk of oldChunks) {
        try {
          await deleteFileFromFTP(chunk.temp_ftp_path);
          deletedCount++;
          console.log(
            ` Deleted chunk ${chunk.chunk_number} of video ${chunk.video_id}`,
          );
        } catch (error) {
          console.warn(
            `⚠️ Failed to delete chunk ${chunk.id} from FTP:`,
            error.message,
          );
        }
      }

      // Mark as deleted in database
      const [result] = await db.execute(
        `UPDATE interview_video_chunks 
         SET upload_status = 'deleted', deleted_at = NOW()
         WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
         AND upload_status != 'deleted'`,
        [daysOld],
      );

      console.log(
        ` Cleaned up ${deletedCount} chunks from FTP, ${result.affectedRows} records updated`,
      );

      return {
        success: true,
        deletedFromFTP: deletedCount,
        deletedFromDB: result.affectedRows,
      };
    } catch (error) {
      console.error("❌ Error cleaning up chunks:", error);
      throw error;
    }
  }

  /**
   * Clean up old failed uploads
   * Run weekly
   */
  async cleanupOldFailedUploads(
    daysOld = config.cleanup.failedUploadRetentionDays,
  ) {
    try {
      console.log(
        `🧹 Cleaning up failed uploads older than ${daysOld} days...`,
      );

      const deletedCount =
        await InterviewVideo.cleanupOldFailedUploads(daysOld);

      console.log(` Cleaned up ${deletedCount} old failed uploads`);

      return {
        success: true,
        deletedCount,
      };
    } catch (error) {
      console.error("❌ Error cleaning up old failed uploads:", error);
      throw error;
    }
  }

  /**
   * Verify integrity of recently uploaded videos
   * Run every hour
   */
  async verifyRecentUploads(hoursAgo = config.cleanup.verifyRecentHours) {
    try {
      console.log(
        `🔍 Verifying integrity of videos uploaded in last ${hoursAgo} hours...`,
      );

      const { pool } = require("../Config/database.config");
      const db = await pool;

      const [recentVideos] = await db.execute(
        `SELECT id, checksum FROM interview_videos 
         WHERE upload_status = 'completed'
         AND checksum IS NOT NULL
         AND completed_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
         ORDER BY completed_at DESC`,
        [hoursAgo],
      );

      if (recentVideos.length === 0) {
        console.log(" No recent videos to verify");
        return { success: true, verified: 0 };
      }

      console.log(`📹 Found ${recentVideos.length} recent videos to verify`);

      const results = [];

      for (const video of recentVideos) {
        try {
          const verifyResult = await verifyVideoIntegrity(video.id);
          results.push({
            videoId: video.id,
            valid: verifyResult.valid,
          });

          if (!verifyResult.valid) {
            console.error(`❌ Video ${video.id} failed integrity check`);
          }
        } catch (error) {
          console.error(`❌ Error verifying video ${video.id}:`, error);
          results.push({
            videoId: video.id,
            valid: false,
            error: error.message,
          });
        }
      }

      const validCount = results.filter((r) => r.valid).length;
      console.log(
        ` Verification complete: ${validCount}/${recentVideos.length} passed`,
      );

      return {
        success: true,
        total: recentVideos.length,
        valid: validCount,
        invalid: recentVideos.length - validCount,
        results,
      };
    } catch (error) {
      console.error("❌ Error verifying recent uploads:", error);
      throw error;
    }
  }

  /**
   * Get processing queue status
   */
  async getQueueStatus() {
    try {
      const pendingVideos = await InterviewVideo.getPendingUploads();

      const stats = {
        totalPending: pendingVideos.length,
        currentlyProcessing: Array.from(this.processingQueue),
        currentlyMerging: Array.from(this.mergeQueue),
        byStatus: {
          pending: pendingVideos.filter((v) => v.upload_status === "pending")
            .length,
          uploading: pendingVideos.filter(
            (v) => v.upload_status === "uploading",
          ).length,
          merging: pendingVideos.filter((v) => v.upload_status === "merging")
            .length,
        },
        byType: {
          primary_camera: pendingVideos.filter(
            (v) => v.video_type === "primary_camera",
          ).length,
          security_camera: pendingVideos.filter(
            (v) => v.video_type === "security_camera",
          ).length,
          screen_recording: pendingVideos.filter(
            (v) => v.video_type === "screen_recording",
          ).length,
        },
        oldestPending:
          pendingVideos.length > 0 ? pendingVideos[0].created_at : null,
      };

      return stats;
    } catch (error) {
      console.error("❌ Error getting queue status:", error);
      throw error;
    }
  }

  /**
   * Initialize automated job scheduling
   */
  startScheduledJobs() {
    console.log("⏰ Initializing video processing job scheduler...");

    // Auto-merge completed interviews
    setInterval(() => {
      this.autoMergeCompletedInterviews().catch((error) => {
        console.error("❌ Scheduled auto-merge job failed:", error);
      });
    }, config.scheduling.autoMergeIntervalMs);

    // Process pending uploads
    setInterval(() => {
      this.processPendingUploads().catch((error) => {
        console.error("❌ Scheduled pending upload job failed:", error);
      });
    }, config.scheduling.pendingUploadsIntervalMs);

    // Retry failed uploads
    setInterval(() => {
      this.retryFailedUploads().catch((error) => {
        console.error("❌ Scheduled retry job failed:", error);
      });
    }, config.scheduling.retryFailedIntervalMs);

    // Clean up old chunks
    setInterval(() => {
      this.cleanupOldChunks().catch((error) => {
        console.error("❌ Scheduled cleanup job failed:", error);
      });
    }, config.scheduling.cleanupChunksIntervalMs);

    // Verify recent uploads
    setInterval(() => {
      this.verifyRecentUploads().catch((error) => {
        console.error("❌ Scheduled verification job failed:", error);
      });
    }, config.scheduling.verifyUploadsIntervalMs);

    // Clean up old failed uploads
    setInterval(() => {
      this.cleanupOldFailedUploads().catch((error) => {
        console.error("❌ Scheduled old failed cleanup job failed:", error);
      });
    }, config.scheduling.cleanupFailedIntervalMs);

    console.log(" Video processing job scheduler started");
    console.log(
      `  ↳ Auto-merge: Every ${config.scheduling.autoMergeIntervalMs / 60000} minutes`,
    );
    console.log(
      `  ↳ Pending uploads: Every ${config.scheduling.pendingUploadsIntervalMs / 60000} minutes`,
    );
    console.log(
      `  ↳ Retry failed: Every ${config.scheduling.retryFailedIntervalMs / 60000} minutes`,
    );
    console.log(
      `  ↳ Cleanup chunks: Every ${config.scheduling.cleanupChunksIntervalMs / (24 * 60 * 60000)} day(s)`,
    );
    console.log(
      `  ↳ Verify uploads: Every ${config.scheduling.verifyUploadsIntervalMs / 60000} minutes`,
    );
    console.log(
      `  ↳ Cleanup failed: Every ${config.scheduling.cleanupFailedIntervalMs / (7 * 24 * 60 * 60000)} week(s)`,
    );
  }
}

module.exports = new VideoProcessingJobs();
