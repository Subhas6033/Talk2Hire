const {
  uploadVideoToFTP,
  uploadVideoChunk,
  finalizeVideoUpload,
  getInterviewVideos,
  getVideoUploadStats,
  mergeMultipleCameraAngles,
  verifyVideoIntegrity,
} = require("../Upload/uploadVideoOnFTP.js");
const { asyncHandler, APIRES, APIERR } = require("../Utils/index.utils.js");
const { InterviewVideo } = require("../Models/interviewVideo.models.js");

// Upload the video chunks
const uploadVideoChunkController = asyncHandler(async (req, res) => {
  const {
    interviewId,
    userId,
    videoType,
    chunkNumber,
    totalChunks,
    timestamp,
  } = req.body;

  if (!interviewId || !userId || !videoType) {
    throw new APIERR(400, "interviewId, userId, and videoType are required");
  }

  if (!req.file) {
    throw new APIERR(400, "Video chunk file is required");
  }

  console.log("📦 Received video chunk:", {
    interviewId,
    userId,
    videoType,
    chunkNumber: chunkNumber || "unknown",
    size: req.file.size,
  });

  try {
    // Get or create video record
    let video = await InterviewVideo.getByInterviewAndType(
      interviewId,
      videoType,
    );

    if (!video) {
      // Create new video record
      const videoId = await InterviewVideo.create({
        interviewId,
        userId,
        videoType,
        originalFilename: req.file.originalname,
        fileSize: 0,
        totalChunks: parseInt(totalChunks) || 1,
      });

      video = await InterviewVideo.getById(videoId);
    }

    // Upload chunk to FTP
    const result = await uploadVideoChunk({
      chunkBuffer: req.file.buffer,
      videoId: video.id,
      chunkNumber: parseInt(chunkNumber) || 1,
      totalChunks: parseInt(totalChunks) || 1,
      interviewId,
    });

    res.status(200).json(
      new APIRES(200, {
        message: "Video chunk uploaded successfully",
        data: {
          videoId: video.id,
          chunkNumber: result.chunkNumber,
          progress: result.progress,
          ftpPath: result.ftpPath,
          checksum: result.checksum,
        },
      }),
    );
  } catch (error) {
    console.error("❌ Error uploading video chunk:", error);
    throw error;
  }
});

// Upload the final video
const uploadVideoFinalController = asyncHandler(async (req, res) => {
  const { interviewId, userId, videoType, isFinal, timestamp } = req.body;

  if (!interviewId || !userId) {
    throw new APIERR(400, "interviewId and userId are required");
  }

  if (!req.file) {
    throw new APIERR(400, "Video file is required");
  }

  const type = videoType || "primary_camera";

  console.log("🎥 Uploading final video:", {
    interviewId,
    userId,
    videoType: type,
    size: req.file.size,
    isFinal,
  });

  try {
    // Extract video metadata from filename if available
    const metadata = {
      duration: null,
      codec: req.file.mimetype.includes("webm") ? "vp9" : "h264",
      resolution: null,
      bitrate: null,
    };

    // Upload complete video to FTP
    const result = await uploadVideoToFTP({
      videoBuffer: req.file.buffer,
      interviewId,
      userId,
      videoType: type,
      originalFilename: req.file.originalname,
      metadata,
    });

    console.log(" Final video uploaded successfully:", result.ftpUrl);

    res.status(200).json(
      new APIRES(200, {
        message: "Final video uploaded successfully",
        data: {
          videoId: result.videoId,
          ftpUrl: result.ftpUrl,
          ftpPath: result.ftpPath,
          fileSize: result.fileSize,
          checksum: result.checksum,
        },
      }),
    );
  } catch (error) {
    console.error("❌ Error uploading final video:", error);
    throw error;
  }
});

// Upload the finalized chunked video
const finalizeChunkedVideoController = asyncHandler(async (req, res) => {
  const { interviewId, videoId } = req.params;

  if (!interviewId || !videoId) {
    throw new APIERR(400, "Interview ID and Video ID are required");
  }

  console.log(
    `🎬 Finalizing chunked video ${videoId} for interview ${interviewId}`,
  );

  try {
    const result = await finalizeVideoUpload({ videoId, interviewId });

    res.status(200).json(
      new APIRES(200, {
        message: "Video finalized successfully",
        data: result,
      }),
    );
  } catch (error) {
    console.error("❌ Error finalizing video:", error);
    throw error;
  }
});

// Get all the interview videos
const getInterviewVideosController = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;

  if (!interviewId) {
    throw new APIERR(400, "Interview ID is required");
  }

  try {
    const videos = await getInterviewVideos(interviewId);

    res.status(200).json(
      new APIRES(200, {
        message: "Interview videos retrieved successfully",
        data: {
          interviewId,
          totalVideos: videos.length,
          videos: videos.map((v) => ({
            id: v.id,
            videoType: v.video_type,
            ftpUrl: v.ftp_url,
            fileSize: v.file_size,
            duration: v.duration,
            uploadStatus: v.upload_status,
            uploadProgress: v.upload_progress,
            resolution: v.resolution,
            checksum: v.checksum,
            totalChunks: v.total_chunks,
            uploadedChunks: v.uploaded_chunks,
            createdAt: v.created_at,
            completedAt: v.completed_at,
          })),
        },
      }),
    );
  } catch (error) {
    console.error("❌ Error getting interview videos:", error);
    throw error;
  }
});

