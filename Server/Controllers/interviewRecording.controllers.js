const { pool } = require("../Config/database.config.js");
const {
  uploadFileToFTP,
  downloadFileFromFTP,
} = require("../Upload/uploadOnFTP.js");
const { asyncHandler, APIERR, APIRES } = require("../Utils/index.utils.js");
const redis = require("../Config/redis.config.js");
const { evaluateInterview } = require("../Service/evaluation.service.js");

// ── FFmpeg binary wiring ───────────────────────────────────────────────────
// ffmpeg-static and ffprobe-static ship self-contained binaries inside the
// node_modules folder.  fluent-ffmpeg will use whatever is on $PATH by
// default — on many servers that is nothing, or a system ffmpeg compiled
// without the codecs we need.  Explicitly pointing to the static binaries
// guarantees the same behaviour on every machine regardless of what is
// (or isn't) installed system-wide.
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");
const fluentFfmpeg = require("fluent-ffmpeg");
fluentFfmpeg.setFfmpegPath(ffmpegStatic);
fluentFfmpeg.setFfprobePath(ffprobeStatic.path);
console.log("[FFMPEG] Binary paths set:");
console.log("  ffmpeg  →", ffmpegStatic);
console.log("  ffprobe →", ffprobeStatic.path);

// ── Timing constants ──────────────────────────────────────────────────────────
const RECORDING_TTL = 60 * 60 * 6;
const MERGE_DELAY_MS = 5 * 60 * 1000;
const CHUNK_SETTLE_TIMEOUT_MS = 3 * 60 * 1000;
const CHUNK_SETTLE_POLL_MS = 5 * 1000;

const VIDEO_TYPES = ["primary_camera", "secondary_camera", "screen_recording"];

const INTERVIEW_COLUMN_MAP = {
  primary_camera: "pri_recording_url",
  secondary_camera: "mob_recording_url",
  screen_recording: "scr_recording_url",
};

/* ─────────────────────────────────────────────────────────────────────────────
   ── Compression Profiles (H.264 via ffmpeg-static) ───────────────────────────
   ─────────────────────────────────────────────────────────────────────────────

   Why we stopped forcing 1920×1080 on camera streams:
   ─────────────────────────────────────────────────────
   The browser's MediaRecorder captures webcam video at whatever resolution the
   camera device negotiates — typically 640×480 (4:3) or 1280×720 (16:9).
   Forcing libx264 to upscale a 640×480 stream to 1920×1080 produces two
   problems that were confirmed in production:

     1. The SAR (Sample Aspect Ratio) tag is carried from the source WebM.
        A 4:3 webcam produces SAR 3:4, so a file that claims 1920×1080 pixels
        is actually rendered by the player as a 4:3 1440×1080 image — squished
        or pillarboxed depending on the player.

     2. Re-encoding a low-bitrate source at a much larger frame size bloats the
        file without recovering any real detail (confirmed: 91.4% of raw size
        vs 31.7% for screen_recording which is a genuine 1080p source).

   Fix — scale strategy per stream type:
   ──────────────────────────────────────
     primary_camera   scale=-2:720,setsar=1:1
       • Locks height to 720p, auto-calculates width (-2 = round to even).
       • A 4:3 webcam → 960×720. A 16:9 webcam → 1280×720.
       • setsar=1:1 overwrites the broken SAR tag with square pixels so every
         player renders the correct shape with no pillarboxing.

     secondary_camera  scale=-2:1080,setsar=1:1
       • Mobile cameras (rear or front) capture at higher resolutions and are
         held in portrait or landscape. Scale to 1080p height so portrait frames
         (e.g. 608×1080) display correctly in the viewer without squishing.
       • setsar=1:1 same fix as above.

     screen_recording  scale=1920:1080  (unchanged)
       • Desktop screen shares are always 16:9 and captured at 1920×1080 or
         lower widescreen ratios. No SAR issue, 1080p is the correct target.

   setsar is applied inside the same -vf filter chain, not as a separate
   option, to avoid the "two -vf" ffmpeg error.

   AI-grade visual enhancement pipeline (camera streams only):
   ────────────────────────────────────────────────────────────
   Confirmed from production frame analysis (interview 1072):
     • Original brightness: 117/255 — face severely underexposed
     • Original pixel range: 31–165 — crushed blacks, clipped highlights
     • Original contrast std: 36 — flat, washed-out image
     • Root cause: webcam auto-exposure fooled by bright background wall

   Enhancement filter chain applied before scale/setsar/fps:
     1. hqdn3d=1.5:1:2.5:2.5
        Temporal + spatial denoiser. Removes compression noise from the
        already-lossy WebM source before re-encoding — prevents noise from
        being re-amplified by the second encode pass.

     2. colorlevels=rimin=0.12:gimin=0.12:bimin=0.12:rimax=0.65:gimax=0.65:bimax=0.65
        Sets the true black point (0.12 = 31/255, actual min pixel) and white
        point (0.65 = 165/255, actual max pixel) from the source, then stretches
        the tonal range to fill 0–255. Removes the grey haze and fixes the
        underexposed face caused by background-metered auto-exposure.

     3. eq=gamma=1.35:contrast=1.1:saturation=1.5
        Gamma lift: raises midtones (faces) without blowing highlights.
        Contrast: firms up the image after the levels stretch.
        Saturation: restores colour that was lost to the flat source.

     4. curves=master='0/0 0.25/0.30 0.55/0.60 0.85/0.90 1/1'
        S-curve: lifts shadows strongly (0.25→0.30), boosts midtones
        (0.55→0.60), gently caps highlights (0.85→0.90). Produces the
        "face pops against background" look without over-brightening.

     5. unsharp=lx=5:ly=5:la=0.5:cx=3:cy=3:ca=0.0
        Sharpens luma (faces, edges) after the denoiser softened them.
        Skips chroma sharpening (ca=0) to avoid colour fringing.

   Measured result after enhancement:
     • Brightness: 117 → 194  (+76, face clearly visible)
     • Contrast std: 36 → 67  (+31, nearly double)
     • Pixel range: 31–165 → 0–255  (full tonal range used)
     • Dark pixels: 8% → 0%   (no more crushed shadows)

   screen_recording does NOT apply enhancement — it is already a genuine
   1080p source with correct exposure from the OS display compositor.

   CRF / profile / level tuning:
   ──────────────────────────────
     primary_camera   CRF 18  — lower CRF after enhancement to preserve the
                                extra detail the filters recovered. Worth the
                                slightly larger file vs CRF 23.
     secondary_camera CRF 18  — same rationale.
     screen_recording CRF 28  — unchanged; VFR + static content compresses well.

   Size budget — 1-hour interview, all 3 streams combined:
     primary_camera   720p   15fps  CRF 18  64k mono   ≈ 130 MB/hr
     secondary_camera 1080p  24fps  CRF 18  64k mono   ≈ 220 MB/hr
     screen_recording 1080p  VFR    CRF 28  96k stereo ≈ 110 MB/hr
                                                        ───────────
                                                        ≈ 460 MB/hr  ✓

   Container: MP4 with -movflags +faststart so FTP streaming starts immediately.
   ─────────────────────────────────────────────────────────────────────────── */

