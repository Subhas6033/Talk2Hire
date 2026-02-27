const { Server } = require("socket.io");
const { Interview } = require("../Models/interview.models.js");
const { generateNextQuestionWithAI } = require("../Service/ai.service.js");
const { createTTSStream } = require("../Service/tts.service.js");
const { createSTTSession } = require("../Service/stt.service.js");
const { evaluateInterview } = require("../Service/evaluation.service.js");
const {
  mergeInterviewMedia,
} = require("../Service/globalVideoMerger.service.js");
const Job = require("../Admin/models/job.models.js");
const { pool } = require("../Config/database.config.js");

const FACE_THROTTLE = 1000;
const FACE_WINDOW = 3000;
const MAX_FACE_WARN = 5;

const ttsInstanceCache = new Map();
function getTTSInstance(id) {
  if (!ttsInstanceCache.has(id)) ttsInstanceCache.set(id, createTTSStream());
  return ttsInstanceCache.get(id);
}

const sttConnectionCache = new Map();

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

async function dbOpenViolation({
  interviewId,
  userId,
  violationType,
  details = {},
  startTime,
}) {
  try {
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
    console.log(
      `🚨 [VIOLATION OPENED] type=${violationType} interviewId=${interviewId} ` +
        `userId=${userId} startTime=${new Date(startTime).toISOString()} dbId=${result.insertId}`,
    );
    return result.insertId;
  } catch (err) {
    console.error(
      `❌ [VIOLATION DB] openViolation FAILED (${violationType} / interview ${interviewId}):`,
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
    console.log(
      `✅ [VIOLATION CLOSED] dbId=${violationId} endTime=${new Date(endTime).toISOString()}`,
    );
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
    console.log(
      `⚠️  [VIOLATION DB] dbId=${violationId} warning_count → ${warningCount}`,
    );
  } catch (err) {
    console.error(
      `❌ [VIOLATION DB] incrementWarning FAILED (dbId=${violationId}):`,
      err.message,
    );
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
      `🚨 [VIOLATION SAVED] type=${violationType} interviewId=${interviewId} ` +
        `at=${ts.toISOString()} dbId=${result.insertId}`,
    );
    return result.insertId;
  } catch (err) {
    console.error(
      `❌ [VIOLATION DB] savePointViolation FAILED (${violationType} / interview ${interviewId}):`,
      err.message,
    );
    return null;
  }
}

