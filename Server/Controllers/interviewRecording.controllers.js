const { pool } = require("../Config/database.config");
const {
  uploadFileToFTP,
  downloadFileFromFTP,
} = require("../Upload/uploadOnFTP");
const { asyncHandler, APIERR, APIRES } = require("../Utils/index.utils");
const redis = require("../Config/redis.config");

const RECORDING_TTL = 60 * 60 * 6;
const VIDEO_TYPES = ["primary_camera", "secondary_camera", "screen_recording"];

const INTERVIEW_COLUMN_MAP = {
  primary_camera: "pri_recording_url",
  secondary_camera: "mob_recording_url",
  screen_recording: "scr_recording_url",
};

const FINALIZE_DELAY_MS = 3_000;
const CHUNK_SETTLE_TIMEOUT_MS = 90_000;
const CHUNK_SETTLE_POLL_MS = 2_000;

/* ── Redis helpers ───────────────────────────────────────────────────────── */

const redisKey = (userId, interviewId, videoType) =>
  `interview:${userId}:${interviewId}:recording:${videoType}`;

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

// ── FIX: Replaced SELECT + INSERT with a single atomic INSERT ... ON DUPLICATE KEY ──
//
// Root cause of ER_DUP_ENTRY:
//   The previous version did SELECT (no row found) → INSERT across three concurrent
//   requests (primary_camera, secondary_camera, screen_recording all start at once).
//   All three found no row and all three tried to INSERT → duplicate key error for
//   the one that lost the race.
//
// Fix:
//   INSERT ... ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
//   This is atomic — only one INSERT wins; the others hit the ON DUPLICATE KEY
//   branch which sets LAST_INSERT_ID to the existing row's id so insertId is
//   always correct for both new and existing rows.
async function ensureVideoRecord(interviewId, userId, videoType) {
  const [result] = await pool.execute(
    `INSERT INTO interview_videos
       (interview_id, user_id, video_type, original_filename, file_size,
        ftp_path, ftp_url, upload_status, upload_progress, total_chunks,
        uploaded_chunks, started_at)
     VALUES (?, ?, ?, ?, 0, '', '', 'pending', 0, 0, 0, NOW())
     ON DUPLICATE KEY UPDATE
       id = LAST_INSERT_ID(id)`,
    [interviewId, userId, videoType, `${videoType}_${interviewId}.webm`],
  );
  return result.insertId;
}

// FIX: No-transaction upsert to avoid deadlocks on concurrent chunk uploads.
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

      const isNewChunk = upsertResult.affectedRows === 1;

      if (isNewChunk) {
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
          `UPDATE interview_videos SET total_chunks = GREATEST(total_chunks, ?), updated_at = NOW() WHERE id = ?`,
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

  if (
    meta.status !== "recording" &&
    meta.status !== "processing" &&
    meta.status !== "completed"
  )
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

  res
    .status(200)
    .json(
      new APIRES(
        200,
        { status: "processing", videoType },
        "Recording stopped, merging chunks",
      ),
    );

  console.log(
    `⏳ Waiting ${FINALIZE_DELAY_MS / 1000}s before merging ${videoType}…`,
  );
  setTimeout(() => {
    finalizeRecording({
      userId,
      interviewId,
      videoType,
      videoId: meta.videoId,
    }).catch((err) =>
      console.error(`❌ Finalize failed (${videoType}):`, err.message),
    );
  }, FINALIZE_DELAY_MS);
});

/* ── Finalize: merge chunks → upload merged video → update DB ────────────── */