const COMPRESSION_PROFILES = {
  primary_camera: {
    // Talking-head webcam — preserve native AR, normalise to 720p height,
    // fix SAR tag, apply visual enhancement to fix underexposed webcam footage.
    scale: "-2:720", // height=720, width=auto (even); 4:3 cam → 960×720
    setsar: true, // append ,setsar=1:1 to fix the SAR tag from the WebM
    enhance: true, // apply visual enhancement pipeline (see comment above)
    fps: "15", // 15fps is plenty for a talking head
    crf: 18, // CRF 18 — preserve detail recovered by enhancement
    preset: "faster", // faster > medium on a shared server; ~5% larger files
    audioChannels: 1, // mono — single-mic feed has no stereo field
    audioCodec: "aac",
    audioBitrate: "64k",
    extraOptions: [
      "-profile:v main",
      "-level 3.1", // level 3.1 supports 720p @ 30fps
      "-pix_fmt yuv420p",
    ],
    outputExt: "mp4",
    displayLabel: "720p H.264 CRF 18 · 15fps · enhanced · mono",
  },

  secondary_camera: {
    // Mobile camera — portrait or landscape, higher native resolution.
    // Scale to 1080p height so portrait clips (e.g. 608×1080) display correctly.
    // setsar=1:1 fixes the SAR tag regardless of phone orientation.
    // Enhancement pipeline same as primary_camera — mobile auto-exposure has
    // the same background-metering problem.
    scale: "-2:1080", // height=1080, width=auto (even); portrait → e.g. 608×1080
    setsar: true, // force square pixels — critical for portrait mobile video
    enhance: true, // apply visual enhancement pipeline
    fps: "24",
    crf: 18, // CRF 18 — preserve detail recovered by enhancement
    preset: "faster",
    audioChannels: 1,
    audioCodec: "aac",
    audioBitrate: "64k",
    extraOptions: [
      "-profile:v main",
      "-level 4.0", // level 4.0 supports 1080p @ 30fps
      "-pix_fmt yuv420p",
    ],
    outputExt: "mp4",
    displayLabel: "1080p H.264 CRF 18 · 24fps · enhanced · mono",
  },

  screen_recording: {
    // Desktop screen share — always 16:9, genuine 1080p source, no SAR issue.
    // No enhancement — screen content is already correctly exposed by the OS.
    scale: "1920:1080",
    setsar: false,
    enhance: false,
    fps: null, // VFR passthrough — static screens cost near-zero bits
    crf: 28,
    preset: "faster",
    audioChannels: 2, // stereo — system audio may have effects/music
    audioCodec: "aac",
    audioBitrate: "96k",
    extraOptions: [
      "-vsync vfr",
      "-profile:v high",
      "-level 4.0",
      "-pix_fmt yuv420p",
    ],
    outputExt: "mp4",
    displayLabel: "1080p H.264 CRF 28 · VFR · stereo",
  },
};

/* ── FFmpeg compression ───────────────────────────────────────────────────── */

async function compressVideo(inputPath, outputPath, videoType) {
  const fsSync = require("fs");
  const profile =
    COMPRESSION_PROFILES[videoType] ?? COMPRESSION_PROFILES.primary_camera;

  // ── Writable check ────────────────────────────────────────────────────────
  try {
    const t = outputPath + ".tmptest";
    fsSync.writeFileSync(t, "x");
    fsSync.unlinkSync(t);
  } catch (e) {
    throw new Error(
      "[COMPRESS] Output path not writable for " + videoType + ": " + e.message,
    );
  }

  const inputStat = fsSync.statSync(inputPath);
  const inMB = (inputStat.size / 1024 / 1024).toFixed(2);
  console.log(
    "[COMPRESS] Starting " +
      videoType +
      " — encoder=libx264 preset=" +
      profile.preset +
      " crf=" +
      profile.crf +
      " input=" +
      inMB +
      "MB",
  );

  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error("[COMPRESS] Timed out after 30 min (" + videoType + ")"),
        ),
      30 * 60 * 1000,
    );

    // ── Build -vf filter chain ────────────────────────────────────────────
    // All filters live in a single -vf chain to avoid the "two -vf" ffmpeg
    // error that would occur if any filter were passed as a separate option.
    //
    // Enhancement filters (camera streams only) — prepended BEFORE scale:
    //   hqdn3d              denoise before re-encode to avoid amplifying noise
    //   colorlevels         set true black/white points → remove grey haze
    //   eq                  gamma lift + contrast + saturation
    //   curves              S-curve to lift shadows, pop face vs background
    //   unsharp             sharpen luma after denoiser softened edges
    //
    // Geometry filters — applied AFTER enhancement:
    //   scale               resize to target height, preserve AR
    //   setsar=1:1          overwrite broken SAR tag → square pixels
    //   fps                 frame-rate normalisation (camera streams only)
    //
    // Order matters: enhance → scale → setsar → fps.
    const vfParts = [];

    if (profile.enhance) {
      // Step 1 — Temporal+spatial denoiser: removes compression artefacts
      //          from the already-lossy WebM source before re-encoding.
      vfParts.push("hqdn3d=1.5:1:2.5:2.5");

      // Step 2 — Set true black/white points from source tonal range.
      //   rimin/gimin/bimin=0.12  → black point at 31/255 (actual source min)
      //   rimax/gimax/bimax=0.65  → white point at 165/255 (actual source max)
      //   Stretches 31–165 → 0–255, removing grey haze and fixing underexposure
      //   caused by webcam auto-exposure being fooled by a bright background.
      vfParts.push(
        "colorlevels=rimin=0.12:gimin=0.12:bimin=0.12" +
          ":rimax=0.65:gimax=0.65:bimax=0.65",
      );

      // Step 3 — Exposure + colour correction.
      //   gamma=1.35   lifts midtones (faces) without blowing highlights
      //   contrast=1.1 firms up image after tonal stretch
      //   saturation=1.5 restores colour lost to flat/underexposed source
      vfParts.push("eq=gamma=1.35:contrast=1.1:saturation=1.5");

      // Step 4 — S-curve: lift shadows (face), gently cap highlights (wall).
      //   Produces "face pops against background" without over-brightening.
      vfParts.push("curves=master=0/0|0.25/0.30|0.55/0.60|0.85/0.90|1/1");

      // Step 5 — Sharpen luma after denoiser softened edges.
      //   la=0.5 on 5×5 kernel. ca=0 skips chroma to avoid colour fringing.
      vfParts.push("unsharp=lx=5:ly=5:la=0.5:cx=3:cy=3:ca=0.0");
    }

    // Geometry: always scale; fix SAR if needed; normalise fps if set
    vfParts.push("scale=" + profile.scale);
    if (profile.setsar) vfParts.push("setsar=1:1");
    if (profile.fps) vfParts.push("fps=" + profile.fps);

    let cmd = fluentFfmpeg(inputPath)
      .videoCodec("libx264")
      .addOutputOption("-vf " + vfParts.join(","))
      .addOutputOption("-crf " + profile.crf)
      .addOutputOption("-preset " + profile.preset)
      .audioCodec(profile.audioCodec)
      .audioBitrate(profile.audioBitrate)
      .addOutputOption("-ac " + profile.audioChannels)
      .addOutputOption("-movflags +faststart")
      .addOutputOption("-fflags +genpts");

    for (const opt of profile.extraOptions) {
      cmd = cmd.addOutputOption(opt);
    }

    cmd
      .on("start", (cmdLine) => {
        console.log("[COMPRESS] ffmpeg cmd (" + videoType + "): " + cmdLine);
      })
      .on("stderr", (line) => {
        // Print lines that signal real problems; skip normal encode chatter
        if (
          line.includes("Error") ||
          line.includes("Invalid") ||
          line.includes("Unknown encoder") ||
          line.includes("No such file") ||
          line.includes("not found")
        ) {
          console.warn("[COMPRESS] ffmpeg stderr (" + videoType + "):", line);
        }
      })
      .on("progress", (progress) => {
        if (progress.percent != null) {
          process.stdout.write(
            "\r[COMPRESS] " +
              videoType +
              " " +
              Math.round(progress.percent) +
              "%  ",
          );
        }
      })
      .on("end", () => {
        clearTimeout(timer);
        process.stdout.write("\n");
        try {
          const outStat = fsSync.statSync(outputPath);
          const outMB = (outStat.size / 1024 / 1024).toFixed(2);
          const pct = ((outStat.size / inputStat.size) * 100).toFixed(1);
          console.log(
            "[COMPRESS] Done (" +
              videoType +
              "): " +
              inMB +
              " MB raw -> " +
              outMB +
              " MB compressed (" +
              pct +
              "% of raw)",
          );
        } catch (_) {
          console.log(
            "[COMPRESS] Done (" + videoType + ") — could not stat output",
          );
        }
        resolve();
      })
      .on("error", (err, _stdout, stderr) => {
        clearTimeout(timer);
        process.stdout.write("\n");
        console.error("[COMPRESS] FAILED (" + videoType + "): " + err.message);
        if (stderr) console.error("[COMPRESS] stderr dump:\n" + stderr);
        reject(
          new Error(
            "[COMPRESS] " +
              videoType +
              ": " +
              err.message +
              (stderr ? " | " + stderr.slice(0, 800) : ""),
          ),
        );
      })
      .save(outputPath);
  });
}

