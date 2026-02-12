const { uploadFileToFTP, downloadFileFromFTP } = require("./uploadOnFTP.js");
const {
  InterviewScreenRecording,
} = require("../Models/InterviewScreenRecording.models.js");
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
 * Upload screen recording chunk to FTP
 */
async function uploadScreenRecordingChunk({
  chunkBuffer,
  screenRecordingId,
  chunkNumber,
  totalChunks,
  interviewId,
}) {
  try {
    console.log(`📦 Uploading screen chunk ${chunkNumber}/${totalChunks}...`);

    // Get screen recording record
    const screenRecording =
      await InterviewScreenRecording.getById(screenRecordingId);
    if (!screenRecording) {
      throw new APIERR(404, "Screen recording record not found");
    }

    // Calculate chunk checksum
    const chunkChecksum = calculateChecksum(chunkBuffer);
    console.log(`🔐 Screen chunk ${chunkNumber} checksum:`, chunkChecksum);

    // Upload chunk to temporary FTP location
    const ftpRemoteDir = `/public/interview-videos/${interviewId}/screen-chunks`;
    const chunkFilename = `screen_chunk_${screenRecordingId}_${String(chunkNumber).padStart(4, "0")}.webm`;

    const ftpResult = await uploadFileToFTP(
      chunkBuffer,
      chunkFilename,
      ftpRemoteDir,
    );

    // Save chunk information with checksum
    await InterviewScreenRecording.saveChunk({
      screenRecordingId,
      chunkNumber,
      chunkSize: chunkBuffer.length,
      tempFtpPath: ftpResult.remotePath,
      checksum: chunkChecksum,
    });

    // Update progress
    const progress = Math.round((chunkNumber / totalChunks) * 100);
    await InterviewScreenRecording.updateProgress(screenRecordingId, progress);

    console.log(
      `✅ Screen chunk ${chunkNumber}/${totalChunks} uploaded (${progress}%) - Checksum: ${chunkChecksum.substring(0, 8)}...`,
    );

    return {
      success: true,
      chunkNumber,
      ftpPath: ftpResult.remotePath,
      progress,
      checksum: chunkChecksum,
    };
  } catch (error) {
    console.error("❌ Screen chunk upload failed:", error);
    throw error;
  }
}

/**
 * Finalize screen recording upload by merging all chunks
 */
async function finalizeScreenRecordingUpload({
  screenRecordingId,
  interviewId,
}) {
  try {
    console.log("🔄 Finalizing screen recording upload:", screenRecordingId);

    const screenRecording =
      await InterviewScreenRecording.getById(screenRecordingId);
    if (!screenRecording) {
      throw new APIERR(404, "Screen recording record not found");
    }

    // Get all chunks
    const chunks = await InterviewScreenRecording.getChunks(screenRecordingId);

    if (!chunks || chunks.length === 0) {
      console.log("⚠️ No screen chunks found, marking as completed directly");
      await InterviewScreenRecording.updateUploadStatus(
        screenRecordingId,
        "completed",
      );
      return {
        success: true,
        screenRecordingId,
        ftpUrl: screenRecording.ftp_url,
      };
    }

    // Verify all chunks are uploaded
    const expectedChunks = screenRecording.total_chunks || chunks.length;
    if (chunks.length < expectedChunks) {
      throw new APIERR(
        400,
        `Missing screen chunks: ${chunks.length}/${expectedChunks} uploaded`,
      );
    }

    console.log(`🎬 Merging ${chunks.length} screen chunks...`);

    // Use video merger service to merge chunks
    const mergeResult = await videoMerger.mergeScreenRecordingChunks(
      screenRecordingId,
      interviewId,
    );

    console.log("✅ Screen recording chunks merged successfully:", mergeResult);

    // Update screen recording with merged file info
    await InterviewScreenRecording.updateAfterMerge({
      screenRecordingId,
      ftpUrl: mergeResult.ftpUrl,
      fileSize: mergeResult.fileSize,
      duration: mergeResult.duration,
      checksum: mergeResult.checksum,
    });

    // Delete chunks from FTP to save space
    await cleanupScreenRecordingChunks(screenRecordingId, chunks);

    return {
      success: true,
      screenRecordingId,
      ftpUrl: mergeResult.ftpUrl,
      fileSize: mergeResult.fileSize,
      duration: mergeResult.duration,
    };
  } catch (error) {
    console.error("❌ Screen recording finalization failed:", error);
    await InterviewScreenRecording.markAsFailed(
      screenRecordingId,
      error.message,
    );
    throw error;
  }
}

/**
 * Clean up screen recording chunks from FTP after merge
 */
async function cleanupScreenRecordingChunks(screenRecordingId, chunks) {
  try {
    console.log(
      `🧹 Cleaning up ${chunks.length} screen recording chunks from FTP...`,
    );

    const { deleteFileFromFTP } = require("./uploadOnFTP.js");

    for (const chunk of chunks) {
      try {
        await deleteFileFromFTP(chunk.temp_ftp_path);
        console.log(`✅ Deleted screen chunk ${chunk.chunk_number} from FTP`);
      } catch (error) {
        console.warn(
          `⚠️ Failed to delete screen chunk ${chunk.chunk_number}:`,
          error.message,
        );
      }
    }

    // Mark chunks as deleted in database
    await InterviewScreenRecording.markChunksDeleted(screenRecordingId);

    console.log("✅ Screen chunk cleanup complete");
  } catch (error) {
    console.error("❌ Error cleaning up screen chunks:", error);
    // Don't throw - cleanup is not critical
  }
}

