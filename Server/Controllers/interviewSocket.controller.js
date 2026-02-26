const { Server } = require("socket.io");
const {
  AccessToken,
  RoomServiceClient,
  EgressClient,
  EncodedFileOutput,
} = require("livekit-server-sdk");
const { Interview } = require("../Models/interview.models.js");
const { generateNextQuestionWithAI } = require("../Service/ai.service.js");
const { createTTSStream } = require("../Service/tts.service.js");
const { createSTTSession } = require("../Service/stt.service.js");
const { evaluateInterview } = require("../Service/evaluation.service.js");
const {
  mergeInterviewMedia,
} = require("../Service/globalVideoMerger.service.js");
const Job = require("../Admin/models/job.models.js");

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

const roomService = new RoomServiceClient(
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
);
const egressClient = new EgressClient(
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
);

const ttsInstanceCache = new Map();
function getTTSInstance(id) {
  if (!ttsInstanceCache.has(id)) ttsInstanceCache.set(id, createTTSStream());
  return ttsInstanceCache.get(id);
}

// ════════════════════════════════════════════════════════════════════════════
// GLOBAL STT CONNECTION CACHE - ONE PER INTERVIEW
// ════════════════════════════════════════════════════════════════════════════
const sttConnectionCache = new Map(); // interviewId → { conn, socketId, createdAt }

async function createLiveKitToken(identity, room, extra = {}) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    ...extra,
  });
  return Promise.resolve(at.toJwt());
}

const roomName = (id) => `interview_${id}`;

async function startCompositeEgress(interviewId, filepath) {
  try {
    const out = new EncodedFileOutput({ filepath, fileType: 2 });
    const eg = await egressClient.startRoomCompositeEgress(
      roomName(interviewId),
      { file: out },
      { layout: "grid", audioOnly: false },
    );
    console.log(`🎬 Composite egress: ${eg.egressId}`);
    return eg.egressId;
  } catch (e) {
    console.error("❌ Composite egress:", e.message);
    return null;
  }
}

async function stopEgress(id) {
  if (!id) return;
  try {
    await egressClient.stopEgress(id);
  } catch (_) {}
}

function cleanupSession(id) {
  ttsInstanceCache.delete(id);
  // Clean up cached STT connection
  const cached = sttConnectionCache.get(id);
  if (cached) {
    try {
      cached.conn.finish();
    } catch (_) {}
    sttConnectionCache.delete(id);
  }
  roomService.deleteRoom(roomName(id)).catch(() => {});
}