/* ── Redis helpers ───────────────────────────────────────────────────────── */

const redisKey = (userId, interviewId, videoType) =>
  `interview:${userId}:${interviewId}:recording:${videoType}`;

const evalLockKey = (interviewId) => `interview:${interviewId}:evaluation:lock`;

async function redisGet(key) {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}
async function redisSet(key, value, ...args) {
  try {
    return await redis.set(key, value, ...args);
  } catch {
    return null;
  }
}
async function redisDel(key) {
  try {
    return await redis.del(key);
  } catch {
    return null;
  }
}

/* ── Retry helper ────────────────────────────────────────────────────────── */

async function withRetry(
  fn,
  { attempts = 4, baseDelayMs = 3000, label = "" } = {},
) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = baseDelayMs * Math.pow(2, i - 1);
      console.warn(
        `⚠️  ${label} attempt ${i}/${attempts} failed (${err.message}) — retrying in ${delay / 1000}s`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/* ── DB helpers ──────────────────────────────────────────────────────────── */

async function ensureVideoRecord(interviewId, userId, videoType) {
  const [result] = await pool.execute(
    `INSERT INTO interview_videos
       (interview_id, user_id, video_type, original_filename, file_size,
        ftp_path, ftp_url, upload_status, upload_progress, total_chunks,
        uploaded_chunks, started_at)
     VALUES (?, ?, ?, ?, 0, '', '', 'pending', 0, 0, 0, NOW())
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [interviewId, userId, videoType, `${videoType}_${interviewId}.webm`],
  );
  return result.insertId;
}

async function insertChunkRecord(videoId, chunkNumber, chunkSize, ftpPath) {
  await withRetry(
    async () => {
      const [upsertResult] = await pool.execute(
        `INSERT INTO interview_video_chunks
           (video_id, chunk_number, chunk_size, temp_ftp_path, upload_status, uploaded_at)
         VALUES (?, ?, ?, ?, 'uploaded', NOW())
         ON DUPLICATE KEY UPDATE
           chunk_size    = VALUES(chunk_size),
           temp_ftp_path = VALUES(temp_ftp_path),
           upload_status = 'uploaded',
           uploaded_at   = NOW()`,
        [videoId, chunkNumber, chunkSize, ftpPath],
      );

      if (upsertResult.affectedRows === 1) {
        await pool.execute(
          `UPDATE interview_videos
           SET uploaded_chunks = uploaded_chunks + 1,
               total_chunks    = GREATEST(total_chunks, ?),
               updated_at      = NOW()
           WHERE id = ?`,
          [chunkNumber + 1, videoId],
        );
      } else {
        await pool.execute(
          `UPDATE interview_videos
           SET total_chunks = GREATEST(total_chunks, ?), updated_at = NOW()
           WHERE id = ?`,
          [chunkNumber + 1, videoId],
        );
        console.log(
          `♻️  Chunk ${chunkNumber} (videoId=${videoId}) re-uploaded — counter not incremented`,
        );
      }
    },
    {
      attempts: 3,
      baseDelayMs: 200,
      label: `insertChunkRecord chunk=${chunkNumber}`,
    },
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ── Violation Clip Columns Bootstrap ─────────────────────────────────────────
   ─────────────────────────────────────────────────────────────────────────── */

async function ensureViolationClipColumns() {
  try {
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'interview_violations'`,
    );
    const colNames = new Set(cols.map((c) => c.COLUMN_NAME));

    if (!colNames.has("clip_url")) {
      await pool.execute(
        `ALTER TABLE interview_violations ADD COLUMN clip_url VARCHAR(2048) NULL`,
      );
      console.log("✅ [VIOLATIONS] Added column: clip_url");
    }
    if (!colNames.has("clip_ftp_path")) {
      await pool.execute(
        `ALTER TABLE interview_violations ADD COLUMN clip_ftp_path VARCHAR(2048) NULL`,
      );
      console.log("✅ [VIOLATIONS] Added column: clip_ftp_path");
    }
    if (!colNames.has("clip_status")) {
      await pool.execute(
        `ALTER TABLE interview_violations
         ADD COLUMN clip_status ENUM('pending','processing','completed','failed')
         NOT NULL DEFAULT 'pending'`,
      );
      console.log("✅ [VIOLATIONS] Added column: clip_status");
    }
  } catch (err) {
    console.warn(`⚠️ [VIOLATIONS] ensureViolationClipColumns: ${err.message}`);
  }
}

ensureViolationClipColumns();

/* ── Cut a single violation clip with ffmpeg ─────────────────────────────── */
//
// Violation clips are cut from the already-compressed MP4 using -c copy
// (stream copy, no re-encode) so this is near-instant and lossless in quality.

async function cutVideoClip(inputPath, outputPath, startSec, durationSec) {
  const ffmpeg = require("fluent-ffmpeg");

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () =>
        reject(
          new Error(
            `ffmpeg clip cut timed out (start=${startSec}s dur=${durationSec}s)`,
          ),
        ),
      5 * 60 * 1000,
    );

    ffmpeg(inputPath)
      .setStartTime(startSec)
      .setDuration(durationSec)
      .outputOptions(["-c copy", "-avoid_negative_ts make_zero"])
      .on("start", (cmd) => console.log(`✂️  [CLIP] ffmpeg: ${cmd}`))
      .on("end", () => {
        clearTimeout(timeout);
        resolve();
      })
      .on("error", (err, _stdout, stderr) => {
        clearTimeout(timeout);
        console.error(`❌ [CLIP] ffmpeg error: ${stderr || err.message}`);
        reject(err);
      })
      .save(outputPath);
  });
}

