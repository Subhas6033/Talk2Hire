const { autoUploadInterviewVideos } = require("../Upload/uploadVideoOnFTP");
const { InterviewVideo } = require("../Models/interviewVideo.models");

/**
 * Automatically trigger video uploads when interview ends
 * This should be called from the socket.io interview completion handler
 */
async function triggerAutoVideoUpload(interviewId) {
  try {
    console.log(
      "🎬 Interview ended - triggering automatic video upload:",
      interviewId,
    );

    // Small delay to ensure all video chunks have been received
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if there are any videos to upload
    const videos = await InterviewVideo.getByInterviewId(interviewId);

    if (videos.length === 0) {
      console.log("⚠️ No videos found for interview:", interviewId);
      return {
        success: true,
        message: "No videos to upload",
        uploaded: 0,
      };
    }

    console.log(
      `📹 Found ${videos.length} videos for interview ${interviewId}`,
    );

    // Trigger automatic upload
    const result = await autoUploadInterviewVideos(interviewId);

    console.log("✅ Automatic video upload complete:", result);

    return result;
  } catch (error) {
    console.error("❌ Error in automatic video upload:", error);

    // Don't throw error - log it and continue
    // Video upload failures shouldn't block interview completion
    return {
      success: false,
      error: error.message,
      uploaded: 0,
    };
  }
}

/**
 * Background job to retry failed video uploads
 * Can be run periodically (e.g., via cron job)
 */
async function retryFailedUploads() {
  try {
    console.log("🔄 Starting retry for failed video uploads...");

    const pendingVideos = await InterviewVideo.getPendingUploads();

    if (pendingVideos.length === 0) {
      console.log("✅ No failed uploads to retry");
      return { success: true, retried: 0 };
    }

    console.log(`📹 Found ${pendingVideos.length} videos to retry`);

    const results = [];

    for (const video of pendingVideos) {
      try {
        console.log(`🔄 Retrying video ${video.id}...`);

        // Attempt to re-upload
        await InterviewVideo.updateUploadStatus(video.id, "uploading");

        // In production, you'd retrieve the video buffer from temp storage
        // and re-upload it. For now, just mark as completed if it exists
        if (video.ftp_url) {
          await InterviewVideo.updateUploadStatus(video.id, "completed");
          results.push({ videoId: video.id, success: true });
        } else {
          await InterviewVideo.markAsFailed(
            video.id,
            "No video buffer available for retry",
          );
          results.push({ videoId: video.id, success: false });
        }
      } catch (error) {
        console.error(`❌ Retry failed for video ${video.id}:`, error);
        await InterviewVideo.markAsFailed(video.id, error.message);
        results.push({ videoId: video.id, success: false });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(
      `✅ Retry complete: ${successCount}/${pendingVideos.length} successful`,
    );

    return {
      success: true,
      total: pendingVideos.length,
      retried: successCount,
      failed: pendingVideos.length - successCount,
      results,
    };
  } catch (error) {
    console.error("❌ Error in retry process:", error);
    throw error;
  }
}

/**
 * Clean up old temporary video chunks
 */
async function cleanupOldChunks(daysOld = 7) {
  try {
    console.log(`🧹 Cleaning up video chunks older than ${daysOld} days...`);

    const { pool } = require("../Config/database.config");
    const db = pool;

    const [result] = await db.execute(
      `DELETE FROM interview_video_chunks 
       WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
       AND upload_status = 'uploaded'`,
      [daysOld],
    );

    console.log(`✅ Cleaned up ${result.affectedRows} old chunks`);

    return {
      success: true,
      deletedChunks: result.affectedRows,
    };
  } catch (error) {
    console.error("❌ Error cleaning up chunks:", error);
    throw error;
  }
}

/**
 * Get video upload queue status
 */
async function getUploadQueueStatus() {
  try {
    const pendingVideos = await InterviewVideo.getPendingUploads();

    const stats = {
      totalPending: pendingVideos.length,
      byStatus: {
        pending: pendingVideos.filter((v) => v.upload_status === "pending")
          .length,
        uploading: pendingVideos.filter((v) => v.upload_status === "uploading")
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

module.exports = {
  triggerAutoVideoUpload,
  retryFailedUploads,
  cleanupOldChunks,
  getUploadQueueStatus,
};
