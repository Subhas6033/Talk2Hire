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

class GlobalMediaMerger {
  constructor() {
    this.tempBaseDir = "/tmp/interview-media";
  }

  async mergeInterviewMedia(interviewId, options = {}) {
    const {
      layout = "picture-in-picture", // 'picture-in-picture', 'side-by-side', 'grid', 'screen-only', 'camera-only', 'triple-camera'
      screenPosition = "bottom-right", // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
      screenSize = 0.25, // 0.25 = 25% of main video size
      deleteChunksAfter = true,
      generatePreview = true,
      secondaryCameraPosition = "top-right", // ✅ NEW: Position for secondary camera in layouts
      secondaryCameraSize = 0.2, // ✅ NEW: Size for secondary camera overlay
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

      // ✅ NEW: Detect available cameras
      const availableCameras = {
        primary: !!videoResults.primary_camera,
        secondary: !!videoResults.secondary_camera,
        screen: !!videoResults.screen_recording,
      };

      console.log("\n📹 Available video sources:", availableCameras);

      // ✅ NEW: Auto-select best layout based on available sources
      const selectedLayout = this.selectOptimalLayout(layout, availableCameras);

      console.log(`\n🎨 STEP 3: Creating ${selectedLayout} layout...\n`);
      const layoutResult = await this.createVideoLayout(
        videoResults,
        audioResults,
        selectedLayout,
        {
          screenPosition,
          screenSize,
          secondaryCameraPosition,
          secondaryCameraSize,
          tempDir,
        },
      );

      console.log("\n📤 STEP 4: Uploading final video...\n");
      const finalVideo = await this.uploadFinalVideo(
        layoutResult.outputPath,
        interviewId,
        selectedLayout,
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
        layout: selectedLayout,
        finalVideoUrl: finalVideo.url,
        finalVideoPath: finalVideo.remotePath,
        fileSize: finalVideo.fileSize,
        duration: layoutResult.duration,
        checksum: finalVideo.checksum,
        previewUrl,
        videos: videoResults,
        audio: audioResults,
        availableCameras, // ✅ NEW: Include info about what was recorded
      };
    } catch (error) {
      console.error(`\n❌ MERGE FAILED FOR INTERVIEW ${interviewId}:`, error);

      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}

      throw error;
    }
  }

  // ✅ NEW: Select optimal layout based on available cameras
  selectOptimalLayout(requestedLayout, availableCameras) {
    const { primary, secondary, screen } = availableCameras;

    // If requested layout is possible, use it
    if (requestedLayout === "screen-only" && screen) return "screen-only";
    if (requestedLayout === "camera-only" && primary) return "camera-only";

    // For triple-camera layout, need all three
    if (requestedLayout === "triple-camera" && primary && secondary && screen) {
      return "triple-camera";
    }

    // For grid layout, prefer 3 or 4 sources
    if (requestedLayout === "grid") {
      const count = [primary, secondary, screen].filter(Boolean).length;
      if (count >= 2) return "grid";
    }

    // Auto-select based on available sources
    if (primary && secondary && screen) {
      console.log("  ℹ️  All cameras available, using triple-camera layout");
      return "triple-camera";
    }

    if (primary && screen) {
      console.log("  ℹ️  Primary + Screen available, using picture-in-picture");
      return "picture-in-picture";
    }

    if (primary && secondary) {
      console.log("  ℹ️  Both cameras available, using side-by-side");
      return "side-by-side";
    }

    if (screen) {
      console.log("  ℹ️  Only screen available, using screen-only");
      return "screen-only";
    }

    if (primary) {
      console.log("  ℹ️  Only primary camera available, using camera-only");
      return "camera-only";
    }

    throw new Error("No video sources available for merge");
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
    chunks.sort((a, b) => a.chunk_number - b.chunk_number);

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

    const concatPath = path.join(tempDir, `${videoType}_concat.txt`);
    const concatContent = chunkPaths.map((p) => `file '${p}'`).join("\n");
    await fs.writeFile(concatPath, concatContent);

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

  // ✅ UPDATED: Enhanced layout creation with secondary camera support
  async createVideoLayout(videoResults, audioResults, layout, options) {
    const {
      screenPosition,
      screenSize,
      secondaryCameraPosition,
      secondaryCameraSize,
      tempDir,
    } = options;

    const primaryCameraPath = videoResults.primary_camera?.localPath;
    const secondaryCameraPath = videoResults.secondary_camera?.localPath; // ✅ NEW
    const screenPath = videoResults.screen_recording?.localPath;
    const audioPath = audioResults.mixed_audio?.localPath;

    const outputPath = path.join(tempDir, "final_output.mp4");

    let ffmpegCommand = ffmpeg();

    // ✅ NEW: Triple camera layout (primary + secondary + screen)
    if (
      layout === "triple-camera" &&
      primaryCameraPath &&
      secondaryCameraPath &&
      screenPath
    ) {
      console.log(
        `  🎨 Creating triple-camera layout (screen:main, primary:bottom-right, secondary:top-right)`,
      );

      ffmpegCommand
        .input(screenPath) // [0] Main video (screen)
        .input(primaryCameraPath) // [1] Bottom-right overlay (primary camera)
        .input(secondaryCameraPath) // [2] Top-right overlay (secondary camera)
        .complexFilter([
          // Scale primary camera to 20% of screen size
          `[1:v]scale=iw*${screenSize}:ih*${screenSize}[primary_overlay]`,
          // Scale secondary camera to 20% of screen size
          `[2:v]scale=iw*${secondaryCameraSize}:ih*${secondaryCameraSize}[secondary_overlay]`,
          // Overlay primary camera on screen (bottom-right)
          `[0:v][primary_overlay]overlay=main_w-overlay_w-10:main_h-overlay_h-10[with_primary]`,
          // Overlay secondary camera on result (top-right)
          `[with_primary][secondary_overlay]overlay=main_w-overlay_w-10:10[outv]`,
        ])
        .map("[outv]");

      // ✅ NEW: Grid layout with secondary camera (2x2 or 3-way grid)
    } else if (layout === "grid") {
      const sources = [
        primaryCameraPath,
        secondaryCameraPath,
        screenPath,
      ].filter(Boolean);

      if (sources.length === 3) {
        console.log(`  🎨 Creating 3-way grid layout`);

        ffmpegCommand
          .input(screenPath) // [0] Top (full width)
          .input(primaryCameraPath) // [1] Bottom-left
          .input(secondaryCameraPath) // [2] Bottom-right
          .complexFilter([
            // Scale screen to fit top
            `[0:v]scale=1280:360[top]`,
            // Scale cameras to fit bottom
            `[1:v]scale=640:360[bottom_left]`,
            `[2:v]scale=640:360[bottom_right]`,
            // Stack bottom cameras horizontally
            `[bottom_left][bottom_right]hstack=inputs=2[bottom]`,
            // Stack top and bottom vertically
            `[top][bottom]vstack=inputs=2[outv]`,
          ])
          .map("[outv]");
      } else if (
        sources.length === 2 &&
        primaryCameraPath &&
        secondaryCameraPath
      ) {
        console.log(
          `  🎨 Creating 2x1 grid layout (both cameras side-by-side)`,
        );

        ffmpegCommand
          .input(primaryCameraPath)
          .input(secondaryCameraPath)
          .complexFilter([
            "[0:v]scale=iw/2:ih[left]",
            "[1:v]scale=iw/2:ih[right]",
            "[left][right]hstack=inputs=2[outv]",
          ])
          .map("[outv]");
      }

      // Side-by-side with secondary camera (if both cameras available)
    } else if (
      layout === "side-by-side" &&
      primaryCameraPath &&
      secondaryCameraPath
    ) {
      console.log(
        `  🎨 Creating side-by-side layout (primary + secondary cameras)`,
      );

      ffmpegCommand
        .input(primaryCameraPath)
        .input(secondaryCameraPath)
        .complexFilter([
          "[0:v]scale=iw/2:ih[left]",
          "[1:v]scale=iw/2:ih[right]",
          "[left][right]hstack=inputs=2[outv]",
        ])
        .map("[outv]");

      // Original side-by-side (screen + camera)
    } else if (layout === "side-by-side" && primaryCameraPath && screenPath) {
      console.log(
        `  🎨 Creating side-by-side layout (screen + primary camera)`,
      );

      ffmpegCommand
        .input(screenPath)
        .input(primaryCameraPath)
        .complexFilter([
          "[0:v]scale=iw/2:ih[left]",
          "[1:v]scale=iw/2:ih[right]",
          "[left][right]hstack=inputs=2[outv]",
        ])
        .map("[outv]");

      // ✅ UPDATED: Picture-in-picture with optional secondary camera
    } else if (
      layout === "picture-in-picture" &&
      primaryCameraPath &&
      screenPath
    ) {
      console.log(
        `  🎨 Creating PiP layout (screen:main, primary:${screenPosition})`,
      );

      const positions = {
        "top-left": "10:10",
        "top-right": "main_w-overlay_w-10:10",
        "bottom-left": "10:main_h-overlay_h-10",
        "bottom-right": "main_w-overlay_w-10:main_h-overlay_h-10",
      };

      const overlayPosition =
        positions[screenPosition] || positions["bottom-right"];

      if (secondaryCameraPath) {
        // If secondary camera available, add it as second overlay
        console.log(
          `  🎨 Adding secondary camera at ${secondaryCameraPosition}`,
        );

        const secondaryPositions = {
          "top-left": "10:10",
          "top-right": "main_w-overlay_w-10:10",
          "bottom-left": "10:main_h-overlay_h-10",
          "bottom-right": "main_w-overlay_w-10:main_h-overlay_h-10",
        };

        const secondaryOverlayPosition =
          secondaryPositions[secondaryCameraPosition] ||
          secondaryPositions["top-right"];

        ffmpegCommand
          .input(screenPath) // [0] Main video
          .input(primaryCameraPath) // [1] Primary overlay
          .input(secondaryCameraPath) // [2] Secondary overlay
          .complexFilter([
            `[1:v]scale=iw*${screenSize}:ih*${screenSize}[primary_overlay]`,
            `[2:v]scale=iw*${secondaryCameraSize}:ih*${secondaryCameraSize}[secondary_overlay]`,
            `[0:v][primary_overlay]overlay=${overlayPosition}[with_primary]`,
            `[with_primary][secondary_overlay]overlay=${secondaryOverlayPosition}[outv]`,
          ])
          .map("[outv]");
      } else {
        // Original single-camera PiP
        ffmpegCommand
          .input(screenPath)
          .input(primaryCameraPath)
          .complexFilter([
            `[1:v]scale=iw*${screenSize}:ih*${screenSize}[overlay]`,
            `[0:v][overlay]overlay=${overlayPosition}[outv]`,
          ])
          .map("[outv]");
      }
    } else if (layout === "screen-only" && screenPath) {
      console.log(`  🎨 Using screen recording only`);
      ffmpegCommand.input(screenPath);
    } else if (primaryCameraPath) {
      console.log(`  🎨 Using primary camera only (fallback)`);
      ffmpegCommand.input(primaryCameraPath);
    } else {
      throw new Error("No video sources available for layout");
    }

    // Add audio track
    if (audioPath) {
      console.log(`  🔊 Adding audio track`);
      const audioInputIndex = ffmpegCommand._inputs.length;
      ffmpegCommand.input(audioPath);
      ffmpegCommand.outputOptions([
        "-map 0:v", // Video from first input (or complex filter output)
        `-map ${audioInputIndex}:a`, // Audio from audio file
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