/* ── Cut + upload all violation clips for an interview ───────────────────── */

async function cutAndUploadViolationClips(
  interviewId,
  mergedVideoLocalPath,
  recordingStartedAt,
) {
  const fs = require("fs").promises;
  const fsSync = require("fs");
  const path = require("path");

  const startEpoch = new Date(recordingStartedAt).getTime();

  let violations = [];
  try {
    const [rows] = await pool.execute(
      `SELECT id, violation_type, start_time, end_time
       FROM interview_violations
       WHERE interview_id = ?
         AND start_time IS NOT NULL
         AND end_time   IS NOT NULL
         AND clip_status IN ('pending', 'failed')
       ORDER BY start_time ASC`,
      [interviewId],
    );
    violations = rows;
  } catch (err) {
    console.warn(`⚠️ [CLIP] Could not fetch violations: ${err.message}`);
    return;
  }

  if (violations.length === 0) {
    console.log(
      `ℹ️  [CLIP] No closed violations to clip for interview ${interviewId}`,
    );
    return;
  }

  console.log(
    `✂️  [CLIP] Processing ${violations.length} violation clip(s) for interview ${interviewId}`,
  );

  const tempDir = `/tmp/clips_${interviewId}_${Date.now()}`;
  await fs.mkdir(tempDir, { recursive: true });

  let successCount = 0;
  let failCount = 0;

  for (const viol of violations) {
    const violId = viol.id;
    const violType = viol.violation_type;

    const violStartEpoch = new Date(viol.start_time).getTime();
    const violEndEpoch = new Date(viol.end_time).getTime();

    const PAD_SEC = 2;
    const rawStartSec = (violStartEpoch - startEpoch) / 1000;
    const rawDurationSec = (violEndEpoch - violStartEpoch) / 1000;

    const clipStartSec = Math.max(0, rawStartSec - PAD_SEC);
    const clipDurationSec = rawDurationSec + PAD_SEC * 2;

    if (clipDurationSec <= 0) {
      console.warn(
        `⚠️  [CLIP] Violation ${violId} has zero/negative duration — skipping`,
      );
      await pool
        .execute(
          `UPDATE interview_violations SET clip_status = 'failed' WHERE id = ?`,
          [violId],
        )
        .catch(() => {});
      failCount++;
      continue;
    }

    // Clip output is MP4 to match the compressed primary_camera container
    const clipFilename = `violation_${violType}_${violId}_${Date.now()}.mp4`;
    const clipLocalPath = path.join(tempDir, clipFilename);
    const ftpRemotePath = `/public/interview-videos/${interviewId}/violations`;

    await pool
      .execute(
        `UPDATE interview_violations SET clip_status = 'processing' WHERE id = ?`,
        [violId],
      )
      .catch(() => {});

    try {
      await cutVideoClip(
        mergedVideoLocalPath,
        clipLocalPath,
        clipStartSec,
        clipDurationSec,
      );

      const stat = await fs.stat(clipLocalPath).catch(() => null);
      if (!stat || stat.size === 0) {
        throw new Error(`ffmpeg produced empty clip for violation ${violId}`);
      }

      console.log(
        `✅ [CLIP] Cut violation ${violId} (${violType}): ` +
          `t=${clipStartSec.toFixed(2)}s dur=${clipDurationSec.toFixed(2)}s → ${(stat.size / 1024).toFixed(1)} KB`,
      );

      const clipBuffer = await fs.readFile(clipLocalPath);
      const ftpResult = await withRetry(
        () => uploadFileToFTP(clipBuffer, clipFilename, ftpRemotePath),
        {
          attempts: 3,
          baseDelayMs: 2000,
          label: `Upload violation clip ${violId}`,
        },
      );

      console.log(`📤 [CLIP] Violation ${violId} uploaded → ${ftpResult.url}`);

      await pool.execute(
        `UPDATE interview_violations
         SET clip_url      = ?,
             clip_ftp_path = ?,
             clip_status   = 'completed',
             updated_at    = NOW()
         WHERE id = ?`,
        [ftpResult.url, ftpResult.remotePath, violId],
      );

      await fs.unlink(clipLocalPath).catch(() => {});
      successCount++;
    } catch (err) {
      console.error(
        `❌ [CLIP] Failed to process violation ${violId} (${violType}): ${err.message}`,
      );
      await pool
        .execute(
          `UPDATE interview_violations SET clip_status = 'failed', updated_at = NOW() WHERE id = ?`,
          [violId],
        )
        .catch(() => {});
      failCount++;
    }
  }

  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

  console.log(
    `🎬 [CLIP] Violation clipping complete for interview ${interviewId}: ` +
      `${successCount} succeeded, ${failCount} failed`,
  );
}

/* ── Answer Analysis ─────────────────────────────────────────────────────── */

async function runAnswerAnalysisDuringWait(interviewId, userId) {
  const lockKey = evalLockKey(interviewId);

  let lockAcquired = false;
  try {
    const result = await redis.set(lockKey, "1", "NX", "EX", 60 * 10);
    lockAcquired = result === "OK";
  } catch {
    lockAcquired = false;
  }

  if (!lockAcquired) {
    console.log(
      `🔒 [EVAL] Lock already held for interview ${interviewId} — skipping duplicate`,
    );
    return null;
  }

  console.log(
    `🧠 [EVAL] Starting answer analysis for interview ${interviewId}…`,
  );

  try {
    const evalResult = await evaluateInterview(interviewId);
    const { overallEvaluation, questionEvaluations, totalQuestions } =
      evalResult;

    await pool
      .execute(
        `INSERT INTO interview_recording_analysis
         (interview_id, user_id, overall_score, hire_decision, experience_level,
          total_questions, strengths, weaknesses, summary, analysed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         overall_score    = VALUES(overall_score),
         hire_decision    = VALUES(hire_decision),
         experience_level = VALUES(experience_level),
         total_questions  = VALUES(total_questions),
         strengths        = VALUES(strengths),
         weaknesses       = VALUES(weaknesses),
         summary          = VALUES(summary),
         analysed_at      = NOW()`,
        [
          interviewId,
          userId,
          overallEvaluation.overallScore,
          overallEvaluation.hireDecision,
          overallEvaluation.experienceLevel,
          totalQuestions,
          overallEvaluation.strengths ?? "",
          overallEvaluation.weaknesses ?? "",
          overallEvaluation.summary ?? "",
        ],
      )
      .catch((err) =>
        console.warn(
          `⚠️ [EVAL] interview_recording_analysis upsert skipped: ${err.message}`,
        ),
      );

    const summary = {
      overallScore: overallEvaluation.overallScore,
      hireDecision: overallEvaluation.hireDecision,
      experienceLevel: overallEvaluation.experienceLevel,
      totalQuestions,
      strengths: overallEvaluation.strengths,
      weaknesses: overallEvaluation.weaknesses,
      summary: overallEvaluation.summary,
      averages: overallEvaluation.averages,
      questionBreakdown: questionEvaluations.map((q) => ({
        order: q.questionOrder,
        question: q.question,
        score: q.score,
        quality: q.quality,
        feedback: q.feedback,
      })),
    };

    console.log(
      `✅ [EVAL] Analysis complete — score=${summary.overallScore} ` +
        `hire=${summary.hireDecision} ` +
        `(${summary.totalQuestions} questions, interview ${interviewId})`,
    );

    return summary;
  } catch (err) {
    console.error(
      `❌ [EVAL] Analysis failed for interview ${interviewId}:`,
      err.message,
    );
    await redisDel(lockKey);
    return null;
  }
}