/**
 * Verify screen recording integrity
 */
async function verifyScreenRecordingIntegrity(screenRecordingId) {
  try {
    console.log(
      `🔍 Verifying integrity of screen recording ${screenRecordingId}...`,
    );

    const screenRecording =
      await InterviewScreenRecording.getById(screenRecordingId);
    if (!screenRecording || !screenRecording.ftp_path) {
      throw new APIERR(404, "Screen recording not found or not uploaded");
    }

    // Download screen recording from FTP
    const buffer = await downloadFileFromFTP(screenRecording.ftp_path);

    // Calculate checksum
    const actualChecksum = calculateChecksum(buffer);

    // Compare with stored checksum
    if (
      screenRecording.checksum &&
      actualChecksum !== screenRecording.checksum
    ) {
      console.error("❌ Screen recording checksum mismatch!", {
        expected: screenRecording.checksum,
        actual: actualChecksum,
      });

      // Mark screen recording as failed
      await InterviewScreenRecording.markAsFailed(
        screenRecordingId,
        "Integrity check failed - checksum mismatch",
      );

      return {
        valid: false,
        error: "Checksum mismatch",
        expected: screenRecording.checksum,
        actual: actualChecksum,
      };
    }

    console.log("✅ Screen recording integrity verified");

    return {
      valid: true,
      checksum: actualChecksum,
      fileSize: buffer.length,
    };
  } catch (error) {
    console.error("❌ Screen recording integrity verification failed:", error);
    throw error;
  }
}

/**
 * Get all screen recordings for an interview
 */
async function getInterviewScreenRecordings(interviewId) {
  try {
    const screenRecordings =
      await InterviewScreenRecording.getByInterviewId(interviewId);
    return screenRecordings;
  } catch (error) {
    console.error("❌ Error getting interview screen recordings:", error);
    throw error;
  }
}

/**
 * Get upload statistics for an interview
 */
async function getScreenRecordingUploadStats(interviewId) {
  try {
    const stats = await InterviewScreenRecording.getUploadStats(interviewId);
    return stats;
  } catch (error) {
    console.error("❌ Error getting screen recording upload stats:", error);
    throw error;
  }
}

/**
 * Auto-upload all pending screen recordings for an interview
 */
async function autoUploadInterviewScreenRecordings(interviewId) {
  try {
    console.log("🤖 Starting auto-upload for screen recordings:", interviewId);

    const pendingScreenRecordings =
      await InterviewScreenRecording.getPendingUploads();
    const interviewScreenRecordings = pendingScreenRecordings.filter(
      (sr) => sr.interview_id === interviewId,
    );

    if (interviewScreenRecordings.length === 0) {
      console.log("✅ No pending screen recordings to upload");
      return { success: true, uploaded: 0 };
    }

    console.log(
      `📤 Found ${interviewScreenRecordings.length} pending screen recordings`,
    );

    const results = [];

    for (const screenRecording of interviewScreenRecordings) {
      try {
        console.log(`⏳ Processing screen recording ${screenRecording.id}...`);

        // Check if screen recording has chunks that need merging
        const chunks = await InterviewScreenRecording.getChunks(
          screenRecording.id,
        );

        if (chunks && chunks.length > 0) {
          console.log(
            `🎬 Screen recording has ${chunks.length} chunks, initiating merge...`,
          );

          // Finalize (merge) the chunked screen recording
          const finalizeResult = await finalizeScreenRecordingUpload({
            screenRecordingId: screenRecording.id,
            interviewId,
          });

          results.push({
            screenRecordingId: screenRecording.id,
            success: true,
            merged: true,
            ftpUrl: finalizeResult.ftpUrl,
          });
        } else {
          // No chunks, just mark as completed
          console.log(
            `✅ Screen recording ${screenRecording.id} has no chunks, marking complete`,
          );
          await InterviewScreenRecording.updateUploadStatus(
            screenRecording.id,
            "completed",
          );
          results.push({
            screenRecordingId: screenRecording.id,
            success: true,
            merged: false,
          });
        }

        console.log(
          `✅ Screen recording ${screenRecording.id} processed successfully`,
        );
      } catch (error) {
        console.error(
          `❌ Failed to process screen recording ${screenRecording.id}:`,
          error,
        );
        await InterviewScreenRecording.markAsFailed(
          screenRecording.id,
          error.message,
        );
        results.push({
          screenRecordingId: screenRecording.id,
          success: false,
          error: error.message,
        });
      }
    }

    console.log("✅ Screen recording auto-upload complete:", results);

    return {
      success: true,
      total: interviewScreenRecordings.length,
      uploaded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  } catch (error) {
    console.error("❌ Screen recording auto-upload failed:", error);
    throw error;
  }
}

module.exports = {
  uploadScreenRecordingChunk,
  finalizeScreenRecordingUpload,
  cleanupScreenRecordingChunks,
  verifyScreenRecordingIntegrity,
  getInterviewScreenRecordings,
  getScreenRecordingUploadStats,
  autoUploadInterviewScreenRecordings,
};