// Get video upload statistics
const getVideoStatsController = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;

  if (!interviewId) {
    throw new APIERR(400, "Interview ID is required");
  }

  try {
    const stats = await getVideoUploadStats(interviewId);

    res.status(200).json(
      new APIRES(200, {
        message: "Video statistics retrieved successfully",
        data: stats,
      }),
    );
  } catch (error) {
    console.error("❌ Error getting video stats:", error);
    throw error;
  }
});

// Get the details of the video statistics
const getDetailedStatsController = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;

  if (!interviewId) {
    throw new APIERR(400, "Interview ID is required");
  }

  try {
    const stats = await InterviewVideo.getDetailedStats(interviewId);

    res.status(200).json(
      new APIRES(200, {
        message: "Detailed statistics retrieved successfully",
        data: stats,
      }),
    );
  } catch (error) {
    console.error("❌ Error getting detailed stats:", error);
    throw error;
  }
});

// Manually add the video
const manualUploadVideosController = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;

  if (!interviewId) {
    throw new APIERR(400, "Interview ID is required");
  }

  try {
    const {
      autoUploadInterviewVideos,
    } = require("../Upload/uploadVideoOnFTP.js");

    console.log(
      "🤖 Manually triggering video upload for interview:",
      interviewId,
    );

    const result = await autoUploadInterviewVideos(interviewId);

    res.status(200).json(
      new APIRES(200, {
        message: "Video upload process completed",
        data: result,
      }),
    );
  } catch (error) {
    console.error("❌ Error in manual video upload:", error);
    throw error;
  }
});

// Merge multiple camera angle
const mergeCameraAnglesController = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;
  const { outputType } = req.body; // 'side-by-side', 'grid', 'picture-in-picture'

  if (!interviewId) {
    throw new APIERR(400, "Interview ID is required");
  }

  const type = outputType || "side-by-side";

  console.log(
    `🎥 Merging camera angles for interview ${interviewId} (${type})`,
  );

  try {
    const result = await mergeMultipleCameraAngles(interviewId, type);

    res.status(200).json(
      new APIRES(200, {
        message: "Camera angles merged successfully",
        data: result,
      }),
    );
  } catch (error) {
    console.error("❌ Error merging camera angles:", error);
    throw error;
  }
});

// Verify the video integrity
const verifyVideoIntegrityController = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new APIERR(400, "Video ID is required");
  }

  console.log(`🔍 Verifying integrity of video ${videoId}`);

  try {
    const result = await verifyVideoIntegrity(videoId);

    res.status(200).json(
      new APIRES(200, {
        message: result.valid
          ? "Video integrity verified"
          : "Video integrity check failed",
        data: result,
      }),
    );
  } catch (error) {
    console.error("❌ Error verifying video integrity:", error);
    throw error;
  }
});

// Delete video
const deleteVideoController = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new APIERR(400, "Video ID is required");
  }

  try {
    const video = await InterviewVideo.getById(videoId);

    if (!video) {
      throw new APIERR(404, "Video not found");
    }

    // Delete from FTP if exists
    if (video.ftp_path) {
      try {
        const { deleteFileFromFTP } = require("../Upload/uploadOnFTP");
        await deleteFileFromFTP(video.ftp_path);
        console.log(" Video deleted from FTP");
      } catch (ftpError) {
        console.error("⚠️ Failed to delete from FTP:", ftpError);
      }
    }

    // Delete chunks from FTP
    const chunks = await InterviewVideo.getChunks(videoId);
    if (chunks && chunks.length > 0) {
      const { deleteFileFromFTP } = require("../Upload/uploadOnFTP");
      for (const chunk of chunks) {
        try {
          await deleteFileFromFTP(chunk.temp_ftp_path);
        } catch (error) {
          console.warn(`⚠️ Failed to delete chunk ${chunk.chunk_number}`);
        }
      }
    }

    // Delete from database
    await InterviewVideo.delete(videoId);

    res.status(200).json(
      new APIRES(200, {
        message: "Video deleted successfully",
        data: { videoId },
      }),
    );
  } catch (error) {
    console.error("❌ Error deleting video:", error);
    throw error;
  }
});

module.exports = {
  uploadVideoChunkController,
  uploadVideoFinalController,
  finalizeChunkedVideoController,
  getInterviewVideosController,
  getVideoStatsController,
  getDetailedStatsController,
  manualUploadVideosController,
  mergeCameraAnglesController,
  verifyVideoIntegrityController,
  deleteVideoController,
};
