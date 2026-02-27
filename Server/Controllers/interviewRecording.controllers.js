const { pool } = require("../Config/database.config");
const { uploadFileToFTP } = require("../Upload/uploadOnFTP");
const { asyncHandler, APIERR, APIRES } = require("../Utils/index.utils");
const redis = require("../Config/redis.config");

const RECORDING_TTL = 60 * 60 * 6;
const VIDEO_TYPES = ["primary_camera", "secondary_camera", "screen_recording"];

const redisKey = (userId, interviewId, videoType = "primary_camera") =>
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

const chunkStore = new Map();

function getChunkStore(sessionKey) {
  if (!chunkStore.has(sessionKey)) chunkStore.set(sessionKey, new Map());
  return chunkStore.get(sessionKey);
}

function clearChunkStore(sessionKey) {
  chunkStore.delete(sessionKey);
}

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
    try {
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
    } catch (_) {}
  }

  const meta = {
    status: "recording",
    userId,
    interviewId,
    videoType,
    startedAt: Date.now(),
  };
  await redisSet(key, JSON.stringify(meta), "EX", RECORDING_TTL);

  if (videoType === "primary_camera") {
    await pool.execute(
      `UPDATE interviews SET recording_status = 'recording', updated_at = NOW() WHERE id = ? AND user_id = ?`,
      [interviewId, userId],
    );
  }

  res
    .status(200)
    .json(
      new APIRES(200, { status: "recording", videoType }, "Recording started"),
    );
});

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
    console.warn(
      `⚠️ Auto-creating session for ${videoType} — chunk arrived before start-recording`,
    );
    const meta = {
      status: "recording",
      userId,
      interviewId,
      videoType,
      startedAt: Date.now(),
      autoCreated: true,
    };
    await redisSet(key, JSON.stringify(meta), "EX", RECORDING_TTL);
    cached = JSON.stringify(meta);
  }

  const meta = JSON.parse(cached);
  if (meta.status !== "recording")
    throw new APIERR(400, "Recording not active");

  const sessionKey = `${userId}:${interviewId}:${videoType}`;
  const store = getChunkStore(sessionKey);
  store.set(chunkIndex, Buffer.from(req.file.buffer));

  const buffer = req.file.buffer;
  setImmediate(() => {
    uploadChunkToFTP({
      userId,
      interviewId,
      videoType,
      chunkIndex,
      buffer,
    }).catch((err) =>
      console.error(`❌ FTP chunk ${chunkIndex} (${videoType}):`, err.message),
    );
  });

  res
    .status(200)
    .json(new APIRES(200, { chunkIndex, videoType }, "Chunk received"));
});

async function uploadChunkToFTP({
  userId,
  interviewId,
  videoType,
  chunkIndex,
  buffer,
}) {
  const idx = String(chunkIndex).padStart(6, "0");
  const fileName = `chunk_${idx}.webm`;
  const remotePath = `/public/interview-videos/${userId}/${interviewId}/${videoType}/chunks`;
  await uploadFileToFTP(buffer, fileName, remotePath);
  console.log(`📤 FTP chunk ${chunkIndex} (${videoType}) uploaded`);
}

const endInterview = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;
  const userId = req.user.id;
  const videoType = req.body?.videoType || "primary_camera";

  if (!VIDEO_TYPES.includes(videoType))
    throw new APIERR(400, "Invalid videoType");

  const key = redisKey(userId, interviewId, videoType);
  let meta = null;
  const cached = await redisGet(key);

  if (cached) {
    try {
      meta = JSON.parse(cached);
    } catch (_) {}
  }

  if (!meta) {
    const [rows] = await pool.execute(
      `SELECT recording_status FROM interviews WHERE id = ? AND user_id = ?`,
      [interviewId, userId],
    );
    if (!rows[0]) throw new APIERR(404, "Interview not found");
    meta = { status: "recording", userId, interviewId, videoType };
  } else if (meta.status !== "recording") {
    throw new APIERR(400, "Recording not active");
  }

  await redisSet(
    key,
    JSON.stringify({ ...meta, status: "processing", stoppedAt: Date.now() }),
    "EX",
    RECORDING_TTL,
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
        "Recording stopped, finalizing",
      ),
    );

  setTimeout(() => {
    finalizeRecording({ userId, interviewId, videoType }).catch((err) =>
      console.error(`❌ Finalize failed (${videoType}):`, err.message),
    );
  }, 2000);
});

