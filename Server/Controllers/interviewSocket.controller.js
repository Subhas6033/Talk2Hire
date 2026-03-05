const { Server } = require("socket.io");
const { Interview } = require("../Models/interview.models.js");
const { generateNextQuestionWithAI } = require("../Service/ai.service.js");
const { createTTSStream } = require("../Service/tts.service.js");
const { createSTTSession } = require("../Service/stt.service.js");
const {
  mergeInterviewMedia,
} = require("../Service/globalVideoMerger.service.js");
const {
  runAnswerAnalysisDuringWait,
} = require("./interviewRecording.controllers.js");
const Job = require("../Admin/models/job.models.js");
const { pool } = require("../Config/database.config.js");

// Constants
const FACE_THROTTLE = 1000;
const FACE_WINDOW = 3000;
const MAX_FACE_WARN = 5;
const NO_TRANSCRIPT_TIMEOUT_MS = 10_000;
// FIX: reduced from 1000 → 400 ms.
// The STT pre-warm (8 silence chunks × 10ms + network RTT ≈ 180ms) finishes
// well within 400ms. The old 1-second gate added ~600ms of unnecessary silence
// to the start of every listening window.
const STT_GATE_DELAY_MS = 400;
const PLAYBACK_DONE_TIMEOUT_MS = 10_000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const MAX_QUEUE_SIZE = 500;

// Cache management
const ttsInstanceCache = new Map();
const sttConnectionCache = new Map();
const violationBuffer = new Map();

function getTTSInstance(id) {
  if (!ttsInstanceCache.has(id)) {
    ttsInstanceCache.set(id, createTTSStream());
  }
  return ttsInstanceCache.get(id);
}

function cleanupStaleConnections() {
  const now = Date.now();
  for (const [id, cached] of sttConnectionCache.entries()) {
    if (now - cached.createdAt > 30 * 60 * 1000) {
      try {
        cached.conn.finish();
      } catch (_) {}
      sttConnectionCache.delete(id);
    }
  }
}
setInterval(cleanupStaleConnections, 5 * 60 * 1000);

/* ── Violations schema bootstrap ─────────────────────────────────────────── */

