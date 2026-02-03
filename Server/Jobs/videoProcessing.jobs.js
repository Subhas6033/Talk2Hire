const { InterviewVideo } = require("../Models/interviewVideo.models");
const {
  autoUploadInterviewVideos,
  finalizeVideoUpload,
  verifyVideoIntegrity,
} = require("../Upload/uploadVideoOnFTP");

/**
 * Background Video Processing Jobs
 * Handles automated video upload, retry, cleanup, and verification tasks
 */

class VideoProcessingJobs {
  constructor() {
    this.isProcessing = false;
    this.processingQueue = new Set();
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
        console.log("✅ No pending uploads to process");
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
            `📤 Processing ${videos.length} videos for interview ${interviewId}`
          );

          const result = await autoUploadInterviewVideos(interviewId);
          results.push({ interviewId, ...result });

          console.log(`✅ Interview ${interviewId} processed:`, result);
        } catch (error) {
          console.error(
            `❌ Failed to process interview ${interviewId}:`,
            error
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

      console.log("✅ Automated upload processing complete:", {
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
        console.log("✅ No failed uploads to retry");
        return { success: true, retried: 0 };
      }

      console.log(`📹 Found ${failedVideos.length} failed videos to retry`);

      const results = [];

      for (const video of failedVideos) {
        try {
          console.log(
            `🔄 Retrying video ${video.id} (attempt ${video.retry_count + 1})...`
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
              `⚠️ Video ${video.id} has no chunks, needs complete re-upload`
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
        `✅ Retry complete: ${successCount}/${failedVideos.length} successful`
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
  async cleanupOldChunks(daysOld = 7) {
    try {
      console.log(`🧹 Cleaning up video chunks older than ${daysOld} days...`);

      const { connectDB } = require("../Config/database.config");
      const db = await connectDB();

      // Get old chunks to delete from FTP
      const [oldChunks] = await db.execute(
        `SELECT * FROM interview_video_chunks 
         WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
         AND upload_status != 'deleted'`,
        [daysOld]
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
            `✅ Deleted chunk ${chunk.chunk_number} of video ${chunk.video_id}`
          );
        } catch (error) {
          console.warn(
            `⚠️ Failed to delete chunk ${chunk.id} from FTP:`,
            error.message
          );
        }
      }

      // Mark as deleted in database
      const [result] = await db.execute(
        `UPDATE interview_video_chunks 
         SET upload_status = 'deleted', deleted_at = NOW()
         WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
         AND upload_status != 'deleted'`,
        [daysOld]
      );

      db.release();

      console.log(
        `✅ Cleaned up ${deletedCount} chunks from FTP, ${result.affectedRows} records updated`
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
  async cleanupOldFailedUploads(daysOld = 30) {
    try {
      console.log(
        `🧹 Cleaning up failed uploads older than ${daysOld} days...`
      );

      const deletedCount =
        await InterviewVideo.cleanupOldFailedUploads(daysOld);

      console.log(`✅ Cleaned up ${deletedCount} old failed uploads`);

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
  async verifyRecentUploads(hoursAgo = 24) {
    try {
      console.log(
        `🔍 Verifying integrity of videos uploaded in last ${hoursAgo} hours...`
      );

      const { connectDB } = require("../Config/database.config");
      const db = await connectDB();

      const [recentVideos] = await db.execute(
        `SELECT id, checksum FROM interview_videos 
         WHERE upload_status = 'completed'
         AND checksum IS NOT NULL
         AND completed_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
         ORDER BY completed_at DESC`,
        [hoursAgo]
      );

      db.release();

      if (recentVideos.length === 0) {
        console.log("✅ No recent videos to verify");
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
        `✅ Verification complete: ${validCount}/${recentVideos.length} passed`
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
        byStatus: {
          pending: pendingVideos.filter((v) => v.upload_status === "pending")
            .length,
          uploading: pendingVideos.filter(
            (v) => v.upload_status === "uploading"
          ).length,
          merging: pendingVideos.filter((v) => v.upload_status === "merging")
            .length,
        },
        byType: {
          primary_camera: pendingVideos.filter(
            (v) => v.video_type === "primary_camera"
          ).length,
          security_camera: pendingVideos.filter(
            (v) => v.video_type === "security_camera"
          ).length,
          screen_recording: pendingVideos.filter(
            (v) => v.video_type === "screen_recording"
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

    // Process pending uploads every 5 minutes
    setInterval(
      () => {
        this.processPendingUploads().catch((error) => {
          console.error("❌ Scheduled pending upload job failed:", error);
        });
      },
      5 * 60 * 1000
    );

    // Retry failed uploads every 30 minutes
    setInterval(
      () => {
        this.retryFailedUploads().catch((error) => {
          console.error("❌ Scheduled retry job failed:", error);
        });
      },
      30 * 60 * 1000
    );

    // Clean up old chunks daily
    setInterval(
      () => {
        this.cleanupOldChunks().catch((error) => {
          console.error("❌ Scheduled cleanup job failed:", error);
        });
      },
      24 * 60 * 60 * 1000
    );

    // Verify recent uploads every hour
    setInterval(
      () => {
        this.verifyRecentUploads().catch((error) => {
          console.error("❌ Scheduled verification job failed:", error);
        });
      },
      60 * 60 * 1000
    );

    // Clean up old failed uploads weekly
    setInterval(
      () => {
        this.cleanupOldFailedUploads().catch((error) => {
          console.error("❌ Scheduled old failed cleanup job failed:", error);
        });
      },
      7 * 24 * 60 * 60 * 1000
    );

    console.log("✅ Video processing job scheduler started");
  }
}

module.exports = new VideoProcessingJobs();