async function finalizeRecording({ userId, interviewId, videoType, videoId }) {
  const key = redisKey(userId, interviewId, videoType);
  const fs = require("fs").promises;
  const path = require("path");
  const crypto = require("crypto");
  const ffmpeg = require("fluent-ffmpeg");

  const tempDir = `/tmp/merge_${interviewId}_${videoType}_${Date.now()}`;

  try {
    console.log(`🎬 Finalizing ${videoType} for interview ${interviewId}`);

    // ── Poll until all chunks settled ─────────────────────────────────────
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
        (r) =>
          r.upload_status !== "uploaded" &&
          r.upload_status !== "failed" &&
          r.upload_status !== "merged",
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
        `SELECT chunk_number, temp_ftp_path, chunk_size, upload_status FROM interview_video_chunks WHERE video_id = ?`,
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
        `⚠️ ${failedChunks.length} chunk(s) failed for ${videoType}: ${failedChunks.map((c) => c.chunk_number).join(", ")}`,
      );

    if (uploadedChunks.length === 0) {
      console.warn(
        `⚠️ No uploaded chunks for ${videoType} video ${videoId} — marking failed`,
      );
      await pool.execute(
        `UPDATE interview_videos SET upload_status = 'failed', error_message = ?, updated_at = NOW() WHERE id = ?`,
        [
          failedChunks.length > 0
            ? `All ${failedChunks.length} chunk(s) failed to upload`
            : "No chunks found",
          videoId,
        ],
      );
      await redisDel(key);
      return;
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
        `⚠️ Sequence gap(s) in ${videoType}: ${gaps.map((g) => `${g.after}→${g.before}`).join(", ")} — merging ${uploadedChunks.length} available chunks anyway`,
      );
    } else {
      console.log(
        `✅ Chunk sequence verified — no gaps (${uploadedChunks.length} chunks, ${videoType})`,
      );
    }

    console.log(`📦 Merging ${uploadedChunks.length} chunks for ${videoType}`);
    await fs.mkdir(tempDir, { recursive: true });

    // ── Sequential download with retry ────────────────────────────────────
    const chunkPaths = [];
    for (const chunk of uploadedChunks) {
      const localPath = path.join(
        tempDir,
        `chunk_${String(chunk.chunk_number).padStart(6, "0")}.webm`,
      );

      await withRetry(
        async () => {
          const buffer = await downloadFileFromFTP(chunk.temp_ftp_path);
          if (!buffer || buffer.length === 0)
            throw new Error(`Empty buffer for chunk ${chunk.chunk_number}`);
          await fs.writeFile(localPath, buffer);
        },
        {
          attempts: 4,
          baseDelayMs: 3000,
          label: `DL chunk ${chunk.chunk_number} (${videoType})`,
        },
      );

      const stat = await fs.stat(localPath);
      if (stat.size === 0) {
        console.warn(
          `⚠️ Chunk ${chunk.chunk_number} is 0 bytes on disk — skipping`,
        );
        continue;
      }

      chunkPaths.push(localPath);
      console.log(
        `↓ chunk ${chunk.chunk_number}/${uploadedChunks.length} (${videoType}) — ${stat.size} bytes`,
      );
    }

    if (chunkPaths.length === 0)
      throw new Error("All downloaded chunks were empty — cannot merge");

    // ── FFmpeg concat ─────────────────────────────────────────────────────
    const concatPath = path.join(tempDir, "concat.txt");
    await fs.writeFile(
      concatPath,
      chunkPaths.map((p) => `file '${p}'`).join("\n"),
    );
    const mergedPath = path.join(tempDir, `${videoType}_merged.webm`);

    await new Promise((resolve, reject) => {
      const ffmpegTimeout = setTimeout(
        () =>
          reject(new Error(`FFmpeg timed out after 30 minutes (${videoType})`)),
        30 * 60 * 1000,
      );
      ffmpeg()
        .input(concatPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions(["-c copy"])
        .on("end", () => {
          clearTimeout(ffmpegTimeout);
          console.log(`✂️  FFmpeg done (${videoType})`);
          resolve();
        })
        .on("error", (err) => {
          clearTimeout(ffmpegTimeout);
          reject(err);
        })
        .save(mergedPath);
    });

    // ── Verify output ─────────────────────────────────────────────────────
    const mergedStat = await fs.stat(mergedPath).catch(() => null);
    if (!mergedStat || mergedStat.size === 0)
      throw new Error(`FFmpeg produced an empty merged file for ${videoType}`);

    const mergedBuffer = await fs.readFile(mergedPath);
    const checksum = crypto
      .createHash("sha256")
      .update(mergedBuffer)
      .digest("hex");
    const fileSize = mergedBuffer.length;

    const duration = await new Promise((resolve) => {
      ffmpeg.ffprobe(mergedPath, (err, meta) => {
        resolve(err ? null : Math.round(meta?.format?.duration ?? 0));
      });
    });

    console.log(
      `📊 ${videoType}: ${(fileSize / 1024 / 1024).toFixed(2)} MB, ${duration}s, ${chunkPaths.length}/${uploadedChunks.length} chunks merged`,
    );

    // ── Upload merged file ────────────────────────────────────────────────
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
      `UPDATE interview_video_chunks SET upload_status = 'merged' WHERE video_id = ? AND upload_status = 'uploaded'`,
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

    // Keep Redis key alive as "completed" for 30 minutes so late chunks
    // are attached to the same videoId instead of creating ghost sessions.
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

    await fs.rm(tempDir, { recursive: true, force: true });
    console.log(
      `🎉 ${videoType} finalization complete — ${chunkPaths.length} chunks merged, ${(fileSize / 1024 / 1024).toFixed(2)} MB`,
    );
  } catch (err) {
    console.error(`❌ Finalize error (${videoType}):`, err.message);

    await pool
      .execute(
        `UPDATE interview_videos SET upload_status = 'failed', error_message = ?, updated_at = NOW() WHERE id = ?`,
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
      await fs.rm(tempDir, { recursive: true, force: true });
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
    `SELECT upload_status, ftp_url, uploaded_chunks, total_chunks FROM interview_videos WHERE interview_id = ? AND user_id = ? AND video_type = ?`,
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
    `SELECT video_type, ftp_url, upload_status, duration, file_size FROM interview_videos WHERE interview_id = ? AND user_id = ?`,
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
  finalizeRecording,
};