async function ensureViolationsSchema() {
  try {
    const [cols] = await pool.execute(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'interview_violations'
      ORDER BY ORDINAL_POSITION
    `);
    const colNames = cols.map((c) => c.COLUMN_NAME);

    if (colNames.length === 0) {
      await pool.execute(`
        CREATE TABLE interview_violations (
          id               BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
          interview_id     BIGINT UNSIGNED  NOT NULL,
          user_id          BIGINT UNSIGNED  NULL,
          violation_type   VARCHAR(50)      NOT NULL,
          start_time       DATETIME(3)      NOT NULL,
          end_time         DATETIME(3)      NULL,
          duration_seconds DECIMAL(10,3)
            GENERATED ALWAYS AS (
              CASE WHEN end_time IS NOT NULL
                   THEN TIMESTAMPDIFF(MICROSECOND, start_time, end_time) / 1000000.0
                   ELSE NULL END
            ) STORED,
          warning_count    TINYINT UNSIGNED NOT NULL DEFAULT 1,
          resolved         TINYINT(1)       NOT NULL DEFAULT 0,
          details          JSON             NULL,
          created_at       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at       DATETIME         NULL ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_interview  (interview_id),
          INDEX idx_user       (user_id),
          INDEX idx_type       (violation_type),
          INDEX idx_start_time (start_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("✅ interview_violations table created (fresh)");
      return;
    }

    if (colNames.includes("start_time")) {
      console.log("✅ interview_violations schema is up-to-date");
      return;
    }

    console.log("⚙️  Upgrading interview_violations schema...");
    const toAdd = [
      {
        col: "user_id",
        sql: "ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER interview_id",
      },
      {
        col: "start_time",
        sql: "ADD COLUMN start_time DATETIME(3) NULL AFTER violation_type",
      },
      {
        col: "end_time",
        sql: "ADD COLUMN end_time DATETIME(3) NULL AFTER start_time",
      },
      {
        col: "warning_count",
        sql: "ADD COLUMN warning_count TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER end_time",
      },
      {
        col: "resolved",
        sql: "ADD COLUMN resolved TINYINT(1) NOT NULL DEFAULT 0 AFTER warning_count",
      },
      {
        col: "updated_at",
        sql: "ADD COLUMN updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP",
      },
    ];
    for (const { col, sql } of toAdd) {
      if (!colNames.includes(col)) {
        await pool.execute(`ALTER TABLE interview_violations ${sql}`);
        console.log(`  ✅ Added column: ${col}`);
      }
    }
    if (colNames.includes("occurred_at")) {
      await pool.execute(
        `UPDATE interview_violations SET start_time = occurred_at WHERE start_time IS NULL`,
      );
      console.log("  ✅ Back-filled start_time from occurred_at");
    }
    await pool
      .execute(
        `ALTER TABLE interview_violations MODIFY COLUMN start_time DATETIME(3) NOT NULL`,
      )
      .catch(() => {});
    console.log("✅ interview_violations schema upgrade complete");
  } catch (err) {
    console.error("❌ ensureViolationsSchema FAILED:", err.message);
  }
}

ensureViolationsSchema();

/* ── Violation DB helpers with buffering ─────────────────────────────────── */

async function dbOpenViolation({
  interviewId,
  userId,
  violationType,
  details = {},
  startTime,
}) {
  try {
    const bufferKey = `${interviewId}:${violationType}`;
    if (violationBuffer.has(bufferKey)) {
      return violationBuffer.get(bufferKey);
    }

    const [result] = await pool.execute(
      `INSERT INTO interview_violations
         (interview_id, user_id, violation_type, details, start_time, warning_count, resolved)
       VALUES (?, ?, ?, ?, ?, 1, 0)`,
      [
        interviewId,
        userId,
        violationType,
        JSON.stringify(details),
        new Date(startTime),
      ],
    );

    const violationId = result.insertId;
    violationBuffer.set(bufferKey, violationId);

    setTimeout(() => {
      violationBuffer.delete(bufferKey);
    }, 5000);

    console.log(
      `🚨 [VIOLATION OPENED] type=${violationType} interviewId=${interviewId} userId=${userId} dbId=${violationId}`,
    );
    return violationId;
  } catch (err) {
    console.error(
      `❌ [VIOLATION DB] openViolation FAILED (${violationType}):`,
      err.message,
    );
    return null;
  }
}

async function dbCloseViolation({ violationId, endTime }) {
  if (!violationId) return;
  try {
    await pool.execute(
      `UPDATE interview_violations SET end_time = ?, resolved = 1, updated_at = NOW() WHERE id = ?`,
      [new Date(endTime), violationId],
    );
    console.log(`✅ [VIOLATION CLOSED] dbId=${violationId}`);
  } catch (err) {
    console.error(
      `❌ [VIOLATION DB] closeViolation FAILED (dbId=${violationId}):`,
      err.message,
    );
  }
}

async function dbIncrementWarning({ violationId, warningCount }) {
  if (!violationId) return;
  try {
    await pool.execute(
      `UPDATE interview_violations SET warning_count = ?, updated_at = NOW() WHERE id = ?`,
      [warningCount, violationId],
    );
  } catch (err) {
    console.error(`❌ [VIOLATION DB] incrementWarning FAILED:`, err.message);
  }
}

async function dbSavePointViolation({
  interviewId,
  userId,
  violationType,
  details = {},
  timestamp,
}) {
  try {
    const ts = new Date(timestamp);
    const closeTs = new Date(timestamp + 100);
    const [result] = await pool.execute(
      `INSERT INTO interview_violations
         (interview_id, user_id, violation_type, details, start_time, end_time, warning_count, resolved)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
      [
        interviewId,
        userId,
        violationType,
        JSON.stringify(details),
        ts,
        closeTs,
      ],
    );
    console.log(
      `🚨 [VIOLATION SAVED] type=${violationType} interviewId=${interviewId} dbId=${result.insertId}`,
    );
    return result.insertId;
  } catch (err) {
    console.error(`❌ [VIOLATION DB] savePointViolation FAILED:`, err.message);
    return null;
  }
}

/* ── TTS helpers with improved error handling ────────────────────────────── */

async function streamTTSToClient(socket, text, interviewId, session) {
  return new Promise((resolve, reject) => {
    const tts = getTTSInstance(interviewId);
    let chunkCount = 0;
    let settled = false;
    let preWarmStarted = false;
    let retryCount = 0;

    const settle = (err) => {
      if (settled) return;
      settled = true;
      err ? reject(err) : resolve();
    };

    const hardTimeout = setTimeout(() => {
      if (!settled) {
        console.warn(
          `⚠️ TTS timeout after ${chunkCount} chunks - forcing completion`,
        );
        settle();
      }
    }, 30_000);

    const sttConn = sttConnectionCache.get(interviewId)?.conn;
    sttConn?.enterStandby?.();

    const speakWithRetry = () => {
      tts
        .speakStream(text, (chunk) => {
          if (settled) return;

          if (chunk === null) {
            clearTimeout(hardTimeout);
            console.log(`✅ TTS complete: ${chunkCount} chunks`);

            const conn = sttConnectionCache.get(interviewId)?.conn;
            if (conn?.isConnected?.() && !preWarmStarted) {
              preWarmStarted = true;
              session._preWarmStartedAt = Date.now();
              conn.activate?.();
              console.log(
                `🔥 STT pre-warm started - gate opens in ${STT_GATE_DELAY_MS}ms`,
              );
            }

            try {
              socket.emit("tts_end");
            } catch (_) {}
            settle();
            return;
          }

          chunkCount++;
          if (!socket.connected) {
            settle(new Error("Socket disconnected during TTS"));
            return;
          }

          try {
            const buf = Buffer.isBuffer(chunk)
              ? chunk
              : typeof chunk === "string"
                ? Buffer.from(chunk, "base64")
                : Buffer.from(chunk);
            socket.emit("tts_audio", { audio: buf.toString("base64") });
          } catch (e) {
            console.error("❌ TTS chunk send error:", e.message);
          }
        })
        .catch((err) => {
          if (retryCount < MAX_RETRY_ATTEMPTS && !settled) {
            retryCount++;
            console.log(
              `🔄 TTS retry ${retryCount}/${MAX_RETRY_ATTEMPTS} after error:`,
              err.message,
            );
            setTimeout(speakWithRetry, RETRY_DELAY_MS * retryCount);
          } else {
            clearTimeout(hardTimeout);
            try {
              socket.emit("tts_end");
            } catch (_) {}
            settle(err);
          }
        });
    };

    speakWithRetry();
  });
}

function cleanupSession(id) {
  ttsInstanceCache.delete(id);
  const cached = sttConnectionCache.get(id);
  if (cached) {
    try {
      cached.conn.finish();
    } catch (_) {}
    sttConnectionCache.delete(id);
  }
}

/* ── Settings socket (mobile / secondary camera) with improved handling ─── */

async function handleSettingsSocket(socket, interviewId, userId, io, sessions) {
  const session = getOrCreate(sessions, interviewId);
  session.mobileSocketId = socket.id;
  socket.join(`interview_${interviewId}`);

  if (session.secondaryCameraConnected) {
    socket.emit("secondary_camera_ready", {
      connected: true,
      timestamp: Date.now(),
    });
  }

  socket.on("request_secondary_camera_status", () => {
    io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
      connected: session.secondaryCameraConnected,
      metadata: session.secondaryCameraMetadata ?? null,
    });
  });

  socket.on("secondary_camera_connected", (data) => {
    session.secondaryCameraConnected = true;
    session.secondaryCameraMetadata = {
      connectedAt: new Date(data.timestamp),
      angle: data.angle ?? null,
      streamType: data.streamType ?? "webrtc",
    };

    io.to(`interview_${interviewId}`).emit("secondary_camera_ready", {
      connected: true,
      timestamp: Date.now(),
    });

    io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
      connected: true,
      metadata: session.secondaryCameraMetadata,
    });
  });

  socket.on("mobile_webrtc_offer", ({ offer, identity }) => {
    if (session.desktopSocketId) {
      io.to(session.desktopSocketId).emit("mobile_webrtc_offer_relay", {
        offer,
        identity,
      });
    } else {
      session.pendingMobileOffer = { offer, identity, timestamp: Date.now() };
    }
  });

  socket.on("mobile_webrtc_ice_candidate", ({ candidate }) => {
    if (session.desktopSocketId) {
      io.to(session.desktopSocketId).emit("mobile_webrtc_ice_from_mobile", {
        candidate,
      });
    } else {
      if (session.pendingMobileIceCandidates.length < MAX_QUEUE_SIZE) {
        session.pendingMobileIceCandidates.push(candidate);
      }
    }
  });

  socket.on("mobile_camera_frame", (data, ack) => {
    session.lastMobileFrame = {
      frame: data.frame,
      timestamp: data.timestamp ?? Date.now(),
      frameNum: data.frameNum,
    };

    if (session.desktopSocketId && !session.webrtcEstablished) {
      socket.to(`interview_${interviewId}`).emit("mobile_camera_frame", {
        frame: data.frame,
        timestamp: data.timestamp ?? Date.now(),
        frameNum: data.frameNum,
      });
    }

    if (typeof ack === "function") ack();
  });

  socket.on("disconnect", () => {
    if (session.mobileSocketId === socket.id) {
      console.log(`📱 Mobile disconnected: ${socket.id}`);
      session.mobileSocketId = null;
      session.webrtcEstablished = false;
      session.pendingMobileIceCandidates = [];

      io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
        connected: false,
        metadata: null,
      });
    }
  });
}

/* ── Interview socket (desktop / primary) with improved handling ────────── */

async function handleInterviewSocket(
  socket,
  interviewId,
  userId,
  io,
  sessions,
) {
  const session = getOrCreate(sessions, interviewId);
  session.desktopSocketId = socket.id;
  socket.join(`interview_${interviewId}`);
  console.log(`🖥️ Desktop socket: ${socket.id}`);

  if (session.pendingMobileOffer) {
    const { offer, identity, timestamp } = session.pendingMobileOffer;
    const age = Date.now() - (timestamp || Date.now());

    if (age < 30000) {
      socket.emit("mobile_webrtc_offer_relay", { offer, identity });

      if (session.pendingMobileIceCandidates?.length) {
        session.pendingMobileIceCandidates.forEach((candidate) => {
          socket.emit("mobile_webrtc_ice_from_mobile", { candidate });
        });
      }
    }

    session.pendingMobileOffer = null;
    session.pendingMobileIceCandidates = [];
  } else if (session.mobileSocketId) {
    io.to(session.mobileSocketId).emit("secondary_camera_ready", {
      connected: true,
      timestamp: Date.now(),
    });
  }

  if (session.secondaryCameraConnected) {
    socket.emit("secondary_camera_ready", {
      connected: true,
      timestamp: Date.now(),
    });
    socket.emit("secondary_camera_status", {
      connected: true,
      metadata: session.secondaryCameraMetadata,
    });
  }

  socket.on("mobile_webrtc_answer", ({ answer, identity }) => {
    session.webrtcEstablished = true;
    console.log(`✅ Mobile WebRTC established for interview ${interviewId}`);

    if (session.mobileSocketId) {
      io.to(session.mobileSocketId).emit("mobile_webrtc_answer_from_server", {
        answer,
        identity,
      });
    }
  });

  socket.on("mobile_webrtc_ice_candidate_desktop", ({ candidate }) => {
    if (session.mobileSocketId) {
      io.to(session.mobileSocketId).emit("mobile_webrtc_ice_from_desktop", {
        candidate,
      });
    }
  });

  let firstQuestion = null;
  let jobDetails = null;
  try {
    const [interviewSession, q] = await Promise.all([
      Interview.getSessionById(interviewId),
      Interview.getQuestionByOrder(interviewId, 1),
    ]);
    firstQuestion = q;
    const jobId = interviewSession?.job_id ?? interviewSession?.jobId ?? null;
    if (jobId) {
      jobDetails = await Job.findById(jobId).catch(() => null);
    }
  } catch (err) {
    console.error("❌ DB setup failed:", err.message);
    socket.emit("error", { message: "Failed to initialize" });
    return socket.disconnect();
  }

  if (!firstQuestion) {
    const q =
      "Tell me about yourself, your background, and what brings you here today.";
    await Interview.saveQuestion({
      interviewId,
      question: q,
      questionOrder: 1,
      technology: null,
      difficulty: "easy",
    });
    firstQuestion = await Interview.getQuestionByOrder(interviewId, 1);
  }

  if (!firstQuestion) {
    socket.emit("error", { message: "Failed to load questions" });
    return socket.disconnect();
  }

  let currentOrder = session.currentOrder ?? 1;
  let isProcessing = false;
  let isInterviewEnded = false;
  let isListeningActive = false;
  let awaitingRepeat = false;
  let currentQText = session.currentQText || firstQuestion.question;

  let lastHolisticTime = 0;
  let faceWarnCount = 0;
  let faceFirstMissing = null;
  let faceViolTimeout = null;
  let openFaceViolId = null;

  // awaitingPlaybackDone REMOVED — STT is enabled as soon as TTS stream ends on the
  // server. A STT_GATE_DELAY_MS buffer covers the time the client needs to play
  // already-buffered audio before the mic opens. This removes a full RTT + playback
  // duration from every turn.
  let clientReadyHandled = false;
  let noTranscriptTimer = null;

  const clearNoTranscriptTimer = () => {
    if (noTranscriptTimer) {
      clearTimeout(noTranscriptTimer);
      noTranscriptTimer = null;
    }
  };

  const startNoTranscriptTimer = () => {
    clearNoTranscriptTimer();
    noTranscriptTimer = setTimeout(() => {
      if (!isListeningActive || isInterviewEnded || isProcessing) return;
      console.warn(
        `⏱️ No transcript in ${NO_TRANSCRIPT_TIMEOUT_MS / 1000}s - idle fallback`,
      );
      handleIdle().catch(console.error);
    }, NO_TRANSCRIPT_TIMEOUT_MS);
  };

  getTTSInstance(interviewId);
  socket.emit("server_ready", {
    setupMode: session.isSetupMode,
    message: "Server ready",
  });

  function ensureSTTConnection() {
    const cached = sttConnectionCache.get(interviewId);
    if (cached?.conn?.isConnected?.()) {
      cached.conn.resetTranscriptState?.();
      return Promise.resolve(cached.conn);
    }

    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          reject(new Error("Deepgram connect timeout"));
        }
      }, 8000);

      const conn = createSTTSession().startLiveTranscription({
        onTranscript: async (text) => {
          if (!text?.trim() || !isListeningActive || isProcessing) return;
          clearNoTranscriptTimer();
          isListeningActive = false;
          conn.pauseIdleDetection?.();
          socket.emit("transcript_received", { text });

          try {
            if (awaitingRepeat) {
              await handleRepeat(text);
            } else {
              await processTranscript(text);
            }
          } catch (err) {
            console.error("❌ Transcript processing error:", err);
          }
        },
        onInterim: (t) => {
          if (t?.trim()) {
            socket.emit("interim_transcript", { text: t });
          }
        },
        onError: (e) => {
          console.error("❌ Deepgram error:", e);
          if (!done) {
            done = true;
            clearTimeout(timer);
            reject(e);
          }
        },
        onClose: () => {
          if (sttConnectionCache.get(interviewId)?.conn === conn) {
            sttConnectionCache.delete(interviewId);
          }
        },
        onIdle: async () => {
          if (isListeningActive && !isProcessing && !isInterviewEnded) {
            await handleIdle();
          }
        },
      });

      conn
        .waitForReady?.(8000)
        .then(() => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            sttConnectionCache.set(interviewId, {
              conn,
              socketId: socket.id,
              createdAt: Date.now(),
            });
            resolve(conn);
          }
        })
        .catch((e) => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            reject(e);
          }
        });
    });
  }

  const enableListening = async () => {
    if (isInterviewEnded || !session.interviewStarted || isListeningActive) {
      return;
    }

    try {
      let conn;
      const cached = sttConnectionCache.get(interviewId);

      if (cached?.conn?.isConnected?.()) {
        conn = cached.conn;
        console.log("✅ Using existing STT connection");
      } else {
        console.log("🔄 Creating new STT connection");
        conn = await ensureSTTConnection();
      }

      if (!conn || !conn.isConnected?.()) {
        throw new Error("STT connection not ready");
      }

      conn.resetTranscriptState?.();
      isListeningActive = true;
      isProcessing = false;

      const preWarmElapsed = session._preWarmStartedAt
        ? Date.now() - session._preWarmStartedAt
        : 0;
      const remaining = Math.max(0, STT_GATE_DELAY_MS - preWarmElapsed);
      session._preWarmStartedAt = null;

      if (remaining > 0) {
        console.log(`⏱️ STT gate delay: ${remaining}ms`);

        if (preWarmElapsed === 0) {
          conn.activate?.();
        }

        // Only emit listening_enabled here — idle detection starts on playback_done
        // so the 8-second idle timer doesn't start burning while audio is still playing.
        setTimeout(() => {
          if (!isListeningActive || isInterviewEnded) return;
          socket.emit("listening_enabled");
        }, remaining);
      } else {
        socket.emit("listening_enabled");
        // If gate was already open (preWarmElapsed >= STT_GATE_DELAY_MS), start
        // idle detection now since playback_done likely already arrived or won't.
        conn.resumeIdleDetection?.();
        startNoTranscriptTimer();
      }
    } catch (err) {
      console.error(`❌ enableListening failed:`, err);
      socket.emit("error", {
        message: "Microphone connection failed. Please refresh.",
      });
      isProcessing = false;

      if (sttConnectionCache.has(interviewId)) {
        try {
          sttConnectionCache.get(interviewId).conn.finish();
        } catch (_) {}
        sttConnectionCache.delete(interviewId);
      }
    }
  };

  async function _streamTTS(text) {
    return streamTTSToClient(socket, text, interviewId, session);
  }

  async function transitionToNextQuestion(text) {
    try {
      clearNoTranscriptTimer();
      sttConnectionCache.get(interviewId)?.conn?.pauseIdleDetection?.();
      isListeningActive = false;

      await _streamTTS(text);

      // STT pre-warm was started inside streamTTSToClient when the last chunk sent.
      // enableListening accounts for the remaining gate delay so we call it immediately.
      enableListening().catch(console.error);
    } catch (err) {
      console.error(`❌ transitionToNextQuestion failed: ${err.message}`);
      socket.emit("error", { message: "Speech synthesis failed" });
      isProcessing = false;
    }
  }

  async function handleIdle() {
    clearNoTranscriptTimer();
    sttConnectionCache.get(interviewId)?.conn?.pauseIdleDetection?.();
    isListeningActive = false;
    socket.emit("listening_disabled");

    if (awaitingRepeat) {
      awaitingRepeat = false;
      await moveNext();
    } else {
      awaitingRepeat = true;
      const prompt =
        "Sorry, I didn't catch that. Would you like me to repeat the question?";
      socket.emit("idle_prompt", { text: prompt });
      await transitionToNextQuestion(prompt);
    }
  }

  async function moveNext() {
    if (isProcessing) return;
    isProcessing = true;

    try {
      if (currentOrder >= 10) {
        await endInterview();
        return;
      }

      const nextOrder = currentOrder + 1;
      const text = await generateNextQuestionWithAI({
        answer: "No response",
        questionOrder: nextOrder,
        previousQuestion: currentQText,
        jobDetails,
      });

      await Interview.saveQuestion({
        interviewId,
        question: text,
        questionOrder: nextOrder,
        technology: null,
        difficulty: null,
      });

      currentOrder = nextOrder;
      currentQText = text;
      session.currentOrder = currentOrder;
      session.currentQText = currentQText;
      awaitingRepeat = false;

      socket.emit("next_question", { question: text });
      await transitionToNextQuestion(text);
    } catch (err) {
      console.error("❌ moveNext:", err);
      isProcessing = false;
    }
  }

  async function processTranscript(text) {
    if (isInterviewEnded || isProcessing) return;

    isProcessing = true;
    const processingTimeout = setTimeout(() => {
      console.error("⚠️ processTranscript timeout - resetting");
      isProcessing = false;
    }, 30_000);

    isListeningActive = false;
    socket.emit("listening_disabled");

    try {
      const q = await Interview.getQuestionByOrder(interviewId, currentOrder);
      if (!q) {
        socket.emit("error", { message: "Question not found" });
        return;
      }

      if (currentOrder >= 10) {
        await Interview.saveAnswer({
          interviewId,
          questionId: q.id,
          answer: text,
        });
        await endInterview();
        return;
      }

      const nextOrder = currentOrder + 1;
      const [, nextQ] = await Promise.all([
        Interview.saveAnswer({ interviewId, questionId: q.id, answer: text }),
        (async () => {
          let nq = await Interview.getQuestionByOrder(interviewId, nextOrder);
          if (!nq) {
            const gen = await generateNextQuestionWithAI({
              answer: text,
              questionOrder: nextOrder,
              previousQuestion: q.question,
              jobDetails,
            });
            await Interview.saveQuestion({
              interviewId,
              question: gen,
              questionOrder: nextOrder,
              technology: null,
              difficulty: null,
            });
            nq = await Interview.getQuestionByOrder(interviewId, nextOrder);
          }
          return nq;
        })(),
      ]);

      if (!nextQ) {
        socket.emit("error", { message: "Failed to generate next question" });
        return;
      }

      currentOrder = nextOrder;
      currentQText = nextQ.question;
      session.currentOrder = currentOrder;
      session.currentQText = currentQText;
      awaitingRepeat = false;

      socket.emit("next_question", { question: nextQ.question });

      let attempts = 0;
      let ok = false;
      while (attempts < MAX_RETRY_ATTEMPTS && !ok) {
        attempts++;
        try {
          await transitionToNextQuestion(nextQ.question);
          ok = true;
        } catch (e) {
          if (attempts < MAX_RETRY_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempts));
          } else {
            throw e;
          }
        }
      }
    } catch (err) {
      console.error(`❌ processTranscript failed: ${err.message}`);
      socket.emit("error", {
        message: `Failed to process Q${currentOrder}: ${err.message}`,
      });
    } finally {
      clearTimeout(processingTimeout);
      isProcessing = false;
    }
  }

  async function handleRepeat(text) {
    clearNoTranscriptTimer();
    const lower = text.toLowerCase();
    const yes = ["yes", "yeah", "sure", "repeat", "again", "please"].some((w) =>
      lower.includes(w),
    );
    const no = ["no", "nope", "next", "skip", "move", "continue"].some((w) =>
      lower.includes(w),
    );

    awaitingRepeat = false;

    if (yes) {
      socket.emit("question", { question: currentQText });
      await transitionToNextQuestion(currentQText);
    } else if (no) {
      await moveNext();
    } else {
      const c = "Just say yes to repeat, or no to move on.";
      socket.emit("idle_prompt", { text: c });
      await transitionToNextQuestion(c);
    }
  }

  async function endInterview() {
    if (isInterviewEnded) return;

    isInterviewEnded = true;
    isListeningActive = false;

    clearNoTranscriptTimer();

    if (faceViolTimeout) {
      clearTimeout(faceViolTimeout);
      faceViolTimeout = null;
    }

    socket.emit("listening_disabled");
    socket.emit("interview_complete", {
      message: "Interview complete!",
      totalQuestions: currentOrder,
    });

    const cached = sttConnectionCache.get(interviewId);
    if (cached) {
      try {
        cached.conn.finish();
      } catch (_) {}
      sttConnectionCache.delete(interviewId);
    }

    if (openFaceViolId) {
      await dbCloseViolation({
        violationId: openFaceViolId,
        endTime: Date.now(),
      });
      openFaceViolId = null;
    }

    session.interviewStarted = false;
    session.currentOrder = 1;
    session.currentQText = "";

    socket.emit("evaluation_started", {});

    (async () => {
      try {
        console.log(`🧠 Running answer analysis for interview ${interviewId}`);
        const analysisResult = await runAnswerAnalysisDuringWait(
          interviewId,
          userId,
        );

        if (analysisResult) {
          io.to(`interview_${interviewId}`).emit("analysis_complete", {
            overallScore: analysisResult.overallScore,
            hireDecision: analysisResult.hireDecision,
            experienceLevel: analysisResult.experienceLevel,
            totalQuestions: analysisResult.totalQuestions,
            averages: analysisResult.averages,
            questionBreakdown: analysisResult.questionBreakdown,
            strengths: analysisResult.strengths,
            weaknesses: analysisResult.weaknesses,
            summary: analysisResult.summary,
          });
        }

        const evalRows = await pool
          .execute(
            `SELECT overall_score, hire_decision, experience_level
           FROM interview_evaluations WHERE interview_id = ? LIMIT 1`,
            [interviewId],
          )
          .catch(() => [[]]);

        if (evalRows[0]?.[0]) {
          socket.emit("evaluation_complete", {
            results: {
              overallScore: evalRows[0][0].overall_score,
              hireDecision: evalRows[0][0].hire_decision,
              experienceLevel: evalRows[0][0].experience_level,
            },
          });
        }

        mergeInterviewMedia(interviewId, {
          layout: "picture-in-picture",
          deleteChunksAfter: true,
        })
          .then((mr) =>
            socket.emit("media_merge_complete", {
              finalVideoUrl: mr.finalVideoUrl,
            }),
          )
          .catch((e) => socket.emit("media_merge_error", { error: e.message }));

        cleanupSession(interviewId);
      } catch (err) {
        console.error(
          "❌ endInterview background pipeline failed:",
          err.message,
        );
        socket.emit("evaluation_error", { message: "Evaluation failed." });
      }
    })();

    isProcessing = false;
  }

  socket.on("setup_mode", () => {
    session.isSetupMode = true;
    session.interviewStarted = false;
    socket.emit("server_ready", { setupMode: true });
  });

  socket.on("request_secondary_camera_status", () => {
    io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
      connected: session.secondaryCameraConnected,
      metadata: session.secondaryCameraMetadata ?? null,
    });
  });

  socket.on("client_ready", async () => {
    if (clientReadyHandled) return;
    clientReadyHandled = true;

    const isGenuineReconnect =
      session.interviewStarted && (session.currentOrder ?? 1) > 1;

    if (isGenuineReconnect) {
      console.log(`🔄 Reconnect - resuming Q${currentOrder}`);
      isProcessing = true;
      isListeningActive = false;

      try {
        socket.emit("question", { question: currentQText });
        await _streamTTS(currentQText);
        enableListening().catch(console.error);
      } catch (err) {
        console.error("❌ reconnect resume:", err);
        isProcessing = false;
      }
      return;
    }

    if (session.interviewStarted) {
      ttsInstanceCache.delete(interviewId);
      ttsInstanceCache.set(interviewId, createTTSStream());
      session.currentOrder = 1;
      session.currentQText = "";
      currentOrder = 1;
      currentQText = firstQuestion.question;
    }

    session.isSetupMode = false;
    session.interviewStarted = true;
    isProcessing = true;
    currentQText = firstQuestion.question;
    session.currentQText = currentQText;
    session.currentOrder = currentOrder;

    ensureSTTConnection().catch((e) =>
      console.warn("⚠️ STT pre-warm failed:", e.message),
    );

    try {
      socket.emit("question", { question: firstQuestion.question });
      await _streamTTS(firstQuestion.question);
      enableListening().catch(console.error);
    } catch (err) {
      console.error("❌ client_ready:", err);
      socket.emit("error", { message: "Failed to start" });
      isProcessing = false;
      session.interviewStarted = false;
    }
  });

  // playback_done: client signals that audio has finished playing.
  // We use this as the true "user is ready to speak" signal to start idle
  // detection and the no-transcript safety timer. Previously this was a no-op
  // and both timers started at the 400ms gate delay — well before the client
  // finished playing audio — causing premature idle on longer questions.
  socket.on("playback_done", () => {
    if (!isListeningActive || isInterviewEnded) return;
    const cached = sttConnectionCache.get(interviewId);
    if (cached?.conn) {
      cached.conn.resumeIdleDetection?.();
    }
    startNoTranscriptTimer();
    console.log(
      "▶️ playback_done: idle detection started (user ready to speak)",
    );
  });

  socket.on("secondary_camera_connected", (data) => {
    session.secondaryCameraConnected = true;
    session.secondaryCameraMetadata = {
      connectedAt: new Date(data.timestamp),
      angle: data.angle ?? null,
    };

    io.to(`interview_${interviewId}`).emit("secondary_camera_ready", {
      connected: true,
      timestamp: Date.now(),
    });

    io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
      connected: true,
      metadata: session.secondaryCameraMetadata,
    });
  });

  let sttReconnectBuffer = [];
  socket.on("user_audio_chunk", async (buf) => {
    if (!isListeningActive || session.isSetupMode || !session.interviewStarted)
      return;

    const cached = sttConnectionCache.get(interviewId);

    if (!cached?.conn?.isConnected?.()) {
      if (sttReconnectBuffer.length < MAX_QUEUE_SIZE) {
        sttReconnectBuffer.push(buf);
      }

      if (!session._sttReconnecting) {
        session._sttReconnecting = true;
        ensureSTTConnection()
          .then((conn) => {
            conn.resumeIdleDetection?.();
            sttReconnectBuffer.forEach((b) => conn.send(b));
            sttReconnectBuffer = [];
            session._sttReconnecting = false;
          })
          .catch(() => {
            sttReconnectBuffer = [];
            session._sttReconnecting = false;
          });
      }
      return;
    }

    cached.conn.send(buf);
  });

  socket.on("holistic_detection_result", async ({ faceCount, timestamp }) => {
    if (session.isSetupMode || !session.interviewStarted) return;

    const now = Date.now();
    if (now - lastHolisticTime < FACE_THROTTLE) return;
    lastHolisticTime = now;

    try {
      if (faceCount === 0) {
        if (!faceFirstMissing) {
          faceFirstMissing = now;
          return;
        }

        const absenceMs = now - faceFirstMissing;
        if (absenceMs < FACE_WINDOW) return;

        faceWarnCount++;

        if (!openFaceViolId) {
          openFaceViolId = await dbOpenViolation({
            interviewId,
            userId,
            violationType: "NO_FACE",
            details: { warningCount: faceWarnCount },
            startTime: faceFirstMissing,
          });
        } else {
          await dbIncrementWarning({
            violationId: openFaceViolId,
            warningCount: faceWarnCount,
          });
        }

        socket.emit("face_violation", {
          type: "NO_FACE",
          count: faceWarnCount,
          max: MAX_FACE_WARN,
          message: `No face detected - warning ${faceWarnCount} of ${MAX_FACE_WARN}`,
        });

        if (faceWarnCount >= MAX_FACE_WARN) {
          socket.emit("face_violation_alert", {
            type: "NO_FACE",
            message: "Repeated face absence has been logged.",
          });
          faceWarnCount = 0;
        }
      } else if (faceCount > 1) {
        socket.emit("face_violation", {
          type: "MULTIPLE_FACES",
          faceCount,
          message: `${faceCount} faces detected - this has been logged.`,
        });

        await dbSavePointViolation({
          interviewId,
          userId,
          violationType: "MULTIPLE_FACES",
          details: { faceCount },
          timestamp,
        });
      } else {
        faceFirstMissing = null;

        if (openFaceViolId) {
          await dbCloseViolation({ violationId: openFaceViolId, endTime: now });
          openFaceViolId = null;
        }

        if (faceWarnCount > 0) {
          if (faceViolTimeout) clearTimeout(faceViolTimeout);
          faceViolTimeout = setTimeout(() => {
            faceWarnCount = 0;
            socket.emit("face_violation_cleared");
          }, 2000);
        }
      }
    } catch (e) {
      console.error("❌ holistic handler error:", e.message);
    }
  });

  socket.on("video_recording_start", (d) => {
    socket.emit("video_recording_ready", {
      videoType: d?.videoType,
      sessionId: `${interviewId}_${d?.videoType}_${Date.now()}`,
    });
  });

  socket.on("video_chunk", () => {});
  socket.on("video_recording_stop", () => {});

  socket.on("audio_recording_start", (d) => {
    socket.emit("audio_recording_ready", {
      audioId: `${interviewId}_audio_${Date.now()}`,
      audioType: d?.audioType,
    });
  });

  socket.on("audio_chunk", () => {});
  socket.on("audio_recording_stop", () => {});

  socket.on("mobile_camera_frame", (data, ack) => {
    session.lastMobileFrame = {
      frame: data.frame,
      timestamp: data.timestamp ?? Date.now(),
      frameNum: data.frameNum,
    };

    if (session.desktopSocketId && !session.webrtcEstablished) {
      socket.to(`interview_${interviewId}`).emit("mobile_camera_frame", {
        frame: data.frame,
        timestamp: data.timestamp ?? Date.now(),
        frameNum: data.frameNum,
      });
    }

    if (typeof ack === "function") ack();
  });

  socket.on("disconnect", () => {
    console.log(`🖥️ Desktop disconnected: ${socket.id}`);

    if (session.desktopSocketId === socket.id) {
      session.desktopSocketId = null;
    }

    clearNoTranscriptTimer();

    if (faceViolTimeout) {
      clearTimeout(faceViolTimeout);
      faceViolTimeout = null;
    }

    isProcessing = false;
    isListeningActive = false;

    // Abort any in-flight TTS Deepgram stream so it stops consuming bandwidth
    // and CPU after the client has disconnected.
    const ttsInst = ttsInstanceCache.get(interviewId);
    if (ttsInst) {
      try {
        ttsInst.abort();
      } catch (_) {}
    }

    // Put STT into standby so it stops forwarding audio to Deepgram
    const sttCached = sttConnectionCache.get(interviewId);
    if (sttCached?.conn) {
      try {
        sttCached.conn.enterStandby();
      } catch (_) {}
    }
  });

  socket.on("error", (e) => console.error("❌ socket error:", e));
}

function getOrCreate(sessions, interviewId) {
  if (!sessions.has(interviewId)) {
    sessions.set(interviewId, {
      desktopSocketId: null,
      mobileSocketId: null,
      pendingMobileOffer: null,
      pendingMobileIceCandidates: [],
      secondaryCameraConnected: false,
      secondaryCameraMetadata: null,
      lastMobileFrame: null,
      isSetupMode: true,
      interviewStarted: false,
      currentOrder: 1,
      currentQText: "",
      _preWarmStartedAt: null,
      webrtcEstablished: false,
      createdAt: Date.now(),
    });
  }
  return sessions.get(interviewId);
}

function initInterviewSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket"],
    maxHttpBufferSize: 10 * 1024 * 1024,
    pingTimeout: 60000,
    pingInterval: 25000,
    perMessageDeflate: false,
    httpCompression: false,
    connectTimeout: 45000,
    allowUpgrades: true,
  });

  const sessions = new Map();

  // Move the cleanup interval INSIDE initInterviewSocket where sessions is defined
  setInterval(
    () => {
      const now = Date.now();
      for (const [id, session] of sessions.entries()) {
        if (now - (session.createdAt || now) > 60 * 60 * 1000) {
          console.log(`🧹 Cleaning up stale session: ${id}`);
          sessions.delete(id);
        }
      }
    },
    10 * 60 * 1000,
  );

  io.on("connection", async (socket) => {
    const { interviewId, userId, type } = socket.handshake.query;

    if (!interviewId || !userId) {
      socket.emit("error", { message: "Missing interviewId or userId" });
      return socket.disconnect();
    }

    console.log(
      `🔌 Socket connected - type=${type} interview=${interviewId} socket=${socket.id}`,
    );

    try {
      if (type === "settings") {
        await handleSettingsSocket(socket, interviewId, userId, io, sessions);
      } else {
        await handleInterviewSocket(socket, interviewId, userId, io, sessions);
      }
    } catch (err) {
      console.error(`❌ Socket handler error:`, err);
      socket.emit("error", { message: "Internal server error" });
      socket.disconnect();
    }
  });

  console.log("✅ Socket.IO server initialized");
  return io;
}

module.exports = { initInterviewSocket };
