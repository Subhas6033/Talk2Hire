async function mergeScreenRecordingChunks(screenRecordingId, interviewId) {
  const fs = require("fs").promises;
  const path = require("path");
  const crypto = require("crypto");
  const {
    InterviewScreenRecording,
  } = require("../Models/InterviewScreenRecording.models.js");
  const {
    uploadFileToFTP,
    downloadFileFromFTP,
  } = require("../Upload/uploadOnFTP.js");

  try {
    console.log(
      `🎬 Starting screen recording chunk merge for ID: ${screenRecordingId}`,
    );

    // Get screen recording info
    const screenRecording =
      await InterviewScreenRecording.getById(screenRecordingId);
    if (!screenRecording) {
      throw new Error("Screen recording not found");
    }

    // Get all chunks ordered by chunk number
    const chunks = await InterviewScreenRecording.getChunks(screenRecordingId);

    if (!chunks || chunks.length === 0) {
      throw new Error("No screen recording chunks found");
    }

    console.log(`📦 Found ${chunks.length} screen recording chunks to merge`);

    // Sort chunks by chunk number to ensure correct order
    chunks.sort((a, b) => a.chunk_number - b.chunk_number);

    // Create temporary directory for screen chunks
    const tempDir = path.join(
      "/tmp",
      `screen_merge_${screenRecordingId}_${Date.now()}`,
    );
    await fs.mkdir(tempDir, { recursive: true });
    console.log(`📁 Created temp directory: ${tempDir}`);

    try {
      // Download all screen chunks from FTP
      const chunkFiles = [];
      for (const chunk of chunks) {
        const chunkBuffer = await downloadFileFromFTP(chunk.temp_ftp_path);
        const chunkPath = path.join(
          tempDir,
          `chunk_${String(chunk.chunk_number).padStart(4, "0")}.webm`,
        );

        await fs.writeFile(chunkPath, chunkBuffer);
        chunkFiles.push(chunkPath);

        console.log(
          `✅ Downloaded screen chunk ${chunk.chunk_number}/${chunks.length}`,
        );
      }

      // Create file list for FFmpeg
      const listPath = path.join(tempDir, "filelist.txt");
      const fileListContent = chunkFiles.map((f) => `file '${f}'`).join("\n");
      await fs.writeFile(listPath, fileListContent);

      // Output path for merged screen recording
      const outputPath = path.join(
        tempDir,
        `merged_screen_${screenRecordingId}.webm`,
      );

      console.log(
        `🔄 Merging ${chunkFiles.length} screen recording chunks with FFmpeg...`,
      );

      // Use FFmpeg to concatenate screen chunks
      const ffmpeg = require("fluent-ffmpeg");

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(listPath)
          .inputOptions(["-f concat", "-safe 0"])
          .outputOptions([
            "-c copy", // Copy without re-encoding for speed
            "-movflags +faststart", // Optimize for web playback
          ])
          .output(outputPath)
          .on("start", (cmd) => {
            console.log("🎬 FFmpeg command:", cmd);
          })
          .on("progress", (progress) => {
            if (progress.percent) {
              console.log(
                `⏳ Screen merge progress: ${progress.percent.toFixed(2)}%`,
              );
            }
          })
          .on("end", () => {
            console.log("✅ Screen recording chunks merged successfully");
            resolve();
          })
          .on("error", (err) => {
            console.error("❌ FFmpeg merge error:", err);
            reject(err);
          })
          .run();
      });

      // Read merged file
      const mergedBuffer = await fs.readFile(outputPath);
      console.log(
        `📊 Merged screen recording size: ${mergedBuffer.length} bytes`,
      );

      // Calculate checksum
      const checksum = crypto
        .createHash("sha256")
        .update(mergedBuffer)
        .digest("hex");
      console.log(`🔐 Screen recording checksum: ${checksum}`);

      // Get video metadata
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(outputPath, (err, metadata) => {
          if (err) reject(err);
          else resolve(metadata);
        });
      });

      const duration = metadata.format?.duration || null;
      const fileSize = mergedBuffer.length;

      console.log(`📹 Screen recording metadata:`, {
        duration: duration ? `${duration.toFixed(2)}s` : "unknown",
        fileSize: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
      });

      // Upload merged screen recording to FTP
      const ftpRemoteDir = `/public/interview-videos/${interviewId}`;
      const mergedFilename = `screen_recording_${screenRecordingId}_${Date.now()}.webm`;

      console.log(`📤 Uploading merged screen recording to FTP...`);
      const ftpResult = await uploadFileToFTP(
        mergedBuffer,
        mergedFilename,
        ftpRemoteDir,
      );

      console.log(`✅ Merged screen recording uploaded:`, ftpResult.url);

      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned up temp directory`);

      return {
        success: true,
        ftpUrl: ftpResult.url,
        ftpPath: ftpResult.remotePath,
        fileSize,
        duration,
        checksum,
      };
    } catch (error) {
      // Clean up temp directory on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("❌ Error cleaning up temp directory:", cleanupError);
      }
      throw error;
    }
  } catch (error) {
    console.error("❌ Screen recording merge failed:", error);
    throw error;
  }
}
