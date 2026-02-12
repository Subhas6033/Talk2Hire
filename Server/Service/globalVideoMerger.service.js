const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const {
  downloadFileFromFTP,
  uploadFileToFTP,
  deleteFileFromFTP,
} = require("../Upload/uploadOnFTP");
const { InterviewVideo } = require("../Models/interviewVideo.models");
const { InterviewAudio } = require("../Models/InterviewAudio.models");
const {
  InterviewScreenRecording,
} = require("../Models/interviewScreen.models.js");

class GlobalMediaMerger {
  constructor() {
    this.tempBaseDir = "/tmp/interview-media";
  }

  async mergeInterviewMedia(interviewId, options = {}) {
    const {
      layout = "picture-in-picture", // 'picture-in-picture', 'side-by-side', 'screen-only', 'camera-only'
      screenPosition = "bottom-right", // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
      screenSize = 0.25, // 0.25 = 25% of main video size
      deleteChunksAfter = true,
      generatePreview = true,
    } = options;

    const tempDir = path.join(
      this.tempBaseDir,
      `merge_${interviewId}_${Date.now()}`,
    );

    try {
      console.log(`\n${"═".repeat(80)}`);
      console.log(
        `🎬 STARTING GLOBAL MEDIA MERGE FOR INTERVIEW ${interviewId}`,
      );
      console.log(`${"═".repeat(80)}\n`);

      await fs.mkdir(tempDir, { recursive: true });

      console.log("📹 STEP 1: Merging video chunks...\n");
      const videoResults = await this.mergeAllVideoChunks(interviewId, tempDir);

      console.log("\n🎙️ STEP 2: Merging audio chunks...\n");
      const audioResults = await this.mergeAllAudioChunks(interviewId, tempDir);

      console.log(`\n🎨 STEP 3: Creating ${layout} layout...\n`);
      const layoutResult = await this.createVideoLayout(
        videoResults,
        audioResults,
        layout,
        { screenPosition, screenSize, tempDir },
      );

      console.log("\n📤 STEP 4: Uploading final video...\n");
      const finalVideo = await this.uploadFinalVideo(
        layoutResult.outputPath,
        interviewId,
        layout,
      );

      let previewUrl = null;
      if (generatePreview) {
        console.log("\n🖼️ STEP 5: Generating preview thumbnail...\n");
        previewUrl = await this.generatePreviewThumbnail(
          layoutResult.outputPath,
          interviewId,
        );
      }

      console.log("\n🧹 STEP 6: Cleanup...\n");

      if (deleteChunksAfter) {
        await this.cleanupChunks(interviewId, videoResults, audioResults);
      }

      await fs.rm(tempDir, { recursive: true, force: true });

      console.log(`\n${"═".repeat(80)}`);
      console.log(`✅ MERGE COMPLETE FOR INTERVIEW ${interviewId}`);
      console.log(`${"═".repeat(80)}\n`);

      return {
        success: true,
        interviewId,
        layout,
        finalVideoUrl: finalVideo.url,
        finalVideoPath: finalVideo.remotePath,
        fileSize: finalVideo.fileSize,
        duration: layoutResult.duration,
        checksum: finalVideo.checksum,
        previewUrl,
        videos: videoResults,
        audio: audioResults,
      };
    } catch (error) {
      console.error(`\n❌ MERGE FAILED FOR INTERVIEW ${interviewId}:`, error);

      // Cleanup on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}

      throw error;
    }
  }

  async mergeAllVideoChunks(interviewId, tempDir) {
    const videos = await InterviewVideo.getByInterviewId(interviewId);
    const results = {};

    for (const video of videos) {
      console.log(`  📹 Processing ${video.video_type}...`);

      const chunks = await InterviewVideo.getChunks(video.id);
      if (!chunks || chunks.length === 0) {
        console.log(`  ⚠️  No chunks found for ${video.video_type}`);
        continue;
      }

      console.log(`  📦 Merging ${chunks.length} chunks...`);

      const mergedPath = await this.mergeVideoChunks(
        video.id,
        chunks,
        video.video_type,
        tempDir,
      );

      results[video.video_type] = {
        videoId: video.id,
        localPath: mergedPath,
        chunkCount: chunks.length,
      };

      console.log(`  ✅ ${video.video_type} merged successfully`);
    }

    return results;
  }

  async mergeVideoChunks(videoId, chunks, videoType, tempDir) {
    // Sort chunks by number
    chunks.sort((a, b) => a.chunk_number - b.chunk_number);

    // Download all chunks
    const chunkPaths = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const buffer = await downloadFileFromFTP(chunk.temp_ftp_path);
      const chunkPath = path.join(
        tempDir,
        `${videoType}_chunk_${String(i).padStart(4, "0")}.webm`,
      );
      await fs.writeFile(chunkPath, buffer);
      chunkPaths.push(chunkPath);
      console.log(`  ↓ Downloaded chunk ${i + 1}/${chunks.length}`);
    }

