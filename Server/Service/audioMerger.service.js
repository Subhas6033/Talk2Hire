const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const {
  downloadFileFromFTP,
  uploadFileToFTP,
} = require("../Upload/uploadOnFTP");
const { InterviewAudio } = require("../Models/InterviewAudio.models");

/**
 * Merge audio chunks into a single file
 */
async function mergeAudioChunks(audioId) {
  try {
    console.log(`🎙️ Starting audio chunk merge for audio ${audioId}...`);

    // Get audio record
    const audioRecord = await InterviewAudio.getById(audioId);

    if (!audioRecord) {
      throw new Error(`Audio record ${audioId} not found`);
    }

    const interviewId = audioRecord.interview_id;

    // Get all audio chunks for this audio ID
    const chunks = await InterviewAudio.getChunks(audioId);

    if (!chunks || chunks.length === 0) {
      throw new Error("No audio chunks found");
    }

    console.log(`📦 Found ${chunks.length} audio chunks to merge`);

    // Sort chunks by number
    chunks.sort((a, b) => a.chunk_number - b.chunk_number);

    // Download all chunks
    const chunkBuffers = [];
    for (const chunk of chunks) {
      console.log(
        `📥 Downloading chunk ${chunk.chunk_number} from ${chunk.temp_ftp_path}`,
      );
      const buffer = await downloadFileFromFTP(chunk.temp_ftp_path);
      chunkBuffers.push(buffer);
      console.log(
        `📥 Downloaded chunk ${chunk.chunk_number} (${buffer.length} bytes)`,
      );
    }

    // Create temp directory
    const tempDir = `/tmp/audio_merge_${audioId}_${Date.now()}`;
    fs.mkdirSync(tempDir, { recursive: true });

    // Write chunks to temp files
    const chunkPaths = [];
    for (let i = 0; i < chunkBuffers.length; i++) {
      const chunkPath = path.join(
        tempDir,
        `chunk_${String(i).padStart(4, "0")}.webm`,
      );
      fs.writeFileSync(chunkPath, chunkBuffers[i]);
      chunkPaths.push(chunkPath);
    }

    // Create concat file for ffmpeg
    const concatFilePath = path.join(tempDir, "concat_list.txt");
    const concatContent = chunkPaths.map((p) => `file '${p}'`).join("\n");
    fs.writeFileSync(concatFilePath, concatContent);

    // Merge using ffmpeg
    const outputPath = path.join(tempDir, "merged_audio.webm");

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatFilePath)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .outputOptions([
          "-c:a copy", // Copy audio codec (no re-encoding for speed)
        ])
        .on("start", (cmd) => {
          console.log("🎬 FFmpeg command:", cmd);
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            console.log(`⏳ Merging progress: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on("end", () => {
          console.log("✅ Audio chunks merged successfully");
          resolve();
        })
        .on("error", (error) => {
          console.error("❌ FFmpeg merge error:", error);
          reject(error);
        })
        .save(outputPath);
    });

    // Read merged file
    const mergedBuffer = fs.readFileSync(outputPath);
    console.log(`📊 Merged audio size: ${mergedBuffer.length} bytes`);

    // Get duration using ffprobe
    const duration = await getAudioDuration(outputPath);

    // Upload to FTP
    const ftpRemoteDir = `/public/interview-audio/${interviewId}`;
    const filename = `audio_${audioRecord.audio_type}_${Date.now()}.webm`;

    const ftpResult = await uploadFileToFTP(
      mergedBuffer,
      filename,
      ftpRemoteDir,
    );

    console.log("✅ Merged audio uploaded to FTP:", ftpResult.url);

    // Cleanup temp files
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log("🧹 Temp files cleaned up");

    return {
      success: true,
      ftpUrl: ftpResult.url,
      ftpPath: ftpResult.remotePath,
      fileSize: mergedBuffer.length,
      duration: duration,
      totalChunks: chunks.length,
    };
  } catch (error) {
    console.error("❌ Audio merge failed:", error);
    throw error;
  }
}

/**
 * Merge video with audio track
 */
async function mergeVideoWithAudio(videoFtpPath, audioFtpPath, interviewId) {
  try {
    console.log(`🎬 Merging video and audio for interview ${interviewId}...`);

    // Create temp directory
    const tempDir = `/tmp/video_audio_merge_${interviewId}_${Date.now()}`;
    fs.mkdirSync(tempDir, { recursive: true });

    // Download files
    console.log("📥 Downloading video from:", videoFtpPath);
    const videoBuffer = await downloadFileFromFTP(videoFtpPath);
    const tempVideoPath = path.join(tempDir, "video.webm");
    fs.writeFileSync(tempVideoPath, videoBuffer);

    console.log("📥 Downloading audio from:", audioFtpPath);
    const audioBuffer = await downloadFileFromFTP(audioFtpPath);
    const tempAudioPath = path.join(tempDir, "audio.webm");
    fs.writeFileSync(tempAudioPath, audioBuffer);

    const outputPath = path.join(tempDir, "output.webm");

    // Merge using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(tempVideoPath)
        .input(tempAudioPath)
        .outputOptions([
          "-c:v copy", // Copy video codec (no re-encoding)
          "-c:a opus", // Use Opus audio codec
          "-b:a 128k", // 128 kbps audio bitrate
          "-map 0:v:0", // Map video from first input
          "-map 1:a:0", // Map audio from second input
          "-shortest", // Match shortest stream duration
        ])
        .on("start", (cmd) => {
          console.log("🎬 FFmpeg command:", cmd);
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            console.log(`⏳ Merging progress: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on("end", () => {
          console.log("✅ Video and audio merged successfully");
          resolve();
        })
        .on("error", (error) => {
          console.error("❌ FFmpeg merge error:", error);
          reject(error);
        })
        .save(outputPath);
    });

    // Read merged file
    const mergedBuffer = fs.readFileSync(outputPath);
    console.log(`📊 Final video size: ${mergedBuffer.length} bytes`);

    // Upload to FTP
    const ftpRemoteDir = `/public/interview-videos/${interviewId}`;
    const filename = `final_video_with_audio_${Date.now()}.webm`;

    const ftpResult = await uploadFileToFTP(
      mergedBuffer,
      filename,
      ftpRemoteDir,
    );

    console.log("✅ Final video uploaded to FTP:", ftpResult.url);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log("🧹 Temp files cleaned up");

    return {
      success: true,
      ftpUrl: ftpResult.url,
      ftpPath: ftpResult.remotePath,
      fileSize: mergedBuffer.length,
    };
  } catch (error) {
    console.error("❌ Video/audio merge failed:", error);
    throw error;
  }
}

/**
 * Get audio duration using ffprobe
 */
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const duration = metadata.format.duration;
      resolve(Math.round(duration)); // Return duration in seconds
    });
  });
}

/**
 * Re-encode audio for better compatibility
 * Use this if clients have codec issues
 */
async function reencodeAudio(inputPath, outputPath, options = {}) {
  const { codec = "opus", bitrate = "128k", sampleRate = 48000 } = options;

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .audioCodec(codec)
      .audioBitrate(bitrate)
      .audioFrequency(sampleRate)
      .on("start", (cmd) => {
        console.log("🎵 Re-encoding audio:", cmd);
      })
      .on("progress", (progress) => {
        if (progress.percent) {
          console.log(`⏳ Encoding: ${progress.percent.toFixed(1)}%`);
        }
      })
      .on("end", () => {
        console.log("✅ Audio re-encoded successfully");
        resolve();
      })
      .on("error", reject)
      .save(outputPath);
  });
}

module.exports = {
  mergeAudioChunks,
  mergeVideoWithAudio,
  getAudioDuration,
  reencodeAudio,
};