async function finalizeRecording({ userId, interviewId, videoType }) {
  const sessionKey = `${userId}:${interviewId}:${videoType}`;
  const key = redisKey(userId, interviewId, videoType);

  try {
    const store = getChunkStore(sessionKey);
    const totalChunks = store.size;

    console.log(
      `🎬 Finalizing ${videoType} — ${totalChunks} chunks tracked in memory`,
    );

    const chunkPaths = [];
    for (let i = 0; i < totalChunks; i++) {
      const idx = String(i).padStart(6, "0");
      chunkPaths.push(
        `/public/interview-videos/${userId}/${interviewId}/${videoType}/chunks/chunk_${idx}.webm`,
      );
    }

    const manifest = {
      interviewId,
      userId,
      videoType,
      totalChunks,
      createdAt: new Date().toISOString(),
      chunks: chunkPaths,
    };

    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2));
    const manifestName = `manifest_${Date.now()}.json`;
    const manifestResult = await uploadFileToFTP(
      manifestBuffer,
      manifestName,
      `/public/interview-videos/${userId}/${interviewId}/${videoType}`,
    );

    clearChunkStore(sessionKey);
    await redisDel(key);

    const column =
      videoType === "primary_camera"
        ? "video_url"
        : videoType === "secondary_camera"
          ? "secondary_video_url"
          : "screen_video_url";

    try {
      await pool.execute(
        `UPDATE interviews SET \`${column}\` = ?, updated_at = NOW() WHERE id = ? AND user_id = ?`,
        [manifestResult.url, interviewId, userId],
      );
    } catch (dbErr) {
      console.warn(
        `⚠️ DB column ${column} may not exist — skipping:`,
        dbErr.message,
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

    console.log(
      `✅ ${videoType} finalized — manifest at ${manifestResult.url}`,
    );
  } catch (err) {
    console.error(`❌ Finalize error (${videoType}):`, err.message);
    clearChunkStore(sessionKey);
    await redisDel(key);

    if (videoType === "primary_camera") {
      await pool
        .execute(
          `UPDATE interviews SET recording_status = 'failed', updated_at = NOW() WHERE id = ? AND user_id = ?`,
          [interviewId, userId],
        )
        .catch(() => {});
    }
  }
}

const getRecordingStatus = asyncHandler(async (req, res) => {
  const { interviewId } = req.params;
  const userId = req.user.id;
  const videoType = req.query?.videoType || "primary_camera";

  if (!VIDEO_TYPES.includes(videoType))
    throw new APIERR(400, "Invalid videoType");

  const key = redisKey(userId, interviewId, videoType);
  const cached = await redisGet(key);
  if (cached) {
    try {
      const meta = JSON.parse(cached);
      return res
        .status(200)
        .json(new APIRES(200, { status: meta.status, videoType }, "OK"));
    } catch (_) {}
  }

  const [rows] = await pool.execute(
    `SELECT recording_status, video_url FROM interviews WHERE id = ? AND user_id = ?`,
    [interviewId, userId],
  );
  if (!rows[0]) throw new APIERR(404, "Interview not found");

  res
    .status(200)
    .json(
      new APIRES(
        200,
        { status: rows[0].recording_status, url: rows[0].video_url, videoType },
        "OK",
      ),
    );
});

module.exports = {
  startRecording,
  uploadChunk,
  endInterview,
  getRecordingStatus,
};