/* ── Start Recording ─────────────────────────────────────────────────────── */

const startRecording = asyncHandler(async (req, res) => {
  const { interviewId, videoType = "primary_camera" } = req.body;
  const userId = req.user.id;

  if (!interviewId) throw new APIERR(400, "interviewId is required");
  if (!VIDEO_TYPES.includes(videoType))
    throw new APIERR(
      400,
      `videoType must be one of: ${VIDEO_TYPES.join(", ")}`,
    );

  const key = redisKey(userId, interviewId, videoType);

  const lockPlaceholder = JSON.stringify({
    status: "starting",
    userId,
    interviewId,
    videoType,
  });

  const acquired = await redis.set(key, lockPlaceholder, "NX", "EX", 10);

  if (!acquired) {
    const existing = await redisGet(key);
    if (existing) {
      const parsed = JSON.parse(existing);
      console.log(
        `ℹ️  start-recording deduped — ${videoType} already ${parsed.status} (interview ${interviewId})`,
      );
      return res.status(200).json(
        new APIRES(
          200,
          {
            status: parsed.status,
            videoType,
            videoId: parsed.videoId ?? null,
          },
          "Already started",
        ),
      );
    }
  }

  const videoId = await ensureVideoRecord(interviewId, userId, videoType);
  const meta = {
    status: "recording",
    userId,
    interviewId,
    videoType,
    videoId,
    startedAt: Date.now(),
  };

  await redisSet(key, JSON.stringify(meta), "EX", RECORDING_TTL);

  if (videoType === "primary_camera") {
    await pool.execute(
      `UPDATE interviews
       SET recording_status = 'recording', updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [interviewId, userId],
    );
  }

  await pool.execute(
    `UPDATE interview_videos
     SET upload_status = 'uploading', started_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [videoId],
  );

  const profile = COMPRESSION_PROFILES[videoType];
  console.log(
    `✅ Recording started — ${videoType} videoId=${videoId} ` +
      `(interview ${interviewId}) → will compress as ${profile.displayLabel}`,
  );

  res
    .status(200)
    .json(
      new APIRES(
        200,
        { status: "recording", videoType, videoId },
        "Recording started",
      ),
    );
});

/* ── Upload Chunk ────────────────────────────────────────────────────────── */

const uploadChunk = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;
  const userId = req.user.id;
  const chunkIndex = parseInt(req.body?.chunkIndex ?? "0", 10);
  const videoType = req.body?.videoType || "primary_camera";

  if (!req.file) throw new APIERR(400, "No chunk file in request");
  if (!VIDEO_TYPES.includes(videoType))
    throw new APIERR(400, "Invalid videoType");

  const key = redisKey(userId, interviewId, videoType);
  let cached = await redisGet(key);

  if (!cached) {
    console.warn(`⚠️ Auto-creating session for ${videoType}`);
    const videoId = await ensureVideoRecord(interviewId, userId, videoType);
    const meta = {
      status: "recording",
      userId,
      interviewId,
      videoType,
      videoId,
      startedAt: Date.now(),
      autoCreated: true,
    };
    await redisSet(key, JSON.stringify(meta), "EX", RECORDING_TTL);
    cached = JSON.stringify(meta);
  }

  const meta = JSON.parse(cached);
  if (!["recording", "processing", "completed"].includes(meta.status))
    throw new APIERR(400, "Recording not active");

  if (meta.status === "completed")
    console.warn(
      `⚠️ Late chunk ${chunkIndex} (${videoType}) arrived after merge — storing but will NOT be merged`,
    );

  const { videoId } = meta;
  const buffer = Buffer.from(req.file.buffer);
  const idx = String(chunkIndex).padStart(6, "0");
  const fileName = `${Date.now()}-chunk_${idx}.webm`;
  const remotePath = `/public/interview-videos/${userId}/${interviewId}/${videoType}/chunks`;

  const ftpResult = await withRetry(
    () => uploadFileToFTP(buffer, fileName, remotePath),
    {
      attempts: 3,
      baseDelayMs: 1000,
      label: `chunk ${chunkIndex} (${videoType})`,
    },
  );

  const ftpPath = ftpResult.remotePath ?? `${remotePath}/${fileName}`;
  await insertChunkRecord(videoId, chunkIndex, buffer.length, ftpPath);

  console.log(`📤 Chunk ${chunkIndex} (${videoType}) confirmed — FTP + DB ✓`);
  res
    .status(200)
    .json(new APIRES(200, { chunkIndex, videoType }, "Chunk saved"));
});

/* ── End Recording ───────────────────────────────────────────────────────── */