    // Create concat file
    const concatPath = path.join(tempDir, `${videoType}_concat.txt`);
    const concatContent = chunkPaths.map((p) => `file '${p}'`).join("\n");
    await fs.writeFile(concatPath, concatContent);

    // Merge using FFmpeg
    const outputPath = path.join(tempDir, `${videoType}_merged.webm`);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions(["-c copy"])
        .on("progress", (progress) => {
          if (progress.percent) {
            process.stdout.write(
              `  ⏳ Merging: ${progress.percent.toFixed(1)}%\r`,
            );
          }
        })
        .on("end", () => {
          console.log(`  ✅ Merge complete                    `);
          resolve();
        })
        .on("error", reject)
        .save(outputPath);
    });

    return outputPath;
  }

  async mergeAllAudioChunks(interviewId, tempDir) {
    const audioRecords = await InterviewAudio.getByInterviewId(interviewId);
    const results = {};

    for (const audio of audioRecords) {
      console.log(`  🎙️ Processing ${audio.audio_type}...`);

      const chunks = await InterviewAudio.getChunks(audio.id);
      if (!chunks || chunks.length === 0) {
        console.log(`  ⚠️  No chunks found for ${audio.audio_type}`);
        continue;
      }

      console.log(`  📦 Merging ${chunks.length} chunks...`);

      const mergedPath = await this.mergeAudioChunks(
        audio.id,
        chunks,
        audio.audio_type,
        tempDir,
      );

      results[audio.audio_type] = {
        audioId: audio.id,
        localPath: mergedPath,
        chunkCount: chunks.length,
      };

      console.log(`  ✅ ${audio.audio_type} merged successfully`);
    }

    return results;
  }

  async mergeAudioChunks(audioId, chunks, audioType, tempDir) {
    chunks.sort((a, b) => a.chunk_number - b.chunk_number);

    const chunkPaths = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const buffer = await downloadFileFromFTP(chunk.temp_ftp_path);
      const chunkPath = path.join(
        tempDir,
        `${audioType}_chunk_${String(i).padStart(4, "0")}.webm`,
      );
      await fs.writeFile(chunkPath, buffer);
      chunkPaths.push(chunkPath);
      console.log(`  ↓ Downloaded chunk ${i + 1}/${chunks.length}`);
    }

    const concatPath = path.join(tempDir, `${audioType}_concat.txt`);
    const concatContent = chunkPaths.map((p) => `file '${p}'`).join("\n");
    await fs.writeFile(concatPath, concatContent);

    const outputPath = path.join(tempDir, `${audioType}_merged.webm`);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions(["-c copy"])
        .on("progress", (progress) => {
          if (progress.percent) {
            process.stdout.write(
              `  ⏳ Merging: ${progress.percent.toFixed(1)}%\r`,
            );
          }
        })
        .on("end", () => {
          console.log(`  ✅ Merge complete                    `);
          resolve();
        })
        .on("error", reject)
        .save(outputPath);
    });

    return outputPath;
  }

  async createVideoLayout(videoResults, audioResults, layout, options) {
    const { screenPosition, screenSize, tempDir } = options;

    const cameraPath = videoResults.primary_camera?.localPath;
    const screenPath = videoResults.screen_recording?.localPath;
    const audioPath = audioResults.mixed_audio?.localPath;

    const outputPath = path.join(tempDir, "final_output.mp4");

    let ffmpegCommand = ffmpeg();

    if (layout === "picture-in-picture" && cameraPath && screenPath) {
      console.log(
        `  🎨 Creating PiP layout (screen:main, camera:${screenPosition})`,
      );

      const positions = {
        "top-left": "10:10",
        "top-right": "main_w-overlay_w-10:10",
        "bottom-left": "10:main_h-overlay_h-10",
        "bottom-right": "main_w-overlay_w-10:main_h-overlay_h-10",
      };

      const overlayPosition =
        positions[screenPosition] || positions["bottom-right"];

      ffmpegCommand
        .input(screenPath) // Main video (screen)
        .input(cameraPath) // Overlay video (camera)
        .complexFilter([
          // Scale camera to 25% of screen size
          `[1:v]scale=iw*${screenSize}:ih*${screenSize}[overlay]`,
          // Overlay camera on screen
          `[0:v][overlay]overlay=${overlayPosition}[outv]`,
        ])
        .map("[outv]");
    } else if (layout === "side-by-side" && cameraPath && screenPath) {
      console.log(`  🎨 Creating side-by-side layout`);

      ffmpegCommand
        .input(screenPath)
        .input(cameraPath)
        .complexFilter([
          "[0:v]scale=iw/2:ih[left]",
          "[1:v]scale=iw/2:ih[right]",
          "[left][right]hstack=inputs=2[outv]",
        ])
        .map("[outv]");
    } else if (layout === "screen-only" && screenPath) {
      console.log(`  🎨 Using screen recording only`);
      ffmpegCommand.input(screenPath);
    } else if (cameraPath) {
      console.log(`  🎨 Using camera only (fallback)`);
      ffmpegCommand.input(cameraPath);
    } else {
      throw new Error("No video sources available for layout");
    }

    if (audioPath) {
      console.log(`  🔊 Adding audio track`);
      ffmpegCommand.input(audioPath);
      ffmpegCommand.outputOptions([
        "-map 0:v",
        "-map 2:a",
        "-c:a aac",
        "-b:a 192k",
      ]);
    }

    ffmpegCommand.outputOptions([
      "-c:v libx264",
      "-preset medium",
      "-crf 23",
      "-movflags +faststart",
      "-shortest",
    ]);

    let duration = 0;

    await new Promise((resolve, reject) => {
      ffmpegCommand
        .on("start", (cmd) =>
          console.log(
            `  🎬 FFmpeg: ${cmd.split(" ").slice(0, 5).join(" ")}...`,
          ),
        )
        .on("progress", (progress) => {
          if (progress.percent) {
            process.stdout.write(
              `  ⏳ Rendering: ${progress.percent.toFixed(1)}%\r`,
            );
          }
          if (progress.timemark) {
            duration = this.parseTimemark(progress.timemark);
          }
        })
        .on("end", () => {
          console.log(`  ✅ Layout complete                    `);
          resolve();
        })
        .on("error", reject)
        .save(outputPath);
    });

    return { outputPath, duration };
  }

  async uploadFinalVideo(filePath, interviewId, layout) {
    const buffer = await fs.readFile(filePath);
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

    const filename = `interview_${interviewId}_${layout}_${Date.now()}.mp4`;
    const remoteDir = `/public/interview-videos/${interviewId}`;

    console.log(
      `  📤 Uploading ${(buffer.length / 1024 / 1024).toFixed(2)} MB...`,
    );

    const result = await uploadFileToFTP(buffer, filename, remoteDir);

    console.log(`  ✅ Uploaded to: ${result.url}`);

    return {
      ...result,
      fileSize: buffer.length,
      checksum,
    };
  }

  async generatePreviewThumbnail(videoPath, interviewId) {
    const thumbnailPath = videoPath.replace(".mp4", "_thumb.jpg");

    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ["50%"],
          filename: path.basename(thumbnailPath),
          folder: path.dirname(thumbnailPath),
          size: "1280x720",
        })
        .on("end", resolve)
        .on("error", reject);
    });

    const buffer = await fs.readFile(thumbnailPath);
    const filename = `preview_${interviewId}_${Date.now()}.jpg`;
    const remoteDir = `/public/interview-videos/${interviewId}`;

    const result = await uploadFileToFTP(buffer, filename, remoteDir);

    console.log(`  ✅ Preview uploaded: ${result.url}`);

    return result.url;
  }

  async cleanupChunks(interviewId, videoResults, audioResults) {
    let deletedCount = 0;

    // Delete video chunks
    for (const [type, data] of Object.entries(videoResults)) {
      const chunks = await InterviewVideo.getChunks(data.videoId);
      for (const chunk of chunks) {
        try {
          await deleteFileFromFTP(chunk.temp_ftp_path);
          deletedCount++;
        } catch (error) {
          console.warn(
            `  ⚠️  Failed to delete video chunk: ${chunk.temp_ftp_path}`,
          );
        }
      }
      await InterviewVideo.markChunksDeleted(data.videoId);
    }

    // Delete audio chunks
    for (const [type, data] of Object.entries(audioResults)) {
      const chunks = await InterviewAudio.getChunks(data.audioId);
      for (const chunk of chunks) {
        try {
          await deleteFileFromFTP(chunk.temp_ftp_path);
          deletedCount++;
        } catch (error) {
          console.warn(
            `  ⚠️  Failed to delete audio chunk: ${chunk.temp_ftp_path}`,
          );
        }
      }
      await InterviewAudio.markChunksDeleted(data.audioId);
    }

    console.log(`  ✅ Deleted ${deletedCount} chunks from FTP`);
  }
  parseTimemark(timemark) {
    const parts = timemark.split(":");
    return (
      parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])
    );
  }
}

const globalMerger = new GlobalMediaMerger();

module.exports = {
  mergeInterviewMedia: globalMerger.mergeInterviewMedia.bind(globalMerger),
  GlobalMediaMerger,
};
