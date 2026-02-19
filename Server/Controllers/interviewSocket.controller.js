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
  roomService.deleteRoom(roomName(id)).catch(() => {});
}

// ════════════════════════════════════════════════════════════════════════════
// streamTTSToClient
//
// FIX 1 (full question not streaming):
//   tts_end was only emitted if socket.connected was true at the exact moment
//   the null-sentinel fired.  If the socket was briefly in a reconnecting state
//   the event was dropped silently — audio playback stopped mid-sentence and
//   the interview froze.
//
// Fix: emit tts_end UNCONDITIONALLY in the null-sentinel branch.
//   Audio chunks are still gated on socket.connected (no point sending audio
//   data to a disconnected socket), but the done signal ALWAYS fires.
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

    // Safety net: if speakStream hangs for > 30 s, force-complete
    const hardTimeout = setTimeout(() => {
      console.error("❌ TTS hard-timeout (30s)");
      try {
        socket.emit("tts_end");
      } catch (_) {}
      settle(new Error("TTS hard timeout"));
    }, 30_000);

    tts
      .speakStream(text, (chunk) => {
        if (chunk === null) {
          // ── Done sentinel ────────────────────────────────────────────────
          clearTimeout(hardTimeout);
          // FIX: NO socket.connected check here — always emit tts_end
          try {
            socket.emit("tts_end");
          } catch (e) {
            console.error("tts_end emit:", e);
          }
          console.log(`🔊 tts_end sent (${chunkCount} chunks)`);
          settle();
          return;
        }

        // ── Audio chunk — only send if socket is connected ────────────────
        if (!socket.connected) return;
        try {
          const buf = Buffer.isBuffer(chunk)
            ? chunk
            : typeof chunk === "string"
              ? Buffer.from(chunk, "base64")
              : Buffer.from(chunk);
          chunkCount++;
          socket.emit("tts_audio", { audio: buf.toString("base64") });
        } catch (e) {
          console.error("tts_audio emit:", e);
        }
      })
      .catch((err) => {
        clearTimeout(hardTimeout);
        console.error("❌ speakStream threw:", err);
        try {
          socket.emit("tts_end");
        } catch (_) {}
        settle(err);
      });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// handleSettingsSocket  (mobile / secondary camera)
