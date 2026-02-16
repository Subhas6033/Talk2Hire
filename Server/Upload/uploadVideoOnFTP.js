const { uploadFileToFTP, downloadFileFromFTP } = require("./uploadOnFTP.js");
const { InterviewVideo } = require("../Models/interviewVideo.models.js");
const { APIERR } = require("../Utils/index.utils.js");
const videoMerger = require("../Service/videoMerger.service.js");
const crypto = require("crypto");

/**
 * Calculate checksum for buffer
 */
function calculateChecksum(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Upload video to FTP and save metadata to database
 */
async function uploadVideoToFTP({
  videoBuffer,
  interviewId,
  userId,
  videoType,
  originalFilename,
  metadata = {},
}) {
  let videoId; // Declare videoId at function scope

  try {
    console.log("🎥 Starting video upload process...", {
      interviewId,
      userId,
      videoType,
      originalFilename,
      bufferSize: videoBuffer.length,
    });

    // Calculate checksum for integrity
    const checksum = calculateChecksum(videoBuffer);
    console.log("🔐 Video checksum:", checksum);

    // 1. Create video record in database
    videoId = await InterviewVideo.create({
      interviewId,
      userId,
      videoType,
      originalFilename,
      fileSize: videoBuffer.length,
      duration: metadata.duration || null,
      videoCodec: metadata.codec || null,
      videoBitrate: metadata.bitrate || null,
      resolution: metadata.resolution || null,
      frameRate: metadata.frameRate || null,
      checksum,
    });

    console.log(" Video record created with ID:", videoId);

    // 2. Update status to uploading
    await InterviewVideo.updateUploadStatus(videoId, "uploading");

    // 3. Upload to FTP
    const ftpRemoteDir = `/public/interview-videos/${interviewId}`;
    const sanitizedFilename = `${videoType}_${Date.now()}_${originalFilename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    console.log("📤 Uploading to FTP:", {
      remoteDir: ftpRemoteDir,
      filename: sanitizedFilename,
    });

    const ftpResult = await uploadFileToFTP(
      videoBuffer,
      sanitizedFilename,
      ftpRemoteDir,
    );

    console.log(" FTP upload successful:", ftpResult);

    // 4. Update video record with FTP details
    await InterviewVideo.updateAfterUpload({
      videoId,
      ftpPath: ftpResult.remotePath,
      ftpUrl: ftpResult.url,
      fileSize: videoBuffer.length,
      duration: metadata.duration || null,
    });

    console.log(" Video upload complete");

    return {
      success: true,
      videoId,
      ftpUrl: ftpResult.url,
      ftpPath: ftpResult.remotePath,
      fileSize: videoBuffer.length,
      checksum,
    };
  } catch (error) {
    console.error("❌ Video upload failed:", error);

    if (videoId) {
      await InterviewVideo.markAsFailed(videoId, error.message);
    }

    throw error;
  }
}

/**
 * Upload video chunk to FTP with integrity checking
 */
async function uploadVideoChunk({
  chunkBuffer,
  videoId,
  chunkNumber,
  totalChunks,
  interviewId,
}) {
  try {
    console.log(`📦 Uploading chunk ${chunkNumber}/${totalChunks}...`);

    // Get video record
    const video = await InterviewVideo.getById(videoId);
    if (!video) {
      throw new APIERR(404, "Video record not found");
    }

    // Calculate chunk checksum
    const chunkChecksum = calculateChecksum(chunkBuffer);
    console.log(`🔐 Chunk ${chunkNumber} checksum:`, chunkChecksum);

    // Upload chunk to temporary FTP location
    const ftpRemoteDir = `/public/interview-videos/${interviewId}/chunks`;
    const chunkFilename = `chunk_${videoId}_${String(chunkNumber).padStart(4, "0")}.webm`;

    const ftpResult = await uploadFileToFTP(
      chunkBuffer,
      chunkFilename,
      ftpRemoteDir,
    );

    // Save chunk information with checksum
    await InterviewVideo.saveChunk({
      videoId,
      chunkNumber,
      chunkSize: chunkBuffer.length,
      tempFtpPath: ftpResult.remotePath,
      checksum: chunkChecksum,
    });

    // Update progress
    const progress = Math.round((chunkNumber / totalChunks) * 100);
    await InterviewVideo.updateProgress(videoId, progress);

    console.log(
      ` Chunk ${chunkNumber}/${totalChunks} uploaded (${progress}%) - Checksum: ${chunkChecksum.substring(0, 8)}...`,
    );

    return {
      success: true,
      chunkNumber,
      ftpPath: ftpResult.remotePath,
      progress,
      checksum: chunkChecksum,
    };
  } catch (error) {
    console.error("❌ Chunk upload failed:", error);
    throw error;
  }
}

/**
 * Finalize video upload by merging all chunks
 */
async function finalizeVideoUpload({ videoId, interviewId }) {
  try {
    console.log("🔄 Finalizing video upload:", videoId);

    const video = await InterviewVideo.getById(videoId);
    if (!video) {
      throw new APIERR(404, "Video record not found");
    }

    // Get all chunks
    const chunks = await InterviewVideo.getChunks(videoId);

    if (!chunks || chunks.length === 0) {
      console.log("⚠️ No chunks found, marking as completed directly");
      await InterviewVideo.updateUploadStatus(videoId, "completed");
      return {
        success: true,
        videoId,
        ftpUrl: video.ftp_url,
      };
    }

    // Verify all chunks are uploaded
    const expectedChunks = video.total_chunks || chunks.length;
    if (chunks.length < expectedChunks) {
      throw new APIERR(
        400,
        `Missing chunks: ${chunks.length}/${expectedChunks} uploaded`,
      );
    }

    console.log(`🎬 Merging ${chunks.length} chunks...`);

    // Use video merger service to merge chunks
    const mergeResult = await videoMerger.mergeVideoChunks(
      videoId,
      interviewId,
    );

    console.log(" Video chunks merged successfully:", mergeResult);

    // Update video with merged file info
    await InterviewVideo.updateAfterMerge({
      videoId,
      ftpUrl: mergeResult.ftpUrl,
      fileSize: mergeResult.fileSize,
      duration: mergeResult.duration,
      checksum: mergeResult.checksum,
    });

    // Delete chunks from FTP to save space
    await cleanupVideoChunks(videoId, chunks);

    return {
      success: true,
      videoId,
      ftpUrl: mergeResult.ftpUrl,
      fileSize: mergeResult.fileSize,
      duration: mergeResult.duration,
    };
  } catch (error) {
    console.error("❌ Video finalization failed:", error);
    await InterviewVideo.markAsFailed(videoId, error.message);
    throw error;
  }
}

/**
 * Clean up video chunks from FTP after merge
 */
async function cleanupVideoChunks(videoId, chunks) {
  try {
    console.log(`🧹 Cleaning up ${chunks.length} video chunks from FTP...`);

    const { deleteFileFromFTP } = require("./uploadOnFTP.js");

    for (const chunk of chunks) {
      try {
        await deleteFileFromFTP(chunk.temp_ftp_path);
        console.log(` Deleted chunk ${chunk.chunk_number} from FTP`);
      } catch (error) {
        console.warn(
          `⚠️ Failed to delete chunk ${chunk.chunk_number}:`,
          error.message,
        );
      }
    }

    // Mark chunks as deleted in database
    await InterviewVideo.markChunksDeleted(videoId);

    console.log(" Chunk cleanup complete");
  } catch (error) {
    console.error("❌ Error cleaning up chunks:", error);
    // Don't throw - cleanup is not critical
  }
}

/**
 * Auto-upload all pending videos for an interview
 */
async function autoUploadInterviewVideos(interviewId) {
  try {
    console.log("🤖 Starting auto-upload for interview:", interviewId);

    const pendingVideos = await InterviewVideo.getPendingUploads();
    const interviewVideos = pendingVideos.filter(
      (v) => v.interview_id === interviewId,
    );

    if (interviewVideos.length === 0) {
      console.log(" No pending videos to upload");
      return { success: true, uploaded: 0 };
    }

    console.log(`📤 Found ${interviewVideos.length} pending videos`);

    const results = [];

    for (const video of interviewVideos) {
      try {
        console.log(`⏳ Processing video ${video.id} (${video.video_type})...`);

        // Check if video has chunks that need merging
        const chunks = await InterviewVideo.getChunks(video.id);

        if (chunks && chunks.length > 0) {
          console.log(
            `🎬 Video has ${chunks.length} chunks, initiating merge...`,
          );

          // Finalize (merge) the chunked video
          const finalizeResult = await finalizeVideoUpload({
            videoId: video.id,
            interviewId,
          });

          results.push({
            videoId: video.id,
            videoType: video.video_type,
            success: true,
            merged: true,
            ftpUrl: finalizeResult.ftpUrl,
          });
        } else {
          // No chunks, just mark as completed
          console.log(` Video ${video.id} has no chunks, marking complete`);
          await InterviewVideo.updateUploadStatus(video.id, "completed");
          results.push({
            videoId: video.id,
            videoType: video.video_type,
            success: true,
            merged: false,
          });
        }

        console.log(` Video ${video.id} processed successfully`);
      } catch (error) {
        console.error(`❌ Failed to process video ${video.id}:`, error);
        await InterviewVideo.markAsFailed(video.id, error.message);
        results.push({
          videoId: video.id,
          videoType: video.video_type,
          success: false,
          error: error.message,
        });
      }
    }

    console.log(" Auto-upload complete:", results);

    return {
      success: true,
      total: interviewVideos.length,
      uploaded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  } catch (error) {
    console.error("❌ Auto-upload failed:", error);
    throw error;
  }
}

/**
 * Merge multiple camera angles for an interview
 */
async function mergeMultipleCameraAngles(
  interviewId,
  outputType = "side-by-side",
) {
  try {
    console.log(`🎥 Merging multiple cameras for interview ${interviewId}...`);

    // Get all completed videos for this interview
    const videos = await InterviewVideo.getByInterviewId(interviewId);
    const completedVideos = videos.filter(
      (v) => v.upload_status === "completed",
    );

    if (completedVideos.length < 2) {
      console.log("⚠️ Not enough camera angles to merge");
      return { success: false, message: "Need at least 2 camera angles" };
    }

    const videoIds = completedVideos.map((v) => v.id);

    // Use video merger to create multi-camera video
    const result = await videoMerger.mergeMultipleCameras(
      videoIds,
      interviewId,
      outputType,
    );

    // Create new video record for merged output
    const mergedVideoId = await InterviewVideo.create({
      interviewId,
      userId: completedVideos[0].user_id,
      videoType: `multi_camera_${outputType}`,
      originalFilename: `merged_${outputType}.webm`,
      fileSize: result.fileSize,
      duration: result.duration,
      ftpPath: result.ftpPath,
      ftpUrl: result.ftpUrl,
      checksum: result.checksum,
    });

    await InterviewVideo.updateUploadStatus(mergedVideoId, "completed");

    console.log(" Multi-camera merge complete:", mergedVideoId);

    return {
      success: true,
      videoId: mergedVideoId,
      ftpUrl: result.ftpUrl,
      fileSize: result.fileSize,
      duration: result.duration,
    };
  } catch (error) {
    console.error("❌ Multi-camera merge failed:", error);
    throw error;
  }
}

/**
 * Verify video integrity
 */
async function verifyVideoIntegrity(videoId) {
  try {
    console.log(`🔍 Verifying integrity of video ${videoId}...`);

    const video = await InterviewVideo.getById(videoId);
    if (!video || !video.ftp_path) {
      throw new APIERR(404, "Video not found or not uploaded");
    }

    // Download video from FTP
    const buffer = await downloadFileFromFTP(video.ftp_path);

    // Calculate checksum
    const actualChecksum = calculateChecksum(buffer);

    // Compare with stored checksum
    if (video.checksum && actualChecksum !== video.checksum) {
      console.error("❌ Checksum mismatch!", {
        expected: video.checksum,
        actual: actualChecksum,
      });

      // Mark video as failed
      await InterviewVideo.markAsFailed(
        videoId,
        "Integrity check failed - checksum mismatch",
      );

      return {
        valid: false,
        error: "Checksum mismatch",
        expected: video.checksum,
        actual: actualChecksum,
      };
    }

    console.log(" Video integrity verified");

    return {
      valid: true,
      checksum: actualChecksum,
      fileSize: buffer.length,
    };
  } catch (error) {
    console.error("❌ Integrity verification failed:", error);
    throw error;
  }
}

/**
 * Get all videos for an interview
 */
async function getInterviewVideos(interviewId) {
  try {
    const videos = await InterviewVideo.getByInterviewId(interviewId);
    return videos;
  } catch (error) {
    console.error("❌ Error getting interview videos:", error);
    throw error;
  }
}

/**
 * Get upload statistics for an interview
 */
async function getVideoUploadStats(interviewId) {
  try {
    const stats = await InterviewVideo.getUploadStats(interviewId);
    return stats;
  } catch (error) {
    console.error("❌ Error getting upload stats:", error);
    throw error;
  }
}

module.exports = {
  uploadVideoToFTP,
  uploadVideoChunk,
  finalizeVideoUpload,
  autoUploadInterviewVideos,
  mergeMultipleCameraAngles,
  verifyVideoIntegrity,
  getInterviewVideos,
  getVideoUploadStats,
};
