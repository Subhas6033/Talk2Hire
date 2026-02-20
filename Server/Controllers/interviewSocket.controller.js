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
// streamTTSToClient
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
          clearTimeout(hardTimeout);
          try {
            socket.emit("tts_end");
          } catch (e) {
            console.error("tts_end emit:", e);
          }
          console.log(`🔊 tts_end sent (${chunkCount} chunks)`);
          settle();
          return;
        }
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
  await ensureRoom(interviewId);
  const session = getOrCreate(sessions, interviewId);
  socket.join(`interview_${interviewId}`);
  session.mobileSocketId = socket.id;

  // Issue token immediately so mobile can join the LiveKit room
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

  // If already connected from a previous attempt, tell mobile immediately
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

  // Mobile emits this after its socket connects — marks camera as active
  // and notifies the desktop (which may already be in the interview room)
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
// handleInterviewSocket  (desktop primary)
// ════════════════════════════════════════════════════════════════════════════
async function handleInterviewSocket(
  socket,
  interviewId,
  userId,
  io,
  sessions,
) {
  await ensureRoom(interviewId);
  console.log("🔑 LIVEKIT_URL:", LIVEKIT_URL); // ← ADD
  console.log("🔑 API_KEY exists:", !!LIVEKIT_API_KEY);
  const session = getOrCreate(sessions, interviewId);
  session.desktopSocketId = socket.id;
  socket.join(`interview_${interviewId}`);
  console.log(`🖥️ Desktop socket: ${socket.id}`);

  const lkToken = await createLiveKitToken(
    `user_${userId}`,
    roomName(interviewId),
  );

  console.log("🔑 Token generated, emitting to desktop:", lkToken.slice(0, 30));

  socket.emit("livekit_token", {
    token: lkToken,
    url: LIVEKIT_URL,
    room: roomName(interviewId),
    role: "primary",
  });

  // If mobile already connected before desktop loaded, push status immediately
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

  let currentOrder = session.currentOrder ?? 1;
  let isProcessing = false;
  let isInterviewEnded = false;
  let firstQuestion = null;
  let deepgramConn = null;
  let isListeningActive = false;
  let awaitingRepeat = false;
  let currentQText = session.currentQText ?? "";
  const MAX_Q = 10;

  const MAX_FACE_VIOL = 5;
  const FACE_THROTTLE = 1000;
  const FACE_WINDOW = 3000;
  let lastHolisticTime = 0;
  let faceViolCount = 0;
  let faceFirstMissing = null;
  let faceViolTimeout = null;

  let awaitingPlaybackDone = false;
  let clientReadyHandled = false;

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

    socket.on("client_ready", async () => {
      if (clientReadyHandled) {
        console.log(
          "⚠️ client_ready already handled on this socket — ignoring",
        );
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
            console.warn(
              "⚠️ playback_done timeout (35s) — enabling STT anyway",
            );
            enableListeningAfterPlayback();
          }, 35_000);
          console.log(
            `⏳ Waiting for playback_done (reconnect Q${currentOrder})`,
          );
        } catch (err) {
          console.error("❌ reconnect resume:", err);
          isProcessing = false;
          awaitingPlaybackDone = false;
        }
        return;
      }

      if (session.interviewStarted) {
        console.log("🔄 Stale Q1 session detected — resetting for fresh start");
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
          console.warn("⚠️ playback_done timeout (35s) — enabling STT anyway");
          enableListeningAfterPlayback();
        }, 35_000);
        console.log(`⏳ Waiting for playback_done (Q${currentOrder})`);
      } catch (err) {
        console.error("❌ client_ready:", err);
        socket.emit("error", { message: "Failed to start" });
        isProcessing = false;
        session.interviewStarted = false;
        awaitingPlaybackDone = false;
      }
    });

    let playbackDoneTimer = null;

    const enableListeningAfterPlayback = async () => {
      if (playbackDoneTimer) {
        clearTimeout(playbackDoneTimer);
        playbackDoneTimer = null;
      }
      if (isInterviewEnded || !session.interviewStarted) return;
      if (!awaitingPlaybackDone) return;
      if (isListeningActive) return;

      awaitingPlaybackDone = false;
      destroyDeepgramConn();

      let attempts = 0;
      while (attempts < 4) {
        attempts++;
        try {
          await ensureDeepgramConn();
        } catch (err) {
          console.error(
            `❌ STT connect attempt ${attempts} failed:`,
            err.message,
          );
          if (attempts >= 4) {
            socket.emit("error", {
              message: "STT connection failed, please refresh.",
            });
            return;
          }
          await new Promise((r) => setTimeout(r, 600 * attempts));
          continue;
        }

        const connSnapshot = deepgramConn;
        await new Promise((r) => setTimeout(r, 500));

        if (connSnapshot?.isConnected?.()) {
          deepgramConn = connSnapshot;
          break;
        }

        console.warn(
          `⚠️ Deepgram closed immediately (attempt ${attempts}) — retrying`,
        );
        deepgramConn = null;
        if (attempts >= 4) {
          socket.emit("error", {
            message: "STT connection failed, please refresh.",
          });
          return;
        }
        await new Promise((r) => setTimeout(r, 600 * attempts));
      }

      if (!deepgramConn?.isConnected?.()) {
        console.error("❌ Deepgram not connected after 4 attempts");
        socket.emit("error", {
          message: "STT connection failed, please refresh.",
        });
        return;
      }

      isListeningActive = true;
      isProcessing = false;
      socket.emit("listening_enabled");
      deepgramConn.resumeIdleDetection();
      console.log(`✅ Listening for Q${currentOrder}`);
    };

    socket.on("playback_done", () => {
      console.log(
        `🔊 playback_done received (awaitingPlaybackDone=${awaitingPlaybackDone} isListeningActive=${isListeningActive})`,
      );
      enableListeningAfterPlayback();
    });

    // ── LiveKit track events ──────────────────────────────────────────────
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

    // ── FIXED: single livekit_participant_joined handler ──────────────────
    // Handles BOTH the status broadcast AND egress start in one place.
    // Previously two separate handlers existed causing the egress block to
    // be empty in the first and the broadcast to be missing in the second.
    socket.on("livekit_participant_joined", async ({ identity }) => {
      console.log(`👤 livekit_participant_joined: ${identity}`);

      if (identity?.startsWith("mobile_")) {
        // 1. Update session state
        session.secondaryCameraConnected = true;

        // 2. Notify ALL sockets in the room (desktop included) so the
        //    InterviewLive UI updates mobileCameraConnected state immediately
        io.to(`interview_${interviewId}`).emit("secondary_camera_ready", {
          connected: true,
          timestamp: Date.now(),
        });
        io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
          connected: true,
          metadata: session.secondaryCameraMetadata,
        });

        // 3. Start mobile egress if not already running
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

    // ── Recording acks ────────────────────────────────────────────────────
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

    // ── Secondary camera relay ────────────────────────────────────────────
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

    // ── Audio / STT ───────────────────────────────────────────────────────
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
          console.warn("⚠️ No Deepgram conn — audio dropped");
          lastNoConnWarn = now;
        }
        return;
      }
      if (!deepgramConn.isConnected?.()) {
        console.warn(
          "⚠️ Deepgram conn exists but not connected — audio dropped",
        );
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

    // ── Face detection ────────────────────────────────────────────────────
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
      if (playbackDoneTimer) {
        clearTimeout(playbackDoneTimer);
        playbackDoneTimer = null;
      }
      isProcessing = isListeningActive = awaitingPlaybackDone = false;
    });

    socket.on("error", (e) => console.error("❌ socket error:", e));

    // ════════════════════════════════════════════════════════════════════════
    // ensureDeepgramConn
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
            console.log(
              `📝 onTranscript fired: "${text?.slice(0, 50)}" isListening=${isListeningActive} isProcessing=${isProcessing}`,
            );
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
            console.warn("⚠️ Deepgram connection closed");
            if (deepgramConn === conn) deepgramConn = null;
          },
          onIdle: async () => {
            console.log(
              `⏱️ Deepgram idle fired — isListeningActive=${isListeningActive} isProcessing=${isProcessing}`,
            );
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
    // ════════════════════════════════════════════════════════════════════════
    async function transitionToNextQuestion(text) {
      try {
        deepgramConn?.pauseIdleDetection?.();
        isListeningActive = false;
        awaitingPlaybackDone = true;

        await streamTTSToClient(socket, text, interviewId);

        if (playbackDoneTimer) clearTimeout(playbackDoneTimer);
        playbackDoneTimer = setTimeout(() => {
          console.warn("⚠️ playback_done timeout (35s) — enabling STT anyway");
          enableListeningAfterPlayback();
        }, 35_000);
        console.log(`⏳ Waiting for playback_done (Q${currentOrder})`);
      } catch (err) {
        console.error("❌ transition:", err);
        socket.emit("error", { message: "Speech error" });
        isProcessing = false;
        awaitingPlaybackDone = false;
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
        `🗣️ processTranscript: "${text?.slice(0, 50)}" order=${currentOrder}`,
      );
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
        session.currentOrder = currentOrder;
        session.currentQText = currentQText;
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