async function streamTTSToClient(socket, text, interviewId) {
  return new Promise((resolve, reject) => {
    const tts = getTTSInstance(interviewId);
    let chunkCount = 0;
    let settled = false;

    const settle = (err) => {
      if (settled) return;
      settled = true;
      err ? reject(err) : resolve();
    };

    const hardTimeout = setTimeout(
      () => settle(new Error(`TTS timed out (${chunkCount} chunks so far)`)),
      60_000,
    );

    tts
      .speakStream(text, (chunk) => {
        if (settled) return;
        if (chunk === null) {
          clearTimeout(hardTimeout);
          console.log(`TTS fetched: ${chunkCount} chunks`);
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
          settle(e);
        }
      })
      .catch((err) => {
        clearTimeout(hardTimeout);
        try {
          socket.emit("tts_end");
        } catch (_) {}
        settle(err);
      });
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

async function handleSettingsSocket(socket, interviewId, userId, io, sessions) {
  const session = getOrCreate(sessions, interviewId);
  session.mobileSocketId = socket.id;
  socket.join(`interview_${interviewId}`);

  if (session.secondaryCameraConnected)
    socket.emit("secondary_camera_ready", {
      connected: true,
      timestamp: Date.now(),
    });

  socket.on("request_secondary_camera_status", () =>
    io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
      connected: session.secondaryCameraConnected,
      metadata: session.secondaryCameraMetadata ?? null,
    }),
  );

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

  socket.on("mobile_webrtc_offer", ({ offer, identity }) => {
    console.log(`📱 Relaying mobile WebRTC offer to desktop (${identity})`);
    if (session.desktopSocketId) {
      io.to(session.desktopSocketId).emit("mobile_webrtc_offer_relay", {
        offer,
        identity,
      });
    } else {
      session.pendingMobileOffer = { offer, identity };
      console.warn(
        `⚠️  Mobile offer buffered — desktop not yet connected (interviewId=${interviewId})`,
      );
    }
  });

  socket.on("mobile_webrtc_ice_candidate", ({ candidate }) => {
    if (session.desktopSocketId) {
      io.to(session.desktopSocketId).emit("mobile_webrtc_ice_from_mobile", {
        candidate,
      });
    } else {
      session.pendingMobileIceCandidates.push(candidate);
    }
  });

  socket.on("mobile_camera_frame", (data, ack) => {
    session.lastMobileFrame = data.frame;
    if (session.desktopSocketId)
      socket.to(`interview_${interviewId}`).emit("mobile_camera_frame", {
        frame: data.frame,
        timestamp: data.timestamp ?? Date.now(),
      });
    if (typeof ack === "function") ack();
  });

  socket.on("disconnect", () => {
    if (session.mobileSocketId === socket.id) {
      session.mobileSocketId = null;
      io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
        connected: false,
        metadata: null,
      });
    }
  });
}

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
    console.log(`📱 Flushing buffered mobile offer to desktop`);
    socket.emit("mobile_webrtc_offer_relay", session.pendingMobileOffer);
    session.pendingMobileOffer = null;
  }

  if (session.pendingMobileIceCandidates?.length) {
    console.log(
      `📱 Flushing ${session.pendingMobileIceCandidates.length} buffered ICE candidates`,
    );
    for (const candidate of session.pendingMobileIceCandidates) {
      socket.emit("mobile_webrtc_ice_from_mobile", { candidate });
    }
    session.pendingMobileIceCandidates = [];
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
    if (session.mobileSocketId) {
      io.to(session.mobileSocketId).emit("mobile_webrtc_answer_from_server", {
        answer,
        identity,
      });
    } else {
      console.warn(
        `⚠️  Desktop sent WebRTC answer but no mobile socket found (interviewId=${interviewId})`,
      );
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
    if (jobId) jobDetails = await Job.findById(jobId).catch(() => null);
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
  let currentQText = session.currentQText ?? "";

  let lastHolisticTime = 0;
  let faceWarnCount = 0;
  let faceFirstMissing = null;
  let faceViolTimeout = null;
  let openFaceViolId = null;

  let awaitingPlaybackDone = false;
  let clientReadyHandled = false;
  let playbackDoneTimer = null;
  let lastNoConnWarn = 0;

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
          isListeningActive = false;
          conn.pauseIdleDetection?.();
          socket.emit("transcript_received", { text });
          awaitingRepeat
            ? await handleRepeat(text)
            : await processTranscript(text);
        },
        onInterim: (t) => {
          if (t?.trim()) socket.emit("interim_transcript", { text: t });
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
          if (sttConnectionCache.get(interviewId)?.conn === conn)
            sttConnectionCache.delete(interviewId);
        },
        onIdle: async () => {
          if (isListeningActive && !isProcessing) await handleIdle();
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
    if (playbackDoneTimer) {
      clearTimeout(playbackDoneTimer);
      playbackDoneTimer = null;
    }
    if (
      isInterviewEnded ||
      !session.interviewStarted ||
      !awaitingPlaybackDone ||
      isListeningActive
    )
      return;
    awaitingPlaybackDone = false;
    try {
      const conn = await ensureSTTConnection();
      if (!conn.isConnected?.()) throw new Error("STT connection not ready");
      isListeningActive = true;
      isProcessing = false;
      socket.emit("listening_enabled");
      conn.resumeIdleDetection?.();
    } catch (err) {
      console.error(`❌ enableListening failed: ${err.message}`);
      socket.emit("error", {
        message: "Microphone connection failed. Please refresh.",
      });
      isProcessing = false;
      awaitingPlaybackDone = false;
    }
  };

  async function transitionToNextQuestion(text) {
    try {
      sttConnectionCache.get(interviewId)?.conn?.pauseIdleDetection?.();
      isListeningActive = false;
      awaitingPlaybackDone = true;
      await streamTTSToClient(socket, text, interviewId);
      if (playbackDoneTimer) clearTimeout(playbackDoneTimer);
      playbackDoneTimer = setTimeout(() => {
        console.warn("⚠️ playback_done timeout (15s) — enabling STT anyway");
        enableListening().catch(console.error);
      }, 15_000);
    } catch (err) {
      console.error(`❌ transitionToNextQuestion failed: ${err.message}`);
      socket.emit("error", { message: "Speech synthesis failed" });
      isProcessing = false;
      awaitingPlaybackDone = false;
      if (playbackDoneTimer) {
        clearTimeout(playbackDoneTimer);
        playbackDoneTimer = null;
      }
      throw err;
    }
  }

  async function handleIdle() {
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
    isListeningActive = false;
    socket.emit("listening_disabled");
    try {
      const q = await Interview.getQuestionByOrder(interviewId, currentOrder);
      if (!q) {
        socket.emit("error", { message: "Question not found" });
        isProcessing = false;
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
        isProcessing = false;
        return;
      }

      currentOrder = nextOrder;
      currentQText = nextQ.question;
      session.currentOrder = currentOrder;
      session.currentQText = currentQText;
      awaitingRepeat = false;
      socket.emit("next_question", { question: nextQ.question });

      let attempts = 0,
        ok = false;
      while (attempts < 3 && !ok) {
        attempts++;
        try {
          await transitionToNextQuestion(nextQ.question);
          ok = true;
        } catch (e) {
          if (attempts < 3) await new Promise((r) => setTimeout(r, 1000));
          else throw e;
        }
      }
    } catch (err) {
      console.error(`❌ processTranscript failed: ${err.message}`);
      socket.emit("error", {
        message: `Failed to process Q${currentOrder}: ${err.message}`,
      });
      isProcessing = false;
    }
  }

  async function handleRepeat(text) {
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
    awaitingPlaybackDone = false;
    if (playbackDoneTimer) {
      clearTimeout(playbackDoneTimer);
      playbackDoneTimer = null;
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
    if (faceViolTimeout) {
      clearTimeout(faceViolTimeout);
      faceViolTimeout = null;
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
    evaluateInterview(interviewId)
      .then((r) => {
        socket.emit("evaluation_complete", {
          results: {
            overallScore: r.overallEvaluation.overallScore,
            hireDecision: r.overallEvaluation.hireDecision,
            experienceLevel: r.overallEvaluation.experienceLevel,
          },
        });
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
      })
      .catch(() =>
        socket.emit("evaluation_error", { message: "Evaluation failed." }),
      );

    isProcessing = false;
  }

  socket.on("setup_mode", () => {
    session.isSetupMode = true;
    session.interviewStarted = false;
    socket.emit("server_ready", { setupMode: true });
  });

  socket.on("request_secondary_camera_status", () =>
    io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
      connected: session.secondaryCameraConnected,
      metadata: session.secondaryCameraMetadata ?? null,
    }),
  );

  socket.on("client_ready", async () => {
    if (clientReadyHandled) return;
    clientReadyHandled = true;

    const isGenuineReconnect =
      session.interviewStarted && (session.currentOrder ?? 1) > 1;
    if (isGenuineReconnect) {
      console.log(`🔄 Reconnect — resuming Q${currentOrder}`);
      isProcessing = true;
      isListeningActive = false;
      awaitingPlaybackDone = false;
      try {
        socket.emit("question", { question: currentQText });
        awaitingPlaybackDone = true;
        await streamTTSToClient(socket, currentQText, interviewId);
        if (playbackDoneTimer) clearTimeout(playbackDoneTimer);
        playbackDoneTimer = setTimeout(() => enableListening(), 15_000);
      } catch (err) {
        console.error("❌ reconnect resume:", err);
        isProcessing = false;
        awaitingPlaybackDone = false;
      }
      return;
    }

    if (session.interviewStarted) {
      ttsInstanceCache.delete(interviewId);
      ttsInstanceCache.set(interviewId, createTTSStream());
      session.currentOrder = 1;
      session.currentQText = "";
      currentOrder = 1;
      currentQText = "";
    }

    session.isSetupMode = false;
    session.interviewStarted = true;
    isProcessing = true;
    currentQText = firstQuestion.question;
    session.currentQText = currentQText;
    session.currentOrder = currentOrder;

    try {
      socket.emit("question", { question: firstQuestion.question });
      awaitingPlaybackDone = true;
      await streamTTSToClient(socket, firstQuestion.question, interviewId);
      if (playbackDoneTimer) clearTimeout(playbackDoneTimer);
      playbackDoneTimer = setTimeout(() => enableListening(), 15_000);
    } catch (err) {
      console.error("❌ client_ready:", err);
      socket.emit("error", { message: "Failed to start" });
      isProcessing = false;
      session.interviewStarted = false;
      awaitingPlaybackDone = false;
    }
  });

  let lastPlaybackDoneAt = 0;
  socket.on("playback_done", () => {
    const now = Date.now();
    if (now - lastPlaybackDoneAt < 1000) return;
    lastPlaybackDoneAt = now;
    enableListening().catch(console.error);
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

  socket.on("user_audio_chunk", async (buf) => {
    if (session.isSetupMode || !session.interviewStarted || !isListeningActive)
      return;
    const cached = sttConnectionCache.get(interviewId);
    if (!cached?.conn?.isConnected?.()) {
      const now = Date.now();
      if (now - lastNoConnWarn > 3000) {
        console.warn("⚠️ STT connection lost — reconnecting...");
        lastNoConnWarn = now;
      }
      if (!session._sttReconnecting) {
        session._sttReconnecting = true;
        ensureSTTConnection()
          .then((conn) => {
            conn.resumeIdleDetection?.();
            session._sttReconnecting = false;
          })
          .catch((e) => {
            session._sttReconnecting = false;
            console.error("❌ STT auto-reconnect failed:", e.message);
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
          console.log(
            `👁️  [FACE] No face detected — tracking absence interviewId=${interviewId}`,
          );
          return;
        }
        const absenceMs = now - faceFirstMissing;
        if (absenceMs < FACE_WINDOW) return;

        faceWarnCount++;
        console.log(
          `⚠️  [FACE VIOLATION] NO_FACE warning #${faceWarnCount} interviewId=${interviewId}`,
        );

        if (!openFaceViolId) {
          openFaceViolId = await dbOpenViolation({
            interviewId,
            userId,
            violationType: "NO_FACE",
            details: { warningCount: 1 },
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
          message: `No face detected — warning ${faceWarnCount} of ${MAX_FACE_WARN}`,
        });

        if (faceWarnCount >= MAX_FACE_WARN) {
          socket.emit("face_violation_alert", {
            type: "NO_FACE",
            message:
              "Repeated face absence has been logged and will be reviewed.",
          });
          faceWarnCount = 0;
        }
      } else if (faceCount > 1) {
        socket.emit("face_violation", {
          type: "MULTIPLE_FACES",
          faceCount,
          message: `${faceCount} faces detected — this has been logged.`,
        });
        await dbSavePointViolation({
          interviewId,
          userId,
          violationType: "MULTIPLE_FACES",
          details: { faceCount },
          timestamp,
        });
      } else {
        if (faceFirstMissing) {
          console.log(
            `✅ [FACE] Face returned after ${Math.round((now - faceFirstMissing) / 1000)}s interviewId=${interviewId}`,
          );
        }
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

  socket.on("video_recording_start", (d) =>
    socket.emit("video_recording_ready", {
      videoType: d?.videoType,
      sessionId: `${interviewId}_${d?.videoType}_${Date.now()}`,
    }),
  );
  socket.on("video_chunk", () => {});
  socket.on("video_recording_stop", () => {});
  socket.on("audio_recording_start", (d) =>
    socket.emit("audio_recording_ready", {
      audioId: `${interviewId}_audio_${Date.now()}`,
      audioType: d?.audioType,
    }),
  );
  socket.on("audio_chunk", () => {});
  socket.on("audio_recording_stop", () => {});

  socket.on("mobile_camera_frame", (data, ack) => {
    session.lastMobileFrame = data.frame;
    if (session.desktopSocketId)
      socket.to(`interview_${interviewId}`).emit("mobile_camera_frame", {
        frame: data.frame,
        timestamp: data.timestamp ?? Date.now(),
      });
    if (typeof ack === "function") ack();
  });

  socket.on("disconnect", () => {
    console.log(`🖥️ Desktop disconnected: ${socket.id}`);
    if (session.desktopSocketId === socket.id) session.desktopSocketId = null;
    if (faceViolTimeout) {
      clearTimeout(faceViolTimeout);
      faceViolTimeout = null;
    }
    if (playbackDoneTimer) {
      clearTimeout(playbackDoneTimer);
      playbackDoneTimer = null;
    }
    isProcessing = isListeningActive = awaitingPlaybackDone = false;
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
    });
  }
  return sessions.get(interviewId);
}

function initInterviewSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN, methods: ["GET", "POST"] },
    transports: ["websocket"],
    maxHttpBufferSize: 5 * 1024 * 1024,
    pingTimeout: 60000,
    pingInterval: 25000,
    perMessageDeflate: false,
    httpCompression: false,
    connectTimeout: 45000,
    allowUpgrades: true,
  });

  const sessions = new Map();

  io.on("connection", async (socket) => {
    const { interviewId, userId, type } = socket.handshake.query;
    if (!interviewId || !userId) {
      socket.emit("error", { message: "Missing params" });
      return socket.disconnect();
    }
    console.log(`🔌 socket type=${type} interview=${interviewId}`);
    type === "settings"
      ? await handleSettingsSocket(socket, interviewId, userId, io, sessions)
      : await handleInterviewSocket(socket, interviewId, userId, io, sessions);
  });

  console.log("✅ Socket.IO ready");
}

module.exports = { initInterviewSocket };