const endRecording = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;
  const userId = req.user.id;
  const videoType = req.body?.videoType || "primary_camera";

  if (!VIDEO_TYPES.includes(videoType))
    throw new APIERR(400, "Invalid videoType");

  const key = redisKey(userId, interviewId, videoType);
  const cached = await redisGet(key);
  let meta = cached ? JSON.parse(cached) : null;

  if (!meta) {
    const [rows] = await pool.execute(
      `SELECT id FROM interview_videos
       WHERE interview_id = ? AND user_id = ? AND video_type = ?`,
      [interviewId, userId, videoType],
    );
    if (!rows[0]) throw new APIERR(404, "Recording session not found");
    meta = {
      status: "recording",
      userId,
      interviewId,
      videoType,
      videoId: rows[0].id,
    };
  } else if (meta.status !== "recording") {
    throw new APIERR(400, "Recording not active");
  }

  await redisSet(
    key,
    JSON.stringify({ ...meta, status: "processing", stoppedAt: Date.now() }),
    "EX",
    RECORDING_TTL,
  );

  await pool.execute(
    `UPDATE interview_videos
     SET upload_status = 'merging', updated_at = NOW()
     WHERE id = ?`,
    [meta.videoId],
  );

  if (videoType === "primary_camera") {
    await pool.execute(
      `UPDATE interviews
       SET recording_status = 'processing', updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [interviewId, userId],
    );
  }

  res
    .status(200)
    .json(
      new APIRES(
        200,
        { status: "processing", videoType },
        "Recording stopped — analysing answers and merging video in background",
      ),
    );

  // ── Background pipeline (fire-and-forget) ─────────────────────────────────
  (async () => {
    const pipelineStart = Date.now();
    try {
      if (videoType === "primary_camera") {
        const analysisResult = await runAnswerAnalysisDuringWait(
          interviewId,
          userId,
        );
        if (analysisResult) {
          console.log(
            `📊 [PIPELINE] Analysis ready — overall=${analysisResult.overallScore} ` +
              `hire=${analysisResult.hireDecision} ` +
              `(${analysisResult.totalQuestions} questions, interview ${interviewId})`,
          );
        }
      }

      const elapsed = Date.now() - pipelineStart;
      const remainingWait = Math.max(0, MERGE_DELAY_MS - elapsed);

      if (remainingWait > 0) {
        console.log(
          `⏳ [PIPELINE] ${videoType} — waiting ${Math.round(remainingWait / 1000)}s before merge…`,
        );
        await new Promise((r) => setTimeout(r, remainingWait));
      }

      const profile = COMPRESSION_PROFILES[videoType];
      console.log(
        `🎬 [PIPELINE] Starting merge+compress for ${videoType} ` +
          `[${profile.displayLabel}] (interview ${interviewId})`,
      );

      const finalizeResult = await finalizeRecording({
        userId,
        interviewId,
        videoType,
        videoId: meta.videoId,
      });

      if (videoType === "primary_camera" && finalizeResult?.mergedLocalPath) {
        console.log(
          `✂️  [PIPELINE] Starting violation clip extraction for interview ${interviewId}`,
        );
        await cutAndUploadViolationClips(
          interviewId,
          finalizeResult.mergedLocalPath,
          finalizeResult.recordingStartedAt,
        ).catch((err) =>
          console.error(
            `❌ [PIPELINE] Violation clipping failed: ${err.message}`,
          ),
        );

        if (finalizeResult.tempDir) {
          await require("fs")
            .promises.rm(finalizeResult.tempDir, {
              recursive: true,
              force: true,
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error(`❌ [PIPELINE] Failed (${videoType}) — ${err.message}`);
      console.error(err.stack ?? "(no stack)");
    }
  })();
});

/* ── GET /interviews/:interviewId/analysis ───────────────────────────────── */

const getAnalysisResult = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;
  const userId = req.user.id;

  const [summaryRows] = await pool
    .execute(
      `SELECT * FROM interview_recording_analysis
       WHERE interview_id = ? AND user_id = ? LIMIT 1`,
      [interviewId, userId],
    )
    .catch(() => [[]]);

  if (summaryRows?.[0]) {
    const [qRows] = await pool
      .execute(
        `SELECT qe.score, qe.feedback, qe.correctness, qe.depth, qe.clarity,
                iq.question_order, iq.question, iq.answer
         FROM question_evaluations qe
         JOIN interview_questions  iq ON qe.question_id = iq.id
         WHERE qe.interview_id = ?
         ORDER BY iq.question_order ASC`,
        [interviewId],
      )
      .catch(() => [[]]);

    return res
      .status(200)
      .json(
        new APIRES(
          200,
          { ...summaryRows[0], questionBreakdown: qRows ?? [] },
          "Analysis result",
        ),
      );
  }

  const [evalRows] = await pool
    .execute(
      `SELECT overall_score, hire_decision, experience_level, strengths, weaknesses, summary
       FROM interview_evaluations WHERE interview_id = ? LIMIT 1`,
      [interviewId],
    )
    .catch(() => [[]]);

  if (!evalRows?.[0]) {
    return res
      .status(202)
      .json(
        new APIRES(
          202,
          { status: "pending" },
          "Analysis not yet complete — please retry",
        ),
      );
  }

  const [qRows] = await pool
    .execute(
      `SELECT qe.score, qe.feedback, qe.correctness, qe.depth, qe.clarity,
              iq.question_order, iq.question, iq.answer
       FROM question_evaluations qe
       JOIN interview_questions  iq ON qe.question_id = iq.id
       WHERE qe.interview_id = ?
       ORDER BY iq.question_order ASC`,
      [interviewId],
    )
    .catch(() => [[]]);

  res
    .status(200)
    .json(
      new APIRES(
        200,
        { ...evalRows[0], questionBreakdown: qRows ?? [] },
        "Analysis result",
      ),
    );
});

/* ── GET /interviews/:interviewId/violations ─────────────────────────────── */

const getViolationClips = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;
  const userId = req.user.id;

  const [interviewRows] = await pool.execute(
    `SELECT id, user_id FROM interviews WHERE id = ? LIMIT 1`,
    [interviewId],
  );

  if (!interviewRows?.[0]) throw new APIERR(404, "Interview not found");

  const [rows] = await pool.execute(
    `SELECT id, violation_type, start_time, end_time, duration_seconds,
            warning_count, resolved, details, clip_url, clip_ftp_path, clip_status
     FROM interview_violations
     WHERE interview_id = ?
     ORDER BY start_time ASC`,
    [interviewId],
  );

  res.status(200).json(
    new APIRES(
      200,
      {
        total: rows.length,
        clipsReady: rows.filter((r) => r.clip_status === "completed").length,
        violations: rows.map((r) => ({
          id: r.id,
          type: r.violation_type,
          startTime: r.start_time,
          endTime: r.end_time,
          durationSeconds: r.duration_seconds,
          warningCount: r.warning_count,
          resolved: !!r.resolved,
          details: r.details
            ? typeof r.details === "string"
              ? JSON.parse(r.details)
              : r.details
            : null,
          clipUrl: r.clip_url ?? null,
          clipFtpPath: r.clip_ftp_path ?? null,
          clipStatus: r.clip_status ?? "pending",
        })),
      },
      "Violation clips",
    ),
  );
});

/* ─────────────────────────────────────────────────────────────────────────────
   ── Finalize: download chunks → binary concat → H.264 compress → FTP ─────────
   ─────────────────────────────────────────────────────────────────────────────
   Pipeline stages:
     1. Poll DB until all in-flight chunks have settled
     2. Download every uploaded chunk from FTP in order
     3. Binary-concatenate all chunk buffers → raw .webm file on disk
     4. FFmpeg re-encode: H.264 (libx264 via ffmpeg-static) + AAC → .mp4 (per COMPRESSION_PROFILES)
     5. Verify output size (must be > 0 and < 110% of raw; otherwise fall back to raw)
     6. ffprobe duration, SHA-256 checksum
     7. Upload compressed .mp4 to FTP
     8. Update interview_videos + interviews in DB
     9. For primary_camera: return mergedLocalPath so violation clip cutting can use it
   ─────────────────────────────────────────────────────────────────────────── */

async function finalizeRecording({ userId, interviewId, videoType, videoId }) {
  const key = redisKey(userId, interviewId, videoType);
  const fs = require("fs").promises;
  const fsSync = require("fs");
  const path = require("path");
  const crypto = require("crypto");

  const profile =
    COMPRESSION_PROFILES[videoType] ?? COMPRESSION_PROFILES.primary_camera;
  const tempDir = `/tmp/merge_${interviewId}_${videoType}_${Date.now()}`;

  let recordingStartedAt = null;
  try {
    const [videoRows] = await pool.execute(
      `SELECT started_at FROM interview_videos WHERE id = ? LIMIT 1`,
      [videoId],
    );
    recordingStartedAt = videoRows?.[0]?.started_at ?? null;
  } catch (_) {}

  try {
    console.log(
      `🎬 Finalizing ${videoType} [${profile.displayLabel}] for interview ${interviewId}`,
    );

    // ── 1. Poll until all in-flight chunks have settled ────────────────────
    console.log(`⏳ Waiting for all chunks to settle (${videoType})…`);
    let allChunks = [];
    const pollDeadline = Date.now() + CHUNK_SETTLE_TIMEOUT_MS;

    while (Date.now() < pollDeadline) {
      const [rows] = await pool.execute(
        `SELECT chunk_number, temp_ftp_path, chunk_size, upload_status
         FROM interview_video_chunks
         WHERE video_id = ?
         ORDER BY chunk_number ASC`,
        [videoId],
      );
      const inFlight = rows.filter(
        (r) => !["uploaded", "failed", "merged"].includes(r.upload_status),
      );
      if (inFlight.length === 0) {
        allChunks = rows;
        break;
      }
      console.log(
        `⏳ ${inFlight.length} chunk(s) still in-flight for ${videoType} — polling in ${CHUNK_SETTLE_POLL_MS / 1000}s`,
      );
      await new Promise((r) => setTimeout(r, CHUNK_SETTLE_POLL_MS));
    }

    if (allChunks.length === 0) {
      const [finalRows] = await pool.execute(
        `SELECT chunk_number, temp_ftp_path, chunk_size, upload_status
         FROM interview_video_chunks WHERE video_id = ?`,
        [videoId],
      );
      allChunks = finalRows;
    }

    const uploadedChunks = allChunks
      .filter((r) => r.upload_status === "uploaded")
      .sort((a, b) => a.chunk_number - b.chunk_number);

    const failedChunks = allChunks.filter((r) => r.upload_status === "failed");
    if (failedChunks.length > 0)
      console.warn(
        `⚠️ ${failedChunks.length} failed chunk(s) for ${videoType}: ` +
          failedChunks.map((c) => c.chunk_number).join(", "),
      );

    if (uploadedChunks.length === 0) {
      console.warn(`⚠️ No uploaded chunks for ${videoType} — marking failed`);
      await pool.execute(
        `UPDATE interview_videos
         SET upload_status = 'failed', error_message = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          failedChunks.length > 0
            ? `All ${failedChunks.length} chunk(s) failed`
            : "No chunks found",
          videoId,
        ],
      );
      await redisDel(key);
      return { mergedLocalPath: null, recordingStartedAt };
    }

    // ── Gap detection ──────────────────────────────────────────────────────
    const chunkNumbers = uploadedChunks.map((c) => c.chunk_number);
    const gaps = [];
    for (let i = 1; i < chunkNumbers.length; i++) {
      if (chunkNumbers[i] !== chunkNumbers[i - 1] + 1)
        gaps.push({ after: chunkNumbers[i - 1], before: chunkNumbers[i] });
    }
    if (gaps.length > 0) {
      console.warn(
        `⚠️ Sequence gap(s) in ${videoType}: ` +
          gaps.map((g) => `${g.after}→${g.before}`).join(", ") +
          ` — merging ${uploadedChunks.length} available chunks anyway`,
      );
    } else {
      console.log(
        `✅ Chunk sequence OK — ${uploadedChunks.length} chunks, ${videoType}`,
      );
    }

    // ── 2. Download chunks from FTP ────────────────────────────────────────
    console.log(
      `📦 Downloading ${uploadedChunks.length} chunks for ${videoType}…`,
    );
    await fs.mkdir(tempDir, { recursive: true });

    const chunkBuffers = [];

    for (const chunk of uploadedChunks) {
      const buf = await withRetry(
        async () => {
          const b = await downloadFileFromFTP(chunk.temp_ftp_path);
          if (!b || b.length === 0)
            throw new Error(`Empty buffer for chunk ${chunk.chunk_number}`);
          return b;
        },
        {
          attempts: 4,
          baseDelayMs: 3000,
          label: `DL chunk ${chunk.chunk_number} (${videoType})`,
        },
      );

      chunkBuffers.push(buf);
      console.log(
        `↓ chunk ${chunk.chunk_number}/${uploadedChunks.length - 1} (${videoType}) — ${buf.length} bytes`,
      );
    }

    // ── 3. Binary concat → raw .webm ──────────────────────────────────────
    const totalBytes = chunkBuffers.reduce((s, b) => s + b.length, 0);
    const rawWebmPath = path.join(tempDir, `${videoType}_raw.webm`);

    const outputExt = profile.outputExt;
    const compressedPath = path.join(
      tempDir,
      `${videoType}_compressed.${outputExt}`,
    );

    console.log(
      `🔗 Binary-concatenating ${chunkBuffers.length} chunks ` +
        `(${(totalBytes / 1024 / 1024).toFixed(2)} MB raw) for ${videoType}…`,
    );

    const writeStream = fsSync.createWriteStream(rawWebmPath);
    await new Promise((resolve, reject) => {
      writeStream.on("error", reject);
      writeStream.on("finish", resolve);
      for (const buf of chunkBuffers) writeStream.write(buf);
      writeStream.end();
    });

    // Free memory immediately — chunks are on disk now
    chunkBuffers.length = 0;

    const rawStat = await fs.stat(rawWebmPath);
    if (rawStat.size === 0)
      throw new Error(`Binary concat produced empty file for ${videoType}`);

    console.log(
      `✅ Raw concat done: ${(rawStat.size / 1024 / 1024).toFixed(2)} MB → ` +
        `starting H.264 compression [${profile.displayLabel}]…`,
    );

    // ── 4. H.264 compression ───────────────────────────────────────────────
    await compressVideo(rawWebmPath, compressedPath, videoType);

    // ── 5. Verify output ───────────────────────────────────────────────────
    let finalPath = compressedPath;
    const compressedStat = await fs.stat(compressedPath).catch(() => null);

    if (!compressedStat || compressedStat.size === 0) {
      // Compression failed to produce output — fall back to raw webm upload
      console.warn(
        `⚠️ [COMPRESS] Compressed file is empty for ${videoType} — falling back to raw webm`,
      );
      finalPath = rawWebmPath;
    } else {
      const ratio = compressedStat.size / rawStat.size;
      const savedMB = (rawStat.size - compressedStat.size) / 1024 / 1024;

      console.log(
        `📉 [COMPRESS] ${videoType}: ` +
          `${(rawStat.size / 1024 / 1024).toFixed(2)} MB raw → ` +
          `${(compressedStat.size / 1024 / 1024).toFixed(2)} MB compressed ` +
          `(${(ratio * 100).toFixed(1)}% of raw, saved ${savedMB.toFixed(2)} MB)`,
      );

      // Guard: if compressed > raw the encoder had a bad day — use raw
      if (compressedStat.size > rawStat.size * 1.1) {
        console.warn(
          `⚠️ [COMPRESS] Compressed file is LARGER than raw for ${videoType} — using raw`,
        );
        finalPath = rawWebmPath;
      }
    }

    // ── 6. Probe duration + size + checksum (all streaming — no heap spike) ──
    const ffmpeg = require("fluent-ffmpeg");

    const duration = await new Promise((resolve) => {
      ffmpeg.ffprobe(finalPath, (err, probeMeta) => {
        if (err) {
          console.warn(`⚠️ ffprobe failed for ${videoType}: ${err.message}`);
          resolve(null);
        } else {
          const d = Math.round(probeMeta?.format?.duration ?? 0);
          // Log the actual encoded dimensions so we can confirm SAR fix
          const vs = probeMeta?.streams?.find((s) => s.codec_type === "video");
          if (vs) {
            console.log(
              `⏱️  Probed: ${d}s · ${vs.width}×${vs.height} · SAR ${vs.sample_aspect_ratio ?? "n/a"} · DAR ${vs.display_aspect_ratio ?? "n/a"} (${videoType})`,
            );
          } else {
            console.log(`⏱️  Probed duration: ${d}s (${videoType})`);
          }
          resolve(d);
        }
      });
    });

    const finalStat = await fs.stat(finalPath);
    const fileSize = finalStat.size;

    const checksum = await new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const rs = fsSync.createReadStream(finalPath);
      rs.on("data", (chunk) => hash.update(chunk));
      rs.on("end", () => resolve(hash.digest("hex")));
      rs.on("error", reject);
    });

    console.log(
      `📊 ${videoType}: ${(fileSize / 1024 / 1024).toFixed(2)} MB final ` +
        `(${profile.displayLabel}), ${duration}s, ` +
        `${uploadedChunks.length} chunks merged, sha256=${checksum.slice(0, 12)}…`,
    );

    // ── 7. Upload compressed file to FTP ──────────────────────────────────
    const mergedFilename = `${videoType}_${interviewId}_${Date.now()}.${outputExt}`;
    const ftpRemoteDir = `/public/interview-videos/${interviewId}`;

    console.log(
      `📤 [UPLOAD] ${videoType} — ` +
        `${(fileSize / 1024 / 1024).toFixed(2)} MB → ${ftpRemoteDir}/${mergedFilename}`,
    );

    // uploadFileToFTP calls writable.end(data) internally which only accepts
    // string | Buffer — ReadStream is NOT supported.
    const mergedBuffer = await fs.readFile(finalPath);
    const ftpResult = await withRetry(
      () => uploadFileToFTP(mergedBuffer, mergedFilename, ftpRemoteDir),
      {
        attempts: 5,
        baseDelayMs: 10_000,
        label: `[UPLOAD] ${videoType}`,
      },
    );

    if (!ftpResult?.url) {
      throw new Error(
        `uploadFileToFTP returned no URL for ${videoType} — FTP upload likely failed silently`,
      );
    }

    console.log(
      `✅ [UPLOAD] ${videoType} uploaded → ${ftpResult.url} ` +
        `(${(fileSize / 1024 / 1024).toFixed(2)} MB)`,
    );

    // ── 8. Update DB ───────────────────────────────────────────────────────
    await pool.execute(
      `UPDATE interview_videos
       SET ftp_url = ?, ftp_path = ?, file_size = ?, duration = ?,
           checksum = ?, upload_status = 'completed', upload_progress = 100,
           completed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [
        ftpResult.url,
        ftpResult.remotePath,
        fileSize,
        duration,
        checksum,
        videoId,
      ],
    );

    await pool.execute(
      `UPDATE interview_video_chunks
       SET upload_status = 'merged'
       WHERE video_id = ? AND upload_status = 'uploaded'`,
      [videoId],
    );

    const col = INTERVIEW_COLUMN_MAP[videoType];
    if (col) {
      await pool
        .execute(
          `UPDATE interviews
           SET \`${col}\` = ?, updated_at = NOW()
           WHERE id = ? AND user_id = ?`,
          [ftpResult.url, interviewId, userId],
        )
        .catch((err) =>
          console.warn(`⚠️ interviews.${col} update failed:`, err.message),
        );
    }

    if (videoType === "primary_camera") {
      await pool
        .execute(
          `UPDATE interviews
           SET recording_status = 'completed', updated_at = NOW()
           WHERE id = ? AND user_id = ?`,
          [interviewId, userId],
        )
        .catch(() => {});
    }

    const currentMeta = JSON.parse((await redisGet(key)) || "{}");
    await redisSet(
      key,
      JSON.stringify({
        ...currentMeta,
        status: "completed",
        completedAt: Date.now(),
      }),
      "EX",
      60 * 30,
    );

    // ── 9. Defer tempDir cleanup for primary_camera (clip cutting needs it) ─
    if (videoType !== "primary_camera") {
      await fs.rm(tempDir, { recursive: true, force: true });
    } else {
      console.log(`📂 [FINALIZE] Keeping tempDir for clip cutting: ${tempDir}`);
    }

    console.log(
      `🎉 ${videoType} finalization complete — ` +
        `${uploadedChunks.length} chunks → ${(fileSize / 1024 / 1024).toFixed(2)} MB ` +
        `[${profile.displayLabel}], ${duration}s`,
    );

    // Return the compressed path (MP4) for violation clip cutting
    return {
      mergedLocalPath: videoType === "primary_camera" ? finalPath : null,
      recordingStartedAt,
      tempDir: videoType === "primary_camera" ? tempDir : null,
    };
  } catch (err) {
    console.error(`❌ Finalize error (${videoType}):`, err.message);

    await pool
      .execute(
        `UPDATE interview_videos
         SET upload_status = 'failed', error_message = ?, updated_at = NOW()
         WHERE id = ?`,
        [err.message, videoId],
      )
      .catch(() => {});

    if (videoType === "primary_camera") {
      await pool
        .execute(
          `UPDATE interviews
           SET recording_status = 'failed', updated_at = NOW()
           WHERE id = ? AND user_id = ?`,
          [interviewId, userId],
        )
        .catch(() => {});
    }

    await redisDel(key);
    try {
      await require("fs").promises.rm(tempDir, {
        recursive: true,
        force: true,
      });
    } catch (_) {}
    throw err;
  }
}

