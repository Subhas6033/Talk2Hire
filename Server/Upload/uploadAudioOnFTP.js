const crypto = require("crypto");
const { uploadFileToFTP } = require("./uploadOnFTP");
const { InterviewAudio } = require("../Models/InterviewAudio.models");
const { mergeAudioChunks } = require("../Service/audioMerger.service");

/**
 * Upload individual audio chunk to FTP
 */
async function uploadAudioChunk({
  chunkBuffer,
  audioId,
  chunkNumber,
  totalChunks,
  interviewId,
}) {
  try {
    // Generate checksum for chunk integrity
    const checksum = crypto.createHash("md5").update(chunkBuffer).digest("hex");

    // FTP path for temporary chunk storage
    const ftpRemoteDir = `/public/interview-audio-temp/${interviewId}/${audioId}`;
    const filename = `chunk_${String(chunkNumber).padStart(5, "0")}.webm`;

    console.log(`📤 Uploading audio chunk ${chunkNumber} to FTP...`);

    // Upload to FTP
    const uploadResult = await uploadFileToFTP(
      chunkBuffer,
      filename,
      ftpRemoteDir,
    );

    console.log(` Audio chunk ${chunkNumber} uploaded:`, uploadResult.url);

    // Save chunk metadata to database
    await InterviewAudio.saveChunk({
      audioId,
      chunkNumber,
      chunkSize: chunkBuffer.length,
      ftpPath: uploadResult.remotePath,
    });

    // Calculate progress
    const progress =
      totalChunks > 0 ? Math.round((chunkNumber / totalChunks) * 100) : 0;

    return {
      success: true,
      chunkNumber,
      ftpUrl: uploadResult.url,
      ftpPath: uploadResult.remotePath,
      checksum,
      progress,
    };
  } catch (error) {
    console.error(`❌ Error uploading audio chunk ${chunkNumber}:`, error);
    throw error;
  }
}

/**
 * Finalize audio upload by merging chunks
 */
async function finalizeAudioUpload({ audioId, interviewId }) {
  try {
    console.log(`🎵 Finalizing audio upload for audioId ${audioId}...`);

    // Update status to processing
    await InterviewAudio.updateUploadStatus(audioId, "processing");

    // Get audio record
    const audioRecord = await InterviewAudio.getById(audioId);

    if (!audioRecord) {
      throw new Error(`Audio record ${audioId} not found`);
    }

    console.log(`📋 Audio record:`, {
      audioId,
      interviewId: audioRecord.interview_id,
      audioType: audioRecord.audio_type,
      totalChunks: audioRecord.total_chunks,
    });

    // Merge audio chunks using ffmpeg
    const mergeResult = await mergeAudioChunks(audioId);

    console.log(` Audio chunks merged:`, mergeResult);

    // Update audio record with final info
    await InterviewAudio.updateAfterMerge({
      audioId,
      ftpUrl: mergeResult.ftpUrl,
      ftpPath: mergeResult.ftpPath,
      fileSize: mergeResult.fileSize,
      duration: mergeResult.duration,
    });

    // Mark chunks as deleted (they're now merged)
    await InterviewAudio.markChunksDeleted(audioId);

    console.log(` Audio ${audioId} finalized successfully`);

    return {
      success: true,
      audioId,
      ftpUrl: mergeResult.ftpUrl,
      ftpPath: mergeResult.ftpPath,
      fileSize: mergeResult.fileSize,
      duration: mergeResult.duration,
      totalChunks: mergeResult.totalChunks,
    };
  } catch (error) {
    console.error(`❌ Error finalizing audio upload:`, error);

    // Mark as failed
    await InterviewAudio.markAsFailed(audioId, error.message);

    throw error;
  }
}

/**
 * Get audio upload progress
 */
async function getAudioUploadProgress(audioId) {
  try {
    const chunks = await InterviewAudio.getChunks(audioId);
    const audioRecord = await InterviewAudio.getById(audioId);

    const uploadedChunks = chunks.filter(
      (c) => c.upload_status === "uploaded",
    ).length;

    const totalChunks = audioRecord.total_chunks || chunks.length;

    const progress =
      totalChunks > 0 ? Math.round((uploadedChunks / totalChunks) * 100) : 0;

    return {
      audioId,
      uploadedChunks,
      totalChunks,
      progress,
      status: audioRecord.upload_status,
    };
  } catch (error) {
    console.error("❌ Error getting audio upload progress:", error);
    throw error;
  }
}

module.exports = {
  uploadAudioChunk,
  finalizeAudioUpload,
  getAudioUploadProgress,
};