// ════════════════════════════════════════════════════════════════════════════
async function handleSettingsSocket(socket, interviewId, userId, io, sessions) {
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

  const relay = (data, ack) => {
    session.lastMobileFrame = data.frame;
    if (session.desktopSocketId)
      socket
        .to(`interview_${interviewId}`)
        .emit("mobile_camera_frame", {
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
// handleInterviewSocket  (desktop primary)
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

  const lkToken = await createLiveKitToken(
    `user_${userId}`,
    roomName(interviewId),
  );
  socket.emit("livekit_token", {
    token: lkToken,
    url: LIVEKIT_URL,
    room: roomName(interviewId),
    role: "primary",
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

  let currentOrder = 1;
  let isProcessing = false;
  let isInterviewEnded = false;
  let firstQuestionSent = false;
  let firstQuestion = null;
  let deepgramConn = null;
  let isListeningActive = false; // TRUE only while user should be speaking
  let awaitingRepeat = false;
  let currentQText = "";
  const MAX_Q = 10;

  const MAX_FACE_VIOL = 5;
  const FACE_THROTTLE = 1000;
  const FACE_WINDOW = 3000;
  let lastHolisticTime = 0;
  let faceViolCount = 0;
  let faceFirstMissing = null;
  let faceViolTimeout = null;

  try {
    await Interview.getSessionById(interviewId);
    firstQuestion = await Interview.getQuestionByOrder(
      interviewId,
      currentOrder,
    );
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

    getTTSInstance(interviewId); // warm up TTS

    socket.emit("server_ready", {
      setupMode: session.isSetupMode,
      message: "Server ready",
    });

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

    // ══════════════════════════════════════════════════════════════════════
    // client_ready — start interview
    //
    // FIX 2 (idle fires during TTS):
    //   The old code called ensureDeepgramConnection() which creates the STT
    //   session, then immediately called streamTTSToClient(). But Deepgram was
    //   already running (waiting for audio) and the idle timer started ticking.
    //   After 15 s of silence (while TTS was playing) it fired "repeat?".
    //
    // Fix: stt.service.js now starts with idlePaused=true on every new
    //   connection. resumeIdleDetection() is ONLY called AFTER streamTTSToClient
    //   completes and listening_enabled is emitted. This means idle detection
    //   only runs when the user is genuinely expected to be speaking.
    // ══════════════════════════════════════════════════════════════════════
    socket.on("client_ready", async () => {
      if (firstQuestionSent) return;
      session.isSetupMode = false;
      session.interviewStarted = true;
      isProcessing = true;
      firstQuestionSent = true;
      currentQText = firstQuestion.question;

      try {
        // Emit question text to UI immediately (shows while TTS loads)
        socket.emit("question", { question: firstQuestion.question });

        // Open Deepgram — starts PAUSED (idle timer off)
        await ensureDeepgramConn();

        // Start egress in parallel — don't block
        startCompositeEgress(
          interviewId,
          `/recordings/${interviewId}/composite.mp4`,
        )
          .then((id) => {
            if (id) session.compositeEgressId = id;
          })
          .catch(console.error);

        // Stream TTS — Deepgram is paused so idle won't fire
        await streamTTSToClient(socket, firstQuestion.question, interviewId);
        // ↑ tts_end has been emitted to client here

        // NOW open mic and start idle countdown
        isListeningActive = true;
        isProcessing = false;
        socket.emit("listening_enabled");
        deepgramConn?.resumeIdleDetection?.(); // ← idle timer starts HERE
        console.log(`✅ Listening for Q${currentOrder} answer`);
      } catch (err) {
        console.error("❌ client_ready:", err);
        socket.emit("error", { message: "Failed to start" });
        isProcessing = false;
        firstQuestionSent = false;
        session.interviewStarted = false;
      }
    });

    // ── LiveKit track events ───────────────────────────────────────────────
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
      if (identity?.startsWith("mobile_") && !session.mobileEgressId) {
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
          console.log(`🎬 Mobile egress: ${eg.egressId}`);
        } catch (e) {
          console.error("❌ Mobile egress:", e.message);
        }
      }
    });

    // ── Recording acks ─────────────────────────────────────────────────────
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

    // ── Secondary camera relay ─────────────────────────────────────────────
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
        socket
          .to(`interview_${interviewId}`)
          .emit("mobile_camera_frame", {
            frame: data.frame,
            timestamp: data.timestamp ?? Date.now(),
          });
      if (typeof ack === "function") ack();
    };
    socket.on("mobile_camera_frame", relayMobile);
    socket.on("security_frame_request", relayMobile);

    // ── Audio / STT ────────────────────────────────────────────────────────
    let lastNoConnWarn = 0;
    socket.on("user_audio_chunk", (buf) => {
      if (
        session.isSetupMode ||
        !session.interviewStarted ||
        !isListeningActive
      )
        return;
      if (!deepgramConn) {
        const now = Date.now();
        if (now - lastNoConnWarn > 5000) {
          console.warn("⚠️ No Deepgram conn");
          lastNoConnWarn = now;
        }
        return;
      }
      deepgramConn.send(buf);
    });

    socket.on("agent_transcript", async (data) => {
      if (!data?.text?.trim() || !isListeningActive || isProcessing) return;
      socket.emit("transcript_received", { text: data.text });
      isListeningActive = false;
      deepgramConn?.pauseIdleDetection?.();
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

    // ── Face detection ─────────────────────────────────────────────────────
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
          await safeViolation(
            "MULTIPLE_FACES",
            `${faceCount} faces`,
            timestamp,
          );
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
      destroyDeepgramConn();
      if (faceViolTimeout) {
        clearTimeout(faceViolTimeout);
        faceViolTimeout = null;
      }
      isProcessing = isListeningActive = false;
    });

    socket.on("error", (e) => console.error("❌ socket error:", e));

    // ════════════════════════════════════════════════════════════════════════
    // ensureDeepgramConn — creates or reuses the STT connection.
    //
    // The new connection from stt.service.js starts with idlePaused=true.
    // We NEVER call resumeIdleDetection() here — only transitionToNextQuestion
    // (and client_ready) call it, AFTER TTS finishes.
    // ════════════════════════════════════════════════════════════════════════
    function ensureDeepgramConn() {
      if (deepgramConn?.isConnected?.()) {
        deepgramConn.resetTranscriptState?.();
        return Promise.resolve(deepgramConn);
      }
      if (deepgramConn) {
        try {
          deepgramConn.finish();
        } catch (_) {}
        deepgramConn = null;
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
            deepgramConn?.pauseIdleDetection?.();
            socket.emit("transcript_received", { text });
            awaitingRepeat
              ? await handleRepeat(text)
              : await processTranscript(text);
          },
          onInterim: (t) => {
            if (t?.trim()) socket.emit("interim_transcript", { text: t });
          },
          onError: (e) => {
            console.error("❌ Deepgram:", e);
            if (!done) {
              done = true;
              clearTimeout(timer);
              reject(e);
            }
          },
          onClose: () => {
            console.warn("⚠️ Deepgram closed");
            deepgramConn = null;
          },
          onIdle: async () => {
            // Only fires when isListeningActive AND IDLE_TIMEOUT_MS silence
            // NEVER fires during TTS because idlePaused=true during playback
            if (isListeningActive && !isProcessing) await handleIdle();
          },
        });

        deepgramConn = conn;
        conn
          .waitForReady?.(8000)
          .then(() => {
            if (!done) {
              done = true;
              clearTimeout(timer);
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

    function destroyDeepgramConn() {
      if (!deepgramConn) return;
      try {
        deepgramConn.pauseIdleDetection?.();
      } catch (_) {}
      try {
        deepgramConn.finish();
      } catch (_) {}
      deepgramConn = null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // transitionToNextQuestion
    //
    // Pattern for EVERY question transition:
    //   1. pauseIdleDetection()   ← must be BEFORE TTS
    //   2. streamTTSToClient()    ← tts_end fired when complete
    //   3. resumeIdleDetection()  ← idle timer starts AFTER TTS done
    // ════════════════════════════════════════════════════════════════════════
    async function transitionToNextQuestion(text) {
      try {
        await ensureDeepgramConn();

        // PAUSE before TTS — prevents idle firing during playback
        deepgramConn?.pauseIdleDetection?.();
        isListeningActive = false;

        await streamTTSToClient(socket, text, interviewId);
        // ↑ tts_end emitted here

        // RESUME after TTS — idle countdown starts now
        isListeningActive = true;
        isProcessing = false;
        socket.emit("listening_enabled");
        deepgramConn?.resumeIdleDetection?.();
      } catch (err) {
        console.error("❌ transition:", err);
        socket.emit("error", { message: "Speech error" });
        isProcessing = false;
      }
    }

    async function handleIdle() {
      deepgramConn?.pauseIdleDetection?.();
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

        if (currentOrder >= MAX_Q) {
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
        currentOrder = nextOrder;
        currentQText = nextQ.question;
        awaitingRepeat = false;
        socket.emit("next_question", { question: nextQ.question });
        await transitionToNextQuestion(nextQ.question);
      } catch (err) {
        console.error("❌ processTranscript:", err);
        isProcessing = false;
      }
    }

    async function handleRepeat(text) {
      const lower = text.toLowerCase();
      const yes = ["yes", "yeah", "sure", "repeat", "again", "please"].some(
        (w) => lower.includes(w),
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
      socket.emit("listening_disabled");
      socket.emit("interview_complete", {
        message: "Interview complete!",
        totalQuestions: currentOrder,
      });
      destroyDeepgramConn();
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
            .catch((e) =>
              socket.emit("media_merge_error", { error: e.message }),
            );
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
  } catch (err) {
    console.error("❌ FATAL handleInterviewSocket:", err);
    socket.emit("error", { message: "Failed to initialize" });
    socket.disconnect();
  }
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
