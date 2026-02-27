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

const FACE_THROTTLE = 1000;
const FACE_WINDOW = 3000;
const MAX_FACE_VIOL = 3;

const ttsInstanceCache = new Map();
function getTTSInstance(id) {
  if (!ttsInstanceCache.has(id)) ttsInstanceCache.set(id, createTTSStream());
  return ttsInstanceCache.get(id);
}

const sttConnectionCache = new Map();

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

    const hardTimeout = setTimeout(() => {
      settle(new Error(`TTS timed out (${chunkCount} chunks so far)`));
    }, 60_000);

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

  if (session.secondaryCameraConnected) {
    socket.emit("secondary_camera_ready", {
      connected: true,
      timestamp: Date.now(),
    });
  }

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

  // ── Mobile camera WebRTC relay ──────────────────────────────────────────
  socket.on("mobile_webrtc_offer", ({ offer, identity }) => {
    console.log(`📱 Relaying mobile WebRTC offer to desktop (${identity})`);
    if (session.desktopSocketId) {
      io.to(session.desktopSocketId).emit("mobile_webrtc_offer_relay", {
        offer,
        identity,
      });
    }
  });

  socket.on("mobile_webrtc_ice_candidate", ({ candidate }) => {
    if (session.desktopSocketId) {
      io.to(session.desktopSocketId).emit("mobile_webrtc_ice_from_mobile", {
        candidate,
      });
    }
  });

  socket.on("mobile_camera_frame", (data, ack) => {
    session.lastMobileFrame = data.frame;
    if (session.desktopSocketId) {
      socket.to(`interview_${interviewId}`).emit("mobile_camera_frame", {
        frame: data.frame,
        timestamp: data.timestamp ?? Date.now(),
      });
    }
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

  // ── Mobile camera WebRTC (desktop answer side) ────────────────────────────
  socket.on("mobile_webrtc_answer", ({ answer, identity }) => {
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

  // ── Load interview data ───────────────────────────────────────────────────
  let firstQuestion = null;
  let jobDetails = null;
  try {
    const [interviewSession, q] = await Promise.all([
      Interview.getSessionById(interviewId),
      Interview.getQuestionByOrder(interviewId, 1),
    ]);
    firstQuestion = q;
    if (interviewSession?.jobId) {
      jobDetails = await Job.findById(interviewSession.jobId).catch(() => null);
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
  let currentQText = session.currentQText ?? "";

  let lastHolisticTime = 0;
  let faceViolCount = 0;
  let faceFirstMissing = null;
  let faceViolTimeout = null;

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
    if (cached && cached.conn && cached.conn.isConnected?.()) {
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
    if (isInterviewEnded || !session.interviewStarted) return;
    if (!awaitingPlaybackDone) return;
    if (isListeningActive) return;
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
      const conn = sttConnectionCache.get(interviewId)?.conn;
      if (conn) conn.pauseIdleDetection?.();
      isListeningActive = false;
      awaitingPlaybackDone = true;
      await streamTTSToClient(socket, text, interviewId);
      if (playbackDoneTimer) clearTimeout(playbackDoneTimer);
      playbackDoneTimer = setTimeout(() => {
        console.warn(`⚠️ playback_done timeout (15s) — enabling STT anyway`);
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
    const conn = sttConnectionCache.get(interviewId)?.conn;
    conn?.pauseIdleDetection?.();
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

      let ttsAttempts = 0,
        ttsSuccess = false;
      while (ttsAttempts < 3 && !ttsSuccess) {
        ttsAttempts++;
        try {
          await transitionToNextQuestion(nextQ.question);
          ttsSuccess = true;
        } catch (ttsErr) {
          if (ttsAttempts < 3) await new Promise((r) => setTimeout(r, 1000));
          else throw ttsErr;
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

  async function safeViolation(type, details, timestamp) {
    try {
      if (typeof Interview.saveViolation === "function")
        await Interview.saveViolation({
          interviewId,
          violationType: type,
          details,
          timestamp: new Date(timestamp),
        });
    } catch (_) {}
  }

  // ── Socket event handlers ─────────────────────────────────────────────────

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
    let cached = sttConnectionCache.get(interviewId);
    if (!cached || !cached.conn?.isConnected?.()) {
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
          return;
        }
        if (now - faceFirstMissing < FACE_WINDOW) return;
        faceViolCount++;
        socket.emit("face_violation", {
          type: "NO_FACE",
          count: faceViolCount,
          max: MAX_FACE_VIOL,
          message: `No face (${MAX_FACE_VIOL - faceViolCount} left)`,
        });
        if (faceViolCount >= MAX_FACE_VIOL) {
          socket.emit("interview_terminated", { reason: "NO_FACE_DETECTED" });
          await safeViolation(
            "NO_FACE",
            `${Math.round((now - faceFirstMissing) / 1000)}s absent`,
            timestamp,
          );
          await endInterview();
        }
      } else if (faceCount > 1) {
        socket.emit("interview_terminated", {
          reason: "MULTIPLE_FACES",
          faceCount,
        });
        await safeViolation("MULTIPLE_FACES", `${faceCount} faces`, timestamp);
        await endInterview();
      } else {
        faceFirstMissing = null;
        if (faceViolCount > 0) {
          if (faceViolTimeout) clearTimeout(faceViolTimeout);
          faceViolTimeout = setTimeout(() => {
            faceViolCount = 0;
            socket.emit("face_violation_cleared");
          }, 2000);
        }
      }
    } catch (e) {
      console.error("❌ holistic:", e.message);
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
      socket
        .to(`interview_${interviewId}`)
        .emit("mobile_camera_frame", {
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
