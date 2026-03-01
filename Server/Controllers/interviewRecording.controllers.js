const { pool } = require("../Config/database.config");
const {
  uploadFileToFTP,
  downloadFileFromFTP,
} = require("../Upload/uploadOnFTP");
const { asyncHandler, APIERR, APIRES } = require("../Utils/index.utils");
const redis = require("../Config/redis.config");
const { evaluateInterview } = require("../Service/evaluation.service");

// ── Timing constants ──────────────────────────────────────────────────────────
const RECORDING_TTL = 60 * 60 * 6;
const MERGE_DELAY_MS = 5 * 60 * 1000; // 5 min — total window before merge starts
const CHUNK_SETTLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 min — max wait for in-flight chunks
const CHUNK_SETTLE_POLL_MS = 5 * 1000; // 5 sec — polling interval

const VIDEO_TYPES = ["primary_camera", "secondary_camera", "screen_recording"];

const INTERVIEW_COLUMN_MAP = {
  primary_camera: "pri_recording_url",
  secondary_camera: "mob_recording_url",
  screen_recording: "scr_recording_url",
};

/* ── Redis helpers ───────────────────────────────────────────────────────── */

const redisKey = (userId, interviewId, videoType) =>
  `interview:${userId}:${interviewId}:recording:${videoType}`;

// Prevents all three video types from each spawning their own evaluation run
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
   ── Violation Clip Cutting  (runs AFTER primary_camera merge completes) ──────
   ─────────────────────────────────────────────────────────────────────────────

   Flow:
     1. Fetch all violations for the interview that have both start_time and end_time
     2. For each violation, use ffmpeg to cut the clip from the merged .webm
     3. Upload each clip to FTP under /public/interview-videos/{interviewId}/violations/
     4. Store clip_url and clip_ftp_path back in interview_violations row

   Schema requirement — run this migration once:
     ALTER TABLE interview_violations
       ADD COLUMN clip_url      VARCHAR(2048) NULL AFTER details,
       ADD COLUMN clip_ftp_path VARCHAR(2048) NULL AFTER clip_url,
       ADD COLUMN clip_status   ENUM('pending','processing','completed','failed')
                                NOT NULL DEFAULT 'pending' AFTER clip_ftp_path;
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * Ensures the three clip columns exist on interview_violations.
 * Safe to call on every startup — no-ops if columns already exist.
 */
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

// Run schema bootstrap at module load
ensureViolationClipColumns();

/**
 * Cut a clip from a local video file using ffmpeg and return the output path.
 *
 * @param {string}      inputPath  - Path to the full merged .webm
 * @param {string}      outputPath - Destination path for the clip
 * @param {number}      startSec   - Start offset in seconds (float OK)
 * @param {number}      durationSec - Duration in seconds (float OK)
 * @returns {Promise<void>}
 */
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
      5 * 60 * 1000, // 5-minute safety net per clip
    );

    ffmpeg(inputPath)
      .setStartTime(startSec)
      .setDuration(durationSec)
      .outputOptions([
        "-c copy", // no re-encode — fast
        "-avoid_negative_ts make_zero", // fix timestamps at clip boundary
      ])
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

/**
 * Cut violation clips from the merged primary_camera video and upload to FTP.
 * Stores clip_url + clip_ftp_path + clip_status on each interview_violations row.
 *
 * @param {string|number} interviewId
 * @param {string}        mergedVideoLocalPath  - Local filesystem path to the merged .webm
 * @param {Date|string}   recordingStartedAt    - When the recording started (used to compute offsets)
 */