async function ensureRoom(interviewId) {
  const name = roomName(interviewId);
  try {
    await roomService.createRoom({
      name,
      emptyTimeout: 300,
      maxParticipants: 10,
    });
    console.log(`✅ LiveKit room ensured: ${name}`);
  } catch (e) {
    if (!e.message?.includes("already exists")) {
      console.error("❌ createRoom:", e.message);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// streamTTSToClient - FIXED: Properly streams chunks without timeout
// ════════════════════════════════════════════════════════════════════════════
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

    // Timeout: 60 seconds for TTS to complete
    const hardTimeout = setTimeout(() => {
      console.error(
        `❌ TTS timeout: No chunks received after 60s (${chunkCount} chunks so far)`,
      );
      settle(
        new Error(
          `TTS timed out - insufficient audio data (${chunkCount} chunks)`,
        ),
      );
    }, 60_000);

    tts
      .speakStream(text, (chunk) => {
        if (settled) return;

        // END OF STREAM marker
        if (chunk === null) {
          clearTimeout(hardTimeout);
          console.log(
            `✅ TTS fetched: ${chunkCount} chunks  ${(chunkCount * 4176) / 1024}KB`,
          );
          try {
            socket.emit("tts_end");
          } catch (e) {
            console.error("tts_end emit failed:", e.message);
          }
          settle();
          return;
        }

        // CHUNK RECEIVED - Stream immediately
        chunkCount++;

        if (!socket.connected) {
          console.warn("⚠️ TTS: Socket disconnected");
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
          console.error("❌ tts_audio emit failed:", e.message);
          settle(e);
        }
      })
      .catch((err) => {
        clearTimeout(hardTimeout);
        console.error("❌ speakStream error:", err.message);
        try {
          socket.emit("tts_end");
        } catch (_) {}
        settle(err);
      });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// handleSettingsSocket (mobile / secondary camera)
// ════════════════════════════════════════════════════════════════════════════
async function handleSettingsSocket(socket, interviewId, userId, io, sessions) {
  await ensureRoom(interviewId);
  const session = getOrCreate(sessions, interviewId);
  socket.join(`interview_${interviewId}`);
  session.mobileSocketId = socket.id;

  const token = await createLiveKitToken(
    `mobile_${userId}`,
    roomName(interviewId),
  );
  socket.emit("livekit_token", {
    token,
    url: LIVEKIT_URL,
    room: roomName(interviewId),
    role: "secondary_camera",
  });

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

  const relay = (data, ack) => {
    session.lastMobileFrame = data.frame;
    if (session.desktopSocketId)
      socket.to(`interview_${interviewId}`).emit("mobile_camera_frame", {
        frame: data.frame,
        timestamp: data.timestamp ?? Date.now(),
      });
    if (typeof ack === "function") ack();
  };
  socket.on("mobile_camera_frame", relay);
  socket.on("security_frame_request", relay);

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

// ════════════════════════════════════════════════════════════════════════════
// handleInterviewSocket (desktop primary)
// ════════════════════════════════════════════════════════════════════════════
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

  const [, lkToken] = await Promise.all([
    ensureRoom(interviewId),
    (async () => {
      if (!session._cachedDesktopToken) {
        session._cachedDesktopToken = await createLiveKitToken(
          `user_${userId}`,
          roomName(interviewId),
        );
      }
      return session._cachedDesktopToken;
    })(),
  ]);

  socket.emit("livekit_token", {
    token: lkToken,
    url: LIVEKIT_URL,
    room: roomName(interviewId),
    role: "primary",
  });

  socket.on("request_livekit_token", async () => {
    console.log("🔑 Desktop re-requesting LiveKit token");
    if (!session._cachedDesktopToken) {
      session._cachedDesktopToken = await createLiveKitToken(
        `user_${userId}`,
        roomName(interviewId),
      );
    }
    socket.emit("livekit_token", {
      token: session._cachedDesktopToken,
      url: LIVEKIT_URL,
      room: roomName(interviewId),
      role: "primary",
    });
  });

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

  let firstQuestion = null;
  let jobDetails = null;
  try {
    const [interviewSession, q] = await Promise.all([
      Interview.getSessionById(interviewId),
      Interview.getQuestionByOrder(interviewId, 1),
    ]);

    firstQuestion = q;

    // Fetch job details once — passed to every AI call so questions stay relevant
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

  // ── Variable declarations ──────────────────────────────────────────────
  let currentOrder = session.currentOrder ?? 1;
  let isProcessing = false;
  let isInterviewEnded = false;
  let isListeningActive = false;
  let awaitingRepeat = false;
  let currentQText = session.currentQText ?? "";
  const MAX_Q = 10;

  const MAX_FACE_VIOL = 3;
  const FACE_THROTTLE = 1000;
  const FACE_WINDOW = 3000;
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

  // ════════════════════════════════════════════════════════════════════════
  // FUNCTION DEFINITIONS
  // ════════════════════════════════════════════════════════════════════════

  // ── ensureSTTConnection - CREATE OR REUSE ONE CONNECTION PER INTERVIEW
  function ensureSTTConnection() {
    const cached = sttConnectionCache.get(interviewId);

    // If we have a cached connection and it's still alive, reuse it
    if (cached && cached.conn && cached.conn.isConnected?.()) {
      console.log(
        `♻️ Reusing cached STT connection for interview ${interviewId}`,
      );
      cached.conn.resetTranscriptState?.();
      return Promise.resolve(cached.conn);
    }

    // Otherwise, create a new one
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
          console.log(
            `📝 onTranscript fired: "${text?.slice(0, 50)}" isListening=${isListeningActive} isProcessing=${isProcessing}`,
          );
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
          console.warn(`⚠️ Deepgram STT closed for interview ${interviewId}`);
          // Remove from cache when it closes
          if (sttConnectionCache.get(interviewId)?.conn === conn) {
            sttConnectionCache.delete(interviewId);
          }
        },
        onIdle: async () => {
          console.log(
            `⏱️ Deepgram idle — isListeningActive=${isListeningActive} isProcessing=${isProcessing}`,
          );
          if (isListeningActive && !isProcessing) await handleIdle();
        },
      });

      conn
        .waitForReady?.(8000)
        .then(() => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            console.log(`✅ Deepgram ready for interview ${interviewId}`);
            // Cache this connection for the entire interview
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

  // ── enableListening - ACTIVATE THE PERSISTENT CONNECTION
  const enableListening = async () => {
    console.log(`🔌 [LISTEN] enableListening called (Q${currentOrder})`);

    if (playbackDoneTimer) {
      clearTimeout(playbackDoneTimer);
      playbackDoneTimer = null;
    }

    if (isInterviewEnded || !session.interviewStarted) {
      console.log(`⚠️ [LISTEN] Skipped: interview ended or not started`);
      return;
    }

    if (!awaitingPlaybackDone) {
      console.log(`⚠️ [LISTEN] Skipped: not awaitingPlaybackDone`);
      return;
    }

    if (isListeningActive) {
      console.log(`⚠️ [LISTEN] Skipped: already isListeningActive`);
      return;
    }

    awaitingPlaybackDone = false;

    try {
      console.log(`   🔌 Getting or creating STT connection...`);
      const conn = await ensureSTTConnection();

      if (!conn.isConnected?.()) {
        throw new Error("STT connection not ready");
      }

      console.log(`   ✅ STT connection ready`);
      isListeningActive = true;
      isProcessing = false;
      socket.emit("listening_enabled");
      console.log(`   ✅ listening_enabled emitted`);

      try {
        conn.resumeIdleDetection?.();
        console.log(`   ✅ idleDetection resumed`);
      } catch (e) {
        console.warn(`⚠️ resumeIdleDetection failed: ${e.message}`);
      }

      console.log(`   ✅ Ready to listen for Q${currentOrder}`);
    } catch (err) {
      console.error(`❌ [LISTEN] Failed: ${err.message}`);
      socket.emit("error", {
        message: "Microphone connection failed. Please refresh.",
      });
      isProcessing = false;
      awaitingPlaybackDone = false;
    }
  };

  async function transitionToNextQuestion(text) {
    console.log(`🎯 [TRANSITION] Q${currentOrder}: "${text.slice(0, 60)}..."`);

    try {
      const conn = sttConnectionCache.get(interviewId)?.conn;
      if (conn) {
        conn.pauseIdleDetection?.();
        console.log(`   ✅ STT paused`);
      }

      isListeningActive = false;
      awaitingPlaybackDone = true;

      console.log(`   → Streaming TTS for Q${currentOrder}...`);
      const startTime = Date.now();
      await streamTTSToClient(socket, text, interviewId);
      const duration = Date.now() - startTime;
      console.log(`   ✅ TTS complete in ${duration}ms - emitted tts_end`);

      if (playbackDoneTimer) clearTimeout(playbackDoneTimer);
      playbackDoneTimer = setTimeout(() => {
        console.warn(
          `⚠️ [TRANSITION] playback_done timeout (15s) — enabling STT anyway`,
        );
        enableListening().catch(console.error);
      }, 15_000);

      console.log(`   ⏳ Waiting for playback_done (timeout: 15s)`);
    } catch (err) {
      console.error(`❌ [TRANSITION] Failed: ${err.message}`);
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
      if (currentOrder >= MAX_Q) {
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
    console.log(
      `🗣️ processTranscript CALLED: "${text?.slice(0, 80)}" Q${currentOrder} processing=${isProcessing}`,
    );

    if (isInterviewEnded || isProcessing) {
      console.log(
        `   ⚠️ Skipped (isInterviewEnded=${isInterviewEnded}, isProcessing=${isProcessing})`,
      );
      return;
    }

    isProcessing = true;
    isListeningActive = false;
    socket.emit("listening_disabled");

    try {
      console.log(`   📌 Step 1: Get current question (Q${currentOrder})`);
      const q = await Interview.getQuestionByOrder(interviewId, currentOrder);

      if (!q) {
        console.error(`   ❌ Question not found for Q${currentOrder}`);
        socket.emit("error", { message: "Question not found" });
        isProcessing = false;
        return;
      }
      console.log(
        `   ✅ Got Q${currentOrder}: "${q.question.slice(0, 60)}..."`,
      );

      if (currentOrder >= MAX_Q) {
        console.log(
          `   📌 Step 2: Max questions (${MAX_Q}) reached - saving answer`,
        );
        await Interview.saveAnswer({
          interviewId,
          questionId: q.id,
          answer: text,
        });
        console.log(`   ✅ Answer saved for Q${currentOrder}`);
        await endInterview();
        return;
      }

      const nextOrder = currentOrder + 1;
      console.log(
        `   📌 Step 2: Saving Q${currentOrder} answer + Preparing Q${nextOrder}`,
      );

      const [, nextQ] = await Promise.all([
        Interview.saveAnswer({
          interviewId,
          questionId: q.id,
          answer: text,
        }).then(() => {
          console.log(`   ✅ Q${currentOrder} answer saved`);
        }),

        (async () => {
          let nq = await Interview.getQuestionByOrder(interviewId, nextOrder);

          if (!nq) {
            console.log(
              `   📌 Q${nextOrder} not found - generating with AI...`,
            );
            const gen = await generateNextQuestionWithAI({
              answer: text,
              questionOrder: nextOrder,
              previousQuestion: q.question,
              jobDetails,
            });
            console.log(
              `   ✅ AI generated Q${nextOrder}: "${gen.slice(0, 60)}..."`,
            );

            await Interview.saveQuestion({
              interviewId,
              question: gen,
              questionOrder: nextOrder,
              technology: null,
              difficulty: null,
            });
            console.log(`   ✅ Q${nextOrder} saved to database`);

            nq = await Interview.getQuestionByOrder(interviewId, nextOrder);
          } else {
            console.log(`   ✅ Q${nextOrder} already in database`);
          }

          return nq;
        })(),
      ]);

      if (!nextQ) {
        console.error(`   ❌ Failed to get/create Q${nextOrder}`);
        socket.emit("error", { message: "Failed to generate next question" });
        isProcessing = false;
        return;
      }

      console.log(`   📌 Step 3: Updating state to Q${nextOrder}`);
      currentOrder = nextOrder;
      currentQText = nextQ.question;
      session.currentOrder = currentOrder;
      session.currentQText = currentQText;
      awaitingRepeat = false;
      console.log(
        `   ✅ State updated: currentOrder=${currentOrder}, currentQText="${currentQText.slice(0, 60)}..."`,
      );

      console.log(`   📌 Step 4: Streaming Q${nextOrder} to client`);
      socket.emit("next_question", { question: nextQ.question });

      // TTS with retry - if it fails, try again
      let ttsAttempts = 0;
      let ttsSuccess = false;

      while (ttsAttempts < 3 && !ttsSuccess) {
        ttsAttempts++;
        try {
          console.log(
            `   🔄 TTS attempt ${ttsAttempts}/3 for Q${nextOrder}...`,
          );
          await transitionToNextQuestion(nextQ.question);
          ttsSuccess = true;
          console.log(`   ✅ Q${nextOrder} TTS successful`);
        } catch (ttsErr) {
          console.error(
            `   ❌ Q${nextOrder} TTS attempt ${ttsAttempts} failed: ${ttsErr.message}`,
          );
          if (ttsAttempts < 3) {
            await new Promise((r) => setTimeout(r, 1000));
          } else {
            throw ttsErr;
          }
        }
      }

      if (!ttsSuccess) {
        throw new Error(`TTS failed after 3 attempts for Q${nextOrder}`);
      }

      console.log(
        `   ✅ processTranscript complete - waiting for playback_done`,
      );
    } catch (err) {
      console.error(`   ❌ processTranscript failed: ${err.message}`);
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

    // Clean up STT connection for this interview
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

    await Promise.allSettled([
      stopEgress(session.compositeEgressId),
      stopEgress(session.screenEgressId),
      stopEgress(session.mobileEgressId),
    ]);
    session.compositeEgressId =
      session.screenEgressId =
      session.mobileEgressId =
        null;

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

  // ════════════════════════════════════════════════════════════════════════
  // SOCKET EVENT HANDLERS
  // ════════════════════════════════════════════════════════════════════════

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
    if (clientReadyHandled) {
      console.log("⚠️ client_ready already handled — ignoring");
      return;
    }
    clientReadyHandled = true;

    const isGenuineReconnect =
      session.interviewStarted && (session.currentOrder ?? 1) > 1;

    if (isGenuineReconnect) {
      console.log(`🔄 Reconnect detected — resuming Q${currentOrder}`);
      isProcessing = true;
      isListeningActive = false;
      awaitingPlaybackDone = false;
      try {
        socket.emit("question", { question: currentQText });
        awaitingPlaybackDone = true;
        await streamTTSToClient(socket, currentQText, interviewId);
        if (playbackDoneTimer) clearTimeout(playbackDoneTimer);
        playbackDoneTimer = setTimeout(() => {
          console.warn("⚠️ playback_done timeout (15s)");
          enableListening();
        }, 15_000);
      } catch (err) {
        console.error("❌ reconnect resume:", err);
        isProcessing = false;
        awaitingPlaybackDone = false;
      }
      return;
    }

    if (session.interviewStarted) {
      console.log("🔄 Stale Q1 session detected — resetting");
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

      startCompositeEgress(
        interviewId,
        `/recordings/${interviewId}/composite.mp4`,
      )
        .then((id) => {
          if (id) session.compositeEgressId = id;
        })
        .catch(console.error);

      awaitingPlaybackDone = true;
      await streamTTSToClient(socket, firstQuestion.question, interviewId);
      if (playbackDoneTimer) clearTimeout(playbackDoneTimer);
      playbackDoneTimer = setTimeout(() => {
        console.warn("⚠️ playback_done timeout (15s)");
        enableListening();
      }, 15_000);
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
    // Debounce: ignore duplicate events within 1 second
    if (now - lastPlaybackDoneAt < 1000) {
      console.log(`⚠️ playback_done debounced (duplicate within 1s)`);
      return;
    }
    lastPlaybackDoneAt = now;

    console.log(
      `🔊 [EVENT] playback_done received (Q${currentOrder}, awaitingPlaybackDone=${awaitingPlaybackDone})`,
    );
    enableListening().catch((err) => {
      console.error(`❌ playback_done handler error:`, err.message);
    });
  });

  socket.on("livekit_track_published", async ({ source, trackSid }) => {
    if (source === "screen_share" && !session.screenEgressId) {
      try {
        const out = new EncodedFileOutput({
          filepath: `/recordings/${interviewId}/screen.mp4`,
          fileType: 2,
        });
        const eg = await egressClient.startTrackCompositeEgress(
          roomName(interviewId),
          { file: out },
          { videoTrackId: trackSid },
        );
        session.screenEgressId = eg.egressId;
        socket.emit("screen_recording_started", { egressId: eg.egressId });
      } catch (e) {
        console.error("❌ Screen egress:", e.message);
      }
    }
  });

  socket.on("livekit_track_unpublished", async ({ source }) => {
    if (source === "screen_share" && session.screenEgressId) {
      await stopEgress(session.screenEgressId);
      session.screenEgressId = null;
    }
  });

  socket.on("livekit_participant_joined", async ({ identity }) => {
    console.log(`👤 livekit_participant_joined: ${identity}`);
    if (identity?.startsWith("mobile_")) {
      session.secondaryCameraConnected = true;
      io.to(`interview_${interviewId}`).emit("secondary_camera_ready", {
        connected: true,
        timestamp: Date.now(),
      });
      io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
        connected: true,
        metadata: session.secondaryCameraMetadata,
      });

      if (!session.mobileEgressId) {
        try {
          const out = new EncodedFileOutput({
            filepath: `/recordings/${interviewId}/mobile.mp4`,
            fileType: 2,
          });
          const eg = await egressClient.startParticipantCompositeEgress(
            roomName(interviewId),
            { file: out },
            { identity },
          );
          session.mobileEgressId = eg.egressId;
          console.log(`🎬 Mobile egress started: ${eg.egressId}`);
        } catch (e) {
          console.error("❌ Mobile egress:", e.message);
        }
      }
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
  socket.on("secondary_camera_disconnected", () => {
    session.secondaryCameraConnected = false;
    io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
      connected: false,
      metadata: null,
    });
  });

  const relayMobile = (data, ack) => {
    session.lastMobileFrame = data.frame;
    if (session.desktopSocketId)
      socket.to(`interview_${interviewId}`).emit("mobile_camera_frame", {
        frame: data.frame,
        timestamp: data.timestamp ?? Date.now(),
      });
    if (typeof ack === "function") ack();
  };
  socket.on("mobile_camera_frame", relayMobile);
  socket.on("security_frame_request", relayMobile);

  socket.on("user_audio_chunk", async (buf) => {
    if (session.isSetupMode || !session.interviewStarted || !isListeningActive)
      return;

    let cached = sttConnectionCache.get(interviewId);

    // auto-reconnect if connection dropped while we're supposed to be listening
    if (!cached || !cached.conn?.isConnected?.()) {
      const now = Date.now();
      if (now - lastNoConnWarn > 3000) {
        console.warn(
          "⚠️ STT connection lost while listening — reconnecting...",
        );
        lastNoConnWarn = now;
      }

      // Only one reconnect attempt at a time
      if (!session._sttReconnecting) {
        session._sttReconnecting = true;
        ensureSTTConnection()
          .then((conn) => {
            conn.resumeIdleDetection?.();
            session._sttReconnecting = false;
            console.log("✅ STT auto-reconnected");
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

  socket.on("agent_transcript", async (data) => {
    if (!data?.text?.trim() || !isListeningActive || isProcessing) return;
    socket.emit("transcript_received", { text: data.text });
    isListeningActive = false;
    const conn = sttConnectionCache.get(interviewId)?.conn;
    conn?.pauseIdleDetection?.();
    awaitingRepeat
      ? await handleRepeat(data.text)
      : await processTranscript(data.text);
  });

  socket.on("agent_interim", (d) => {
    if (d?.text?.trim()) socket.emit("interim_transcript", { text: d.text });
  });
  socket.on("agent_idle", async () => {
    if (isListeningActive && !isProcessing) await handleIdle();
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
      livekitRoomName: roomName(interviewId),
      compositeEgressId: null,
      screenEgressId: null,
      mobileEgressId: null,
      desktopSocketId: null,
      mobileSocketId: null,
      secondaryCameraConnected: false,
      secondaryCameraMetadata: null,
      lastMobileFrame: null,
      isSetupMode: true,
      interviewStarted: false,
      currentOrder: 1,
      currentQText: "",
      _cachedDesktopToken: null,
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
