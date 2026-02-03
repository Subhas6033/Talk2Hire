const { spawn } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const { InterviewVideo } = require("../Models/interviewVideo.models.js");

/**
 * Video Chunk Merger Service
 * Handles merging of video chunks into a single coherent video file
 */

class VideoChunkMerger {
  constructor() {
    this.tempDir = path.join(__dirname, "../temp/video-chunks");
    this.outputDir = path.join(__dirname, "../temp/video-output");
  }

  /**
   * Initialize temporary directories
   */
  async initDirectories() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.outputDir, { recursive: true });
      console.log("✅ Temporary directories initialized");
    } catch (error) {
      console.error("❌ Error creating directories:", error);
      throw error;
    }
  }

  /**
   * Calculate checksum for integrity verification
   */
  calculateChecksum(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Verify chunk integrity
   */
  async verifyChunkIntegrity(chunkPath, expectedChecksum = null) {
    try {
      const buffer = await fs.readFile(chunkPath);
      const checksum = this.calculateChecksum(buffer);

      if (expectedChecksum && checksum !== expectedChecksum) {
        throw new Error("Chunk integrity check failed - checksum mismatch");
      }

      return { valid: true, checksum, size: buffer.length };
    } catch (error) {
      console.error("❌ Chunk integrity verification failed:", error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Download chunks from FTP to local temp directory
   */
  async downloadChunksFromFTP(videoId, chunks) {
    const { downloadFileFromFTP } = require("../Upload/uploadOnFTP.js");
    const downloadedChunks = [];

    console.log(`📥 Downloading ${chunks.length} chunks for video ${videoId}`);

    for (const chunk of chunks) {
      try {
        const localPath = path.join(
          this.tempDir,
          `chunk_${videoId}_${chunk.chunk_number}.webm`
        );

        // Download from FTP
        const buffer = await downloadFileFromFTP(chunk.temp_ftp_path);

        // Verify integrity if checksum available
        if (chunk.checksum) {
          const actualChecksum = this.calculateChecksum(buffer);
          if (actualChecksum !== chunk.checksum) {
            throw new Error(
              `Chunk ${chunk.chunk_number} integrity check failed`
            );
          }
        }

        // Save to local temp
        await fs.writeFile(localPath, buffer);

        downloadedChunks.push({
          number: chunk.chunk_number,
          path: localPath,
          size: buffer.length,
        });

        console.log(
          `✅ Downloaded chunk ${chunk.chunk_number} (${buffer.length} bytes)`
        );
      } catch (error) {
        console.error(
          `❌ Failed to download chunk ${chunk.chunk_number}:`,
          error
        );
        throw error;
      }
    }

    return downloadedChunks.sort((a, b) => a.number - b.number);
  }

  /**
   * Merge video chunks using FFmpeg
   */
  async mergeChunksWithFFmpeg(chunks, outputPath) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`🔄 Merging ${chunks.length} chunks with FFmpeg...`);

        // Create concat file list
        const concatListPath = path.join(
          this.tempDir,
          `concat_${Date.now()}.txt`
        );
        const concatContent = chunks
          .map((chunk) => `file '${chunk.path}'`)
          .join("\n");

        await fs.writeFile(concatListPath, concatContent);
        console.log("✅ Concat list created:", concatListPath);

        // FFmpeg command for lossless merge
        const ffmpegArgs = [
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          concatListPath,
          "-c",
          "copy", // Copy codec without re-encoding for speed
          "-movflags",
          "+faststart", // Optimize for web playback
          "-y", // Overwrite output
          outputPath,
        ];

        console.log("🎬 FFmpeg command:", "ffmpeg", ffmpegArgs.join(" "));

        const ffmpeg = spawn("ffmpeg", ffmpegArgs);

        let stderr = "";

        ffmpeg.stderr.on("data", (data) => {
          stderr += data.toString();
          // Log progress
          if (data.toString().includes("time=")) {
            console.log("⏳ FFmpeg progress:", data.toString().trim());
          }
        });

        ffmpeg.on("close", async (code) => {
          try {
            // Clean up concat file
            await fs.unlink(concatListPath);
          } catch (err) {
            console.warn("⚠️ Failed to delete concat file:", err);
          }

          if (code !== 0) {
            console.error("❌ FFmpeg failed with code:", code);
            console.error("FFmpeg stderr:", stderr);
            reject(new Error(`FFmpeg failed with code ${code}`));
          } else {
            console.log("✅ FFmpeg merge completed successfully");
            resolve(outputPath);
          }
        });

        ffmpeg.on("error", (error) => {
          console.error("❌ FFmpeg spawn error:", error);
          reject(error);
        });
      } catch (error) {
        console.error("❌ Error in FFmpeg merge:", error);
        reject(error);
      }
    });
  }

  /**
   * Fallback: Simple binary concatenation (for same codec chunks)
   */
  async mergeBinaryConcat(chunks, outputPath) {
    console.log(`🔄 Using binary concatenation for ${chunks.length} chunks...`);

    const outputStream = require("fs").createWriteStream(outputPath);

    for (const chunk of chunks) {
      const chunkBuffer = await fs.readFile(chunk.path);
      outputStream.write(chunkBuffer);
      console.log(
        `✅ Appended chunk ${chunk.number} (${chunkBuffer.length} bytes)`
      );
    }

    outputStream.end();

    return new Promise((resolve, reject) => {
      outputStream.on("finish", () => {
        console.log("✅ Binary concatenation complete");
        resolve(outputPath);
      });
      outputStream.on("error", reject);
    });
  }

  /**
   * Parse frame rate from FFprobe format (e.g., "60/1" -> 60)
   */
  parseFrameRate(frameRateString) {
    if (!frameRateString || frameRateString === "0/0") return null;

    try {
      // Handle fraction format like "60/1"
      if (frameRateString.includes("/")) {
        const [numerator, denominator] = frameRateString.split("/").map(Number);
        if (denominator === 0) return null;
        return Math.round((numerator / denominator) * 100) / 100; // Round to 2 decimals
      }

      // Handle decimal format
      const parsed = parseFloat(frameRateString);
      return isNaN(parsed) ? null : Math.round(parsed * 100) / 100;
    } catch (error) {
      console.warn("⚠️ Could not parse frame rate:", frameRateString);
      return null;
    }
  }

  /**
   * Extract video metadata using FFprobe
   */
  async extractVideoMetadata(videoPath) {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn("ffprobe", [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        videoPath,
      ]);

      let stdout = "";
      let stderr = "";

      ffprobe.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffprobe.on("close", (code) => {
        if (code !== 0) {
          console.warn("⚠️ FFprobe warning:", stderr);
          // Return basic metadata even if ffprobe fails
          resolve({
            duration: null,
            codec: "unknown",
            resolution: null,
            bitrate: null,
            frameRate: null,
          });
        } else {
          try {
            const metadata = JSON.parse(stdout);
            const videoStream = metadata.streams?.find(
              (s) => s.codec_type === "video"
            );

            // Parse frame rate properly
            const rawFrameRate =
              videoStream?.r_frame_rate || videoStream?.avg_frame_rate;
            const parsedFrameRate = this.parseFrameRate(rawFrameRate);

            resolve({
              duration: parseFloat(metadata.format?.duration) || null,
              codec: videoStream?.codec_name || null,
              resolution: videoStream
                ? `${videoStream.width}x${videoStream.height}`
                : null,
              bitrate: parseInt(metadata.format?.bit_rate) || null,
              frameRate: parsedFrameRate,
            });
          } catch (error) {
            console.error("❌ Error parsing FFprobe output:", error);
            resolve({
              duration: null,
              codec: "unknown",
              resolution: null,
              bitrate: null,
              frameRate: null,
            });
          }
        }
      });
    });
  }

  /**
   * Upload file to FTP with progress tracking and timeout handling
   */
  async uploadToFTPWithProgress(buffer, filename, remoteDir, timeout = 300000) {
    const { uploadFileToFTP } = require("../Upload/uploadOnFTP.js");

    console.log(`📤 Uploading ${filename} (${buffer.length} bytes) to FTP...`);
    console.log(`⏱️  Upload timeout set to ${timeout / 1000} seconds`);

    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`FTP upload timeout after ${timeout / 1000} seconds`));
      }, timeout);
    });

    // Create upload progress tracker
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`⏳ Upload in progress... ${elapsed}s elapsed`);
    }, 5000); // Log every 5 seconds

    try {
      // Race between upload and timeout
      const result = await Promise.race([
        uploadFileToFTP(buffer, filename, remoteDir),
        timeoutPromise,
      ]);

      clearInterval(progressInterval);

      const totalTime = Math.round((Date.now() - startTime) / 1000);
      const speedMBps = (buffer.length / 1024 / 1024 / totalTime).toFixed(2);

      console.log(`✅ Upload complete in ${totalTime}s (${speedMBps} MB/s)`);

      return result;
    } catch (error) {
      clearInterval(progressInterval);
      console.error("❌ FTP upload failed:", error.message);
      throw error;
    }
  }

  /**
   * Main merge operation
   */
  async mergeVideoChunks(videoId, interviewId) {
    try {
      console.log(`🎬 Starting merge for video ${videoId}`);

      // Initialize directories
      await this.initDirectories();

      // Get video record and chunks
      const video = await InterviewVideo.getById(videoId);
      if (!video) {
        throw new Error("Video record not found");
      }

      const chunks = await InterviewVideo.getChunks(videoId);
      if (!chunks || chunks.length === 0) {
        throw new Error("No chunks found for video");
      }

      console.log(`📦 Found ${chunks.length} chunks to merge`);

      // Update status
      await InterviewVideo.updateUploadStatus(videoId, "merging");

      // Download chunks from FTP
      const downloadedChunks = await this.downloadChunksFromFTP(
        videoId,
        chunks
      );

      // Prepare output path
      const outputFilename = `merged_${videoId}_${Date.now()}.mp4`;
      const outputPath = path.join(this.outputDir, outputFilename);

      // Try FFmpeg merge first, fallback to binary concat
      let mergedPath;
      try {
        mergedPath = await this.mergeChunksWithFFmpeg(
          downloadedChunks,
          outputPath
        );
      } catch (ffmpegError) {
        console.warn(
          "⚠️ FFmpeg merge failed, using binary concatenation:",
          ffmpegError
        );
        mergedPath = await this.mergeBinaryConcat(downloadedChunks, outputPath);
      }

      // Extract metadata
      const metadata = await this.extractVideoMetadata(mergedPath);
      console.log("📊 Extracted metadata:", metadata);

      // Read merged file
      const mergedBuffer = await fs.readFile(mergedPath);
      console.log(`✅ Merged video size: ${mergedBuffer.length} bytes`);

      // Calculate checksum
      const checksum = this.calculateChecksum(mergedBuffer);

      // Upload to FTP with progress tracking and timeout (5 minutes)
      const ftpRemoteDir = `/public/interview-videos/${interviewId}`;
      const sanitizedFilename = `${video.video_type}_${Date.now()}_merged.webm`;

      const ftpResult = await this.uploadToFTPWithProgress(
        mergedBuffer,
        sanitizedFilename,
        ftpRemoteDir,
        300000 // 5 minute timeout
      );

      console.log("✅ Merged video uploaded to FTP:", ftpResult.url);

      // Update video record
      await InterviewVideo.updateAfterUpload({
        videoId,
        ftpPath: ftpResult.remotePath,
        ftpUrl: ftpResult.url,
        fileSize: mergedBuffer.length,
        duration: metadata.duration,
      });

      // Save checksum
      await InterviewVideo.updateChecksum(videoId, checksum);

      // Clean up local files
      await this.cleanupTempFiles([
        mergedPath,
        ...downloadedChunks.map((c) => c.path),
      ]);

      console.log("✅ Video merge complete!");

      return {
        success: true,
        videoId,
        ftpUrl: ftpResult.url,
        fileSize: mergedBuffer.length,
        duration: metadata.duration,
        checksum,
      };
    } catch (error) {
      console.error("❌ Video merge failed:", error);
      await InterviewVideo.markAsFailed(videoId, error.message);
      throw error;
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(filePaths) {
    console.log(`🧹 Cleaning up ${filePaths.length} temporary files...`);

    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
        console.log(`✅ Deleted: ${path.basename(filePath)}`);
      } catch (error) {
        console.warn(`⚠️ Failed to delete ${filePath}:`, error.message);
      }
    }
  }

  /**
   * Merge multiple camera angles into a single video
   */
  async mergeMultipleCameras(
    videoIds,
    interviewId,
    outputType = "side-by-side"
  ) {
    try {
      console.log(`🎥 Merging ${videoIds.length} camera angles...`);

      await this.initDirectories();

      const videoPaths = [];
      const videoMetadata = [];

      // Download and prepare each camera video
      for (const videoId of videoIds) {
        const video = await InterviewVideo.getById(videoId);
        if (!video || !video.ftp_path) {
          throw new Error(`Video ${videoId} not found or not uploaded`);
        }

        const { downloadFileFromFTP } = require("../Upload/uploadOnFTP.js");
        const buffer = await downloadFileFromFTP(video.ftp_path);

        const tempPath = path.join(
          this.tempDir,
          `camera_${videoId}_${Date.now()}.webm`
        );
        await fs.writeFile(tempPath, buffer);

        videoPaths.push(tempPath);
        videoMetadata.push(video);

        console.log(`✅ Downloaded camera video: ${video.video_type}`);
      }

      // Prepare output
      const outputFilename = `multi_camera_${Date.now()}.mp4`;
      const outputPath = path.join(this.outputDir, outputFilename);

      // Build FFmpeg filter based on output type
      let filterComplex;
      if (outputType === "side-by-side" && videoPaths.length === 2) {
        filterComplex = "[0:v][1:v]hstack=inputs=2[v]";
      } else if (outputType === "grid" && videoPaths.length === 4) {
        filterComplex =
          "[0:v][1:v]hstack[top];[2:v][3:v]hstack[bottom];[top][bottom]vstack[v]";
      } else {
        // Picture-in-picture (main + small overlay)
        filterComplex = "[0:v][1:v]overlay=W-w-10:H-h-10[v]";
      }

      // FFmpeg command for multi-camera merge
      const ffmpegArgs = [
        ...videoPaths.flatMap((p) => ["-i", p]),
        "-filter_complex",
        filterComplex,
        "-map",
        "[v]",
        "-map",
        "0:a", // Use audio from first video
        "-c:v",
        "libvpx-vp9",
        "-c:a",
        "libopus",
        "-b:v",
        "2M",
        "-y",
        outputPath,
      ];

      console.log(
        "🎬 Multi-camera FFmpeg command:",
        "ffmpeg",
        ffmpegArgs.join(" ")
      );

      await new Promise((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", ffmpegArgs);

        ffmpeg.stderr.on("data", (data) => {
          console.log("⏳ FFmpeg:", data.toString().trim());
        });

        ffmpeg.on("close", (code) => {
          if (code !== 0) {
            reject(new Error(`FFmpeg multi-camera merge failed: ${code}`));
          } else {
            resolve();
          }
        });

        ffmpeg.on("error", reject);
      });

      // Extract metadata
      const metadata = await this.extractVideoMetadata(outputPath);

      // Upload merged video with progress
      const mergedBuffer = await fs.readFile(outputPath);
      const checksum = this.calculateChecksum(mergedBuffer);

      const ftpRemoteDir = `/public/interview-videos/${interviewId}`;
      const sanitizedFilename = `multi_camera_${outputType}_${Date.now()}.webm`;

      const ftpResult = await this.uploadToFTPWithProgress(
        mergedBuffer,
        sanitizedFilename,
        ftpRemoteDir,
        300000
      );

      // Clean up
      await this.cleanupTempFiles([outputPath, ...videoPaths]);

      console.log("✅ Multi-camera merge complete!");

      return {
        success: true,
        ftpUrl: ftpResult.url,
        ftpPath: ftpResult.remotePath,
        fileSize: mergedBuffer.length,
        duration: metadata.duration,
        checksum,
      };
    } catch (error) {
      console.error("❌ Multi-camera merge failed:", error);
      throw error;
    }
  }
}

module.exports = new VideoChunkMerger();