async function cutAndUploadViolationClips(
  interviewId,
  mergedVideoLocalPath,
  recordingStartedAt,
) {
  const fs = require("fs").promises;
  const fsSync = require("fs");
  const path = require("path");

  const startEpoch = new Date(recordingStartedAt).getTime();

  // ── Fetch all closed violations (start_time + end_time both set) ──────────
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

    // ── Compute offsets relative to recording start ───────────────────────
    const violStartEpoch = new Date(viol.start_time).getTime();
    const violEndEpoch = new Date(viol.end_time).getTime();

    // Add 2-second padding on each side so the clip has context
    const PAD_SEC = 2;
    const rawStartSec = (violStartEpoch - startEpoch) / 1000;
    const rawDurationSec = (violEndEpoch - violStartEpoch) / 1000;

    // Clamp: start must be >= 0, duration must be > 0
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

    const clipFilename = `violation_${violType}_${violId}_${Date.now()}.webm`;
    const clipLocalPath = path.join(tempDir, clipFilename);
    const ftpRemotePath = `/public/interview-videos/${interviewId}/violations`;

    // Mark as processing
    await pool
      .execute(
        `UPDATE interview_violations SET clip_status = 'processing' WHERE id = ?`,
        [violId],
      )
      .catch(() => {});

    try {
      // ── Cut the clip ───────────────────────────────────────────────────
      await cutVideoClip(
        mergedVideoLocalPath,
        clipLocalPath,
        clipStartSec,
        clipDurationSec,
      );

      // ── Verify output ──────────────────────────────────────────────────
      const stat = await fs.stat(clipLocalPath).catch(() => null);
      if (!stat || stat.size === 0) {
        throw new Error(`ffmpeg produced empty clip for violation ${violId}`);
      }

      console.log(
        `✅ [CLIP] Cut violation ${violId} (${violType}): ` +
          `t=${clipStartSec.toFixed(2)}s dur=${clipDurationSec.toFixed(2)}s → ${(stat.size / 1024).toFixed(1)} KB`,
      );

      // ── Upload to FTP ──────────────────────────────────────────────────
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

      // ── Persist to DB ──────────────────────────────────────────────────
      await pool.execute(
        `UPDATE interview_violations
         SET clip_url      = ?,
             clip_ftp_path = ?,
             clip_status   = 'completed',
             updated_at    = NOW()
         WHERE id = ?`,
        [ftpResult.url, ftpResult.remotePath, violId],
      );

      // Clean up local clip file immediately to save disk
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

  // Cleanup temp dir
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

  console.log(
    `🎬 [CLIP] Violation clipping complete for interview ${interviewId}: ` +
      `${successCount} succeeded, ${failCount} failed`,
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ── Answer Analysis  (runs DURING the 5-minute merge window) ────────────────
   ─────────────────────────────────────────────────────────────────────────────

   Flow:
     t=0   → endRecording() responds to client
     t=0   → [primary_camera only] runAnswerAnalysisDuringWait() kicks off
               • acquires a Redis NX lock so secondary/screen don't duplicate it
               • calls evaluateInterview() — scores every Q&A with AI
               • persists results to interview_evaluations + question_evaluations
               • writes a summary row to interview_recording_analysis
     t≈2m  → analysis typically finishes (well within the 5-min window)
     t=5m  → finalizeRecording() runs (download chunks → ffmpeg → FTP upload)

   Why a lock?
     All three video types call endRecording() concurrently.
     Without the lock all three would run evaluateInterview() simultaneously.
     Redis SET NX EX guarantees exactly-one execution.
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * Evaluate every answered question for the interview and persist results.
 * Returns a summary object that can be emitted to the socket or polled via REST.
 *
 * @param {string|number} interviewId
 * @param {string|number} userId
 * @returns {Promise<AnalysisSummary|null>}
 */
async function runAnswerAnalysisDuringWait(interviewId, userId) {
  const lockKey = evalLockKey(interviewId);

  // Atomic SET NX — only the first caller proceeds; the rest get null back
  let lockAcquired = false;
  try {
    const result = await redis.set(lockKey, "1", "NX", "EX", 60 * 10); // 10-min TTL
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
    // evaluateInterview() handles: fetching Q&A history → per-question AI scoring
    // → overall summary → persisting to interview_evaluations / question_evaluations
    const evalResult = await evaluateInterview(interviewId);
    const { overallEvaluation, questionEvaluations, totalQuestions } =
      evalResult;

    // ── Write a lightweight summary row for easy REST polling ─────────────
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
        // Table might not exist yet on older deployments — non-fatal
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
        `hire=${summary.hireDecision} (interview ${interviewId})`,
    );

    return summary;
  } catch (err) {
    console.error(
      `❌ [EVAL] Analysis failed for interview ${interviewId}:`,
      err.message,
    );
    await redisDel(lockKey); // release so a retry is possible
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
  const existing = await redisGet(key);
  if (existing) {
    const parsed = JSON.parse(existing);
    if (parsed.status === "recording")
      return res
        .status(200)
        .json(
          new APIRES(
            200,
            { status: "recording", videoType },
            "Already recording",
          ),
        );
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
      `UPDATE interviews SET recording_status = 'recording', updated_at = NOW() WHERE id = ? AND user_id = ?`,
      [interviewId, userId],
    );
  }

  await pool.execute(
    `UPDATE interview_videos SET upload_status = 'uploading', started_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [videoId],
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
      `SELECT id FROM interview_videos WHERE interview_id = ? AND user_id = ? AND video_type = ?`,
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
    `UPDATE interview_videos SET upload_status = 'merging', updated_at = NOW() WHERE id = ?`,
    [meta.videoId],
  );

  if (videoType === "primary_camera") {
    await pool.execute(
      `UPDATE interviews SET recording_status = 'processing', updated_at = NOW() WHERE id = ? AND user_id = ?`,
      [interviewId, userId],
    );
  }

  // ── Respond immediately — client is never blocked ─────────────────────────
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
  //
  //   Timeline for each of the 3 video types running in parallel:
  //
  //   t=0   → endRecording() called for all three types
  //   t=0   → [primary_camera only] answer analysis starts (Redis lock ensures once)
  //   t≈2m  → AI evaluation finishes, scores saved to DB
  //   t=5m  → MERGE_DELAY_MS elapses → finalizeRecording() runs
  //              download chunks → ffmpeg concat → FTP upload → DB update
  //   t=5m+ → [primary_camera only] cutAndUploadViolationClips() runs
  //              cut violation clips from merged video → FTP upload → DB update
  //
  (async () => {
    const pipelineStart = Date.now();
    try {
      // ── STEP 1: Evaluate answers (primary_camera trigger, runs once) ───────
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

      // ── STEP 2: Wait out the remainder of the 5-minute window ─────────────
      const elapsed = Date.now() - pipelineStart;
      const remainingWait = Math.max(0, MERGE_DELAY_MS - elapsed);

      if (remainingWait > 0) {
        console.log(
          `⏳ [PIPELINE] ${videoType} — waiting ${Math.round(remainingWait / 1000)}s before merge…`,
        );
        await new Promise((r) => setTimeout(r, remainingWait));
      }

      // ── STEP 3: Merge chunks → upload → update DB ─────────────────────────
      console.log(
        `🎬 [PIPELINE] Starting merge for ${videoType} (interview ${interviewId})`,
      );
      const finalizeResult = await finalizeRecording({
        userId,
        interviewId,
        videoType,
        videoId: meta.videoId,
      });

      // ── STEP 4: [primary_camera only] Cut violation clips ──────────────────
      //
      //   We only cut clips from the primary_camera feed because:
      //     • It has the best view of the candidate's face
      //     • The violation timestamps (NO_FACE, MULTIPLE_FACES) are derived
      //       from the front-facing camera holistic detection
      //     • Avoids running 3× the same clips from 3 different feeds
      //
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
      }
    } catch (err) {
      console.error(`❌ [PIPELINE] Failed (${videoType}):`, err.message);
    }
  })();
});

/* ── GET /interviews/:interviewId/analysis  (REST polling endpoint) ──────── */

const getAnalysisResult = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;
  const userId = req.user.id;

  // ── Try lightweight summary table first ───────────────────────────────────
  const [summaryRows] = await pool
    .execute(
      `SELECT * FROM interview_recording_analysis
     WHERE interview_id = ? AND user_id = ? LIMIT 1`,
      [interviewId, userId],
    )
    .catch(() => [[]]);

  if (summaryRows?.[0]) {
    // Also attach per-question breakdown
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

  // ── Fall back to canonical evaluation tables ───────────────────────────────
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

/* ── GET /interviews/:interviewId/violations  (REST endpoint) ────────────── */

const getViolationClips = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;
  const userId = req.user.id;

  // ── Auth: interview must exist AND candidate must match ───────────────────
  const [interviewRows] = await pool.execute(
    `SELECT id, user_id
     FROM interviews
     WHERE id = ?
     LIMIT 1`,
    [interviewId],
  );

  if (!interviewRows?.[0]) throw new APIERR(404, "Interview not found");

  // ── Fetch violations ──────────────────────────────────────────────────────
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

/* ── Finalize: merge chunks → upload merged video → update DB ────────────── */

/**
 * @returns {Promise<{ mergedLocalPath: string|null, recordingStartedAt: Date|null }>}
 *   mergedLocalPath is set if merge succeeded (used for clip cutting).
 *   It points to the temp file — callers must NOT delete tempDir before using it.
 *   The function itself cleans up tempDir ONLY on error; on success tempDir cleanup
 *   is deferred to after clip cutting (see endRecording pipeline).
 */
async function finalizeRecording({ userId, interviewId, videoType, videoId }) {
  const key = redisKey(userId, interviewId, videoType);
  const fs = require("fs").promises;
  const fsSync = require("fs");
  const path = require("path");
  const crypto = require("crypto");
  const ffmpeg = require("fluent-ffmpeg");

  const tempDir = `/tmp/merge_${interviewId}_${videoType}_${Date.now()}`;

  // ── Fetch recording started_at for clip offset calculation ───────────────
  let recordingStartedAt = null;
  try {
    const [videoRows] = await pool.execute(
      `SELECT started_at FROM interview_videos WHERE id = ? LIMIT 1`,
      [videoId],
    );
    recordingStartedAt = videoRows?.[0]?.started_at ?? null;
  } catch (_) {}

  try {
    console.log(`🎬 Finalizing ${videoType} for interview ${interviewId}`);

    // ── Poll until all in-flight chunks have settled ───────────────────────
    console.log(`⏳ Waiting for all chunks to settle (${videoType})…`);
    let allChunks = [];
    const pollDeadline = Date.now() + CHUNK_SETTLE_TIMEOUT_MS;

    while (Date.now() < pollDeadline) {
      const [rows] = await pool.execute(
        `SELECT chunk_number, temp_ftp_path, chunk_size, upload_status
         FROM interview_video_chunks WHERE video_id = ? ORDER BY chunk_number ASC`,
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
        `UPDATE interview_videos SET upload_status = 'failed', error_message = ?, updated_at = NOW() WHERE id = ?`,
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

    // ── Gap detection ─────────────────────────────────────────────────────
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

    // ── Binary concatenate all chunk buffers ──────────────────────────────
    const totalBytes = chunkBuffers.reduce((s, b) => s + b.length, 0);
    const rawWebmPath = path.join(tempDir, `${videoType}_raw.webm`);
    const mergedPath = path.join(tempDir, `${videoType}_merged.webm`);

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

    chunkBuffers.length = 0;

    const rawStat = await fs.stat(rawWebmPath);
    if (rawStat.size === 0)
      throw new Error(`Binary concat produced empty file for ${videoType}`);

    console.log(
      `✅ Raw concat done: ${(rawStat.size / 1024 / 1024).toFixed(2)} MB → running FFmpeg re-mux…`,
    );

    // ── FFmpeg re-mux: fix timestamps + write clean container ────────────
    await new Promise((resolve, reject) => {
      const ffmpegTimeout = setTimeout(
        () =>
          reject(new Error(`FFmpeg timed out after 30 minutes (${videoType})`)),
        30 * 60 * 1000,
      );

      ffmpeg(rawWebmPath)
        .outputOptions(["-c copy", "-fflags +genpts"])
        .on("start", (cmd) =>
          console.log(`▶️  FFmpeg cmd (${videoType}): ${cmd}`),
        )
        .on("end", () => {
          clearTimeout(ffmpegTimeout);
          console.log(`✂️  FFmpeg re-mux done (${videoType})`);
          resolve();
        })
        .on("error", (err, stdout, stderr) => {
          clearTimeout(ffmpegTimeout);
          console.error(
            `❌ FFmpeg error (${videoType}):`,
            stderr || err.message,
          );
          reject(err);
        })
        .save(mergedPath);
    });

    // ── Verify output ─────────────────────────────────────────────────────
    const mergedStat = await fs.stat(mergedPath).catch(() => null);
    if (!mergedStat || mergedStat.size === 0)
      throw new Error(`FFmpeg produced empty merged file for ${videoType}`);

    if (mergedStat.size < rawStat.size * 0.8) {
      console.warn(
        `⚠️ Merged file (${mergedStat.size}) is <80% of raw (${rawStat.size}) — ` +
          `possible data loss detected for ${videoType}. Falling back to raw upload.`,
      );
      await fs.copyFile(rawWebmPath, mergedPath);
    }

    const mergedBuffer = await fs.readFile(mergedPath);
    const checksum = crypto
      .createHash("sha256")
      .update(mergedBuffer)
      .digest("hex");
    const fileSize = mergedBuffer.length;

    // ── Probe duration ────────────────────────────────────────────────────
    const duration = await new Promise((resolve) => {
      ffmpeg.ffprobe(mergedPath, (err, meta) => {
        if (err) {
          console.warn(`⚠️ ffprobe failed for ${videoType}: ${err.message}`);
          resolve(null);
        } else {
          const d = Math.round(meta?.format?.duration ?? 0);
          console.log(`⏱️  Probed duration: ${d}s (${videoType})`);
          resolve(d);
        }
      });
    });

    console.log(
      `📊 ${videoType}: ${(fileSize / 1024 / 1024).toFixed(2)} MB final, ` +
        `${duration}s, ${uploadedChunks.length} chunks merged`,
    );

    // ── Upload merged file to FTP ─────────────────────────────────────────
    const mergedFilename = `${videoType}_${interviewId}_${Date.now()}.webm`;
    const ftpResult = await withRetry(
      () =>
        uploadFileToFTP(
          mergedBuffer,
          mergedFilename,
          `/public/interview-videos/${interviewId}`,
        ),
      { attempts: 4, baseDelayMs: 5000, label: `Upload merged ${videoType}` },
    );

    console.log(`✅ Merged ${videoType} uploaded: ${ftpResult.url}`);

    // ── Update DB ─────────────────────────────────────────────────────────
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
          `UPDATE interviews SET \`${col}\` = ?, updated_at = NOW() WHERE id = ? AND user_id = ?`,
          [ftpResult.url, interviewId, userId],
        )
        .catch((err) =>
          console.warn(`⚠️ interviews.${col} update failed:`, err.message),
        );
    }

    if (videoType === "primary_camera") {
      await pool
        .execute(
          `UPDATE interviews SET recording_status = 'completed', updated_at = NOW() WHERE id = ? AND user_id = ?`,
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

    // ── Defer temp dir cleanup to after clip cutting ───────────────────────
    // For primary_camera we return the mergedPath so violation clips can be
    // cut from the local file (avoiding a re-download from FTP).
    // The caller (endRecording pipeline) is responsible for cleaning up tempDir
    // after cutAndUploadViolationClips() finishes.
    // For all other types, clean up now.
    if (videoType !== "primary_camera") {
      await fs.rm(tempDir, { recursive: true, force: true });
    } else {
      console.log(`📂 [FINALIZE] Keeping tempDir for clip cutting: ${tempDir}`);
    }

    console.log(
      `🎉 ${videoType} finalization complete — ` +
        `${uploadedChunks.length} chunks → ${(fileSize / 1024 / 1024).toFixed(2)} MB, ${duration}s`,
    );

    return {
      mergedLocalPath: videoType === "primary_camera" ? mergedPath : null,
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
          `UPDATE interviews SET recording_status = 'failed', updated_at = NOW() WHERE id = ? AND user_id = ?`,
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
    } catch {}
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
     FROM interview_videos WHERE interview_id = ? AND user_id = ? AND video_type = ?`,
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
     FROM interview_videos WHERE interview_id = ? AND user_id = ?`,
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
  getViolationClips, // ← new REST endpoint
  finalizeRecording,
  runAnswerAnalysisDuringWait,
  cutAndUploadViolationClips, // ← exported for direct use / testing
};