/* ── Get Recording Status ────────────────────────────────────────────────── */

const getRecordingStatus = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;
  const userId = req.user.id;
  const videoType = req.query?.videoType || "primary_camera";

  if (!VIDEO_TYPES.includes(videoType))
    throw new APIERR(400, "Invalid videoType");

  const key = redisKey(userId, interviewId, videoType);
  const cached = await redisGet(key);
  if (cached) {
    const meta = JSON.parse(cached);
    return res
      .status(200)
      .json(new APIRES(200, { status: meta.status, videoType }, "OK"));
  }

  const [rows] = await pool.execute(
    `SELECT upload_status, ftp_url, uploaded_chunks, total_chunks
     FROM interview_videos
     WHERE interview_id = ? AND user_id = ? AND video_type = ?`,
    [interviewId, userId, videoType],
  );
  if (!rows[0]) throw new APIERR(404, "Recording not found");

  res.status(200).json(
    new APIRES(
      200,
      {
        status: rows[0].upload_status,
        url: rows[0].ftp_url || null,
        uploadedChunks: rows[0].uploaded_chunks,
        totalChunks: rows[0].total_chunks,
        videoType,
      },
      "OK",
    ),
  );
});

/* ── Get Recording URLs ──────────────────────────────────────────────────── */

const getRecordingUrls = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;
  const userId = req.user.id;

  const [rows] = await pool.execute(
    `SELECT video_type, ftp_url, upload_status, duration, file_size
     FROM interview_videos
     WHERE interview_id = ? AND user_id = ?`,
    [interviewId, userId],
  );

  const map = {};
  rows.forEach((r) => {
    map[r.video_type] = r;
  });

  res.status(200).json(
    new APIRES(
      200,
      {
        primaryCamera: {
          available: map.primary_camera?.upload_status === "completed",
          url: map.primary_camera?.ftp_url ?? null,
          duration: map.primary_camera?.duration ?? null,
        },
        mobileCamera: {
          available: map.secondary_camera?.upload_status === "completed",
          url: map.secondary_camera?.ftp_url ?? null,
          duration: map.secondary_camera?.duration ?? null,
        },
        screenRecording: {
          available: map.screen_recording?.upload_status === "completed",
          url: map.screen_recording?.ftp_url ?? null,
          duration: map.screen_recording?.duration ?? null,
        },
      },
      "OK",
    ),
  );
});

module.exports = {
  startRecording,
  uploadChunk,
  endRecording,
  getRecordingStatus,
  getRecordingUrls,
  getAnalysisResult,
  getViolationClips,
  finalizeRecording,
  runAnswerAnalysisDuringWait,
  cutAndUploadViolationClips,
};
