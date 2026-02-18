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

// ─── LiveKit config ──────────────────────────────────────────────────────────
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

// ─── TTS cache ───────────────────────────────────────────────────────────────
const ttsInstanceCache = new Map();
function getTTSInstance(interviewId) {
  if (!ttsInstanceCache.has(interviewId)) {
    ttsInstanceCache.set(interviewId, createTTSStream());
  }
  return ttsInstanceCache.get(interviewId);
}

// ─── Token helpers ────────────────────────────────────────────────────────────
function createLiveKitToken(identity, roomName, grants = {}) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    ...grants,
  });
  return at.toJwt();
}
const roomName = (id) => `interview_${id}`;

// ─── Egress helpers ───────────────────────────────────────────────────────────
async function startCompositeEgress(interviewId, filepath) {
  try {
    const output = new EncodedFileOutput({ filepath, fileType: 2 }); // MP4
    const egress = await egressClient.startRoomCompositeEgress(
      roomName(interviewId),
      { file: output },
      { layout: "grid", audioOnly: false },
    );
    console.log(`🎬 Composite egress: ${egress.egressId}`);
    return egress.egressId;
  } catch (err) {
    console.error("❌ Composite egress failed:", err.message);
    return null;
  }
}

async function stopEgress(egressId) {
  if (!egressId) return;
  try {
    await egressClient.stopEgress(egressId);
  } catch (_) {}
}

// ─── Main export ──────────────────────────────────────────────────────────────
function initInterviewSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN, methods: ["GET", "POST"] },
    transports: ["websocket"],
    maxHttpBufferSize: 1 * 1024 * 1024,
    pingTimeout: 60000,
    pingInterval: 25000,
    perMessageDeflate: false,
    httpCompression: false,
    connectTimeout: 45000,
  });

  const interviewSessions = new Map();

  function getOrCreateSession(interviewId) {
    if (!interviewSessions.has(interviewId)) {
      interviewSessions.set(interviewId, {
        livekitRoomName: roomName(interviewId),
        compositeEgressId: null,
        screenEgressId: null,
        mobileEgressId: null,
        desktopSocketId: null,
        mobileSocketId: null,
        secondaryCameraConnected: false,
        secondaryCameraMetadata: null,
        lastMobileFrame: null,
        lastMobileFrameTimestamp: null,
        isSetupMode: true,
        interviewStarted: false,
      });
    }
    return interviewSessions.get(interviewId);
  }

  function cleanupSession(interviewId) {
    interviewSessions.delete(interviewId);
    ttsInstanceCache.delete(interviewId);
    roomService.deleteRoom(roomName(interviewId)).catch(() => {});
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SETTINGS SOCKET  (mobile / secondary camera)
  // ══════════════════════════════════════════════════════════════════════════
  function handleSettingsSocket(socket, interviewId, userId) {
    const session = getOrCreateSession(interviewId);
    socket.join(`interview_${interviewId}`);
    session.mobileSocketId = socket.id;

    socket.emit("livekit_token", {
      token: createLiveKitToken(`mobile_${userId}`, roomName(interviewId)),
      url: LIVEKIT_URL,
      room: roomName(interviewId),
      role: "secondary_camera",
    });

    socket.on("secondary_camera_connected", (data) => {
      session.secondaryCameraConnected = true;
      session.secondaryCameraMetadata = {
        connectedAt: new Date(data.timestamp),
        angle: data.angle || null,
        angleQuality: data.angleQuality || null,
      };
      const payload = { connected: true, timestamp: Date.now() };
      socket.emit("secondary_camera_ready", payload);
      socket
        .to(`interview_${interviewId}`)
        .emit("secondary_camera_ready", payload);
      io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
        connected: true,
        metadata: session.secondaryCameraMetadata,
      });
    });

    const relayFrame = (data, ack) => {
      session.lastMobileFrame = data.frame;
      session.lastMobileFrameTimestamp = data.timestamp || Date.now();
      socket.to(`interview_${interviewId}`).emit("mobile_camera_frame", {
        frame: data.frame,
        timestamp: data.timestamp || Date.now(),
      });
      if (typeof ack === "function") ack();
    };
    socket.on("mobile_camera_frame", relayFrame);
    socket.on("security_frame_request", relayFrame);

    socket.on("request_secondary_camera_status", () => {
      if (!session.secondaryCameraConnected) return;
      socket.emit("secondary_camera_ready", {
        connected: true,
        timestamp: Date.now(),
      });
      socket.emit("secondary_camera_status", {
        connected: true,
        metadata: session.secondaryCameraMetadata,
      });
      if (session.lastMobileFrame)
        socket.emit("mobile_camera_frame", {
          frame: session.lastMobileFrame,
          timestamp: session.lastMobileFrameTimestamp || Date.now(),
        });
    });

    socket.on("disconnect", () => {
      if (session.mobileSocketId === socket.id) session.mobileSocketId = null;
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INTERVIEW SOCKET  (desktop)
  // ══════════════════════════════════════════════════════════════════════════
  async function handleInterviewSocket(socket, interviewId, userId) {
    const session = getOrCreateSession(interviewId);
    session.desktopSocketId = socket.id;
    socket.join(`interview_${interviewId}`);

    // ── ① Emit LiveKit token IMMEDIATELY (before any await) ─────────────────
    // This lets the browser start the WebRTC handshake while we hit the DB.
    socket.emit("livekit_token", {
      token: createLiveKitToken(`user_${userId}`, roomName(interviewId)),
      url: LIVEKIT_URL,
      room: roomName(interviewId),
      role: "primary",
    });

    // Relay secondary camera state if already connected
    if (session.secondaryCameraConnected) {
      socket.emit("secondary_camera_ready", {
        interviewId,
        timestamp: Date.now(),
      });
      socket.emit("secondary_camera_status", {
        connected: true,
        metadata: session.secondaryCameraMetadata,
      });
      if (session.lastMobileFrame)
        socket.emit("mobile_camera_frame", {
          frame: session.lastMobileFrame,
          timestamp: session.lastMobileFrameTimestamp || Date.now(),
        });
    }

    // ── Per-socket state ─────────────────────────────────────────────────────
    let currentOrder = 1;
    let isProcessing = false;
    let isInterviewEnded = false;
    let firstQuestionSent = false;
    let firstQuestion = null;
    let deepgramConnection = null;
    let isListeningActive = false;
    let awaitingRepeatResponse = false;
    let currentQuestionText = "";
    const MAX_QUESTIONS = 10;

    // Face-violation state
    const MAX_FACE_VIOLATIONS = 5;
    const FACE_DETECTION_THROTTLE_MS = 1000;
    const FACE_VIOLATION_WINDOW_MS = 3000;
    let lastHolisticTime = 0;
    let faceViolationCount = 0;
    let faceFirstMissingAt = null;
    let faceViolationTimeout = null;

    // ── ② DB queries in parallel with the browser's LiveKit handshake ────────
    try {
      await Interview.getSessionById(interviewId);
      firstQuestion = await Interview.getQuestionByOrder(
        interviewId,
        currentOrder,
      );

      if (!firstQuestion) {
        const defaultQ =
          "Hello! Let's start with an introduction. Can you tell me about yourself, " +
          "your background, and what brings you here today?";
        await Interview.saveQuestion({
          interviewId,
          question: defaultQ,
          questionOrder: currentOrder,
          technology: null,
          difficulty: "easy",
        });
        firstQuestion = await Interview.getQuestionByOrder(
          interviewId,
          currentOrder,
        );
      }
      if (!firstQuestion) {
        socket.emit("error", {
          message: "Failed to initialize interview questions",
        });
        return socket.disconnect();
      }

      // Pre-warm TTS instance (avoids first-question cold start)
      getTTSInstance(interviewId);

      // ── server_ready ───────────────────────────────────────────────────────
      setTimeout(() => {
        socket.emit("server_ready", {
          setupMode: session.isSetupMode,
          message: "Server ready",
        });
      }, 50);

      // ══════════════════════════════════════════════════════════════════════
      // SETUP MODE
      // ══════════════════════════════════════════════════════════════════════
      socket.on("setup_mode", () => {
        session.isSetupMode = true;
        session.interviewStarted = false;
        socket.emit("server_ready", {
          setupMode: true,
          message: "Server ready in setup mode",
        });
      });

      // ══════════════════════════════════════════════════════════════════════
      // CLIENT READY
      // ══════════════════════════════════════════════════════════════════════
      socket.on("client_ready", async () => {
        if (firstQuestionSent) return; // idempotent
        session.isSetupMode = false;
        session.interviewStarted = true;

        try {
          isProcessing = true;
          firstQuestionSent = true;
          currentQuestionText = firstQuestion.question;
          socket.emit("question", { question: firstQuestion.question });

          // ── Start egress + Deepgram in parallel with TTS ─────────────────
          const [egressResult, _dgResult] = await Promise.allSettled([
            startCompositeEgress(
              interviewId,
              `/recordings/${interviewId}/composite.mp4`,
            ),
            startDeepgramConnection(),
          ]);

          if (egressResult.status === "fulfilled")
            session.compositeEgressId = egressResult.value;

          // Ensure Deepgram is up; retry once if needed
          if (!deepgramConnection?.isConnected())
            await startDeepgramConnection();

          // Stream TTS — audio flows to browser while Deepgram warms up
          await streamTTSToClient(socket, firstQuestion.question, interviewId);

          isListeningActive = true;
          socket.emit("listening_enabled");
          if (deepgramConnection) deepgramConnection.resumeIdleDetection?.();
          isProcessing = false;
          console.log(`🎬 Interview started – ${interviewId}`);
        } catch (err) {
          console.error("❌ Failed to start interview:", err);
          socket.emit("error", {
            message: "Failed to start interview",
            error: err.message,
          });
          isProcessing = false;
          firstQuestionSent = false;
          session.interviewStarted = false;
        }
      });

      // ══════════════════════════════════════════════════════════════════════
      // LIVEKIT TRACK EVENTS
      // ══════════════════════════════════════════════════════════════════════
      socket.on("livekit_track_published", async (data) => {
        if (data.source === "screen_share" && !session.screenEgressId) {
          try {
            const { EncodedFileOutput: EFO } = require("livekit-server-sdk");
            const output = new EFO({
              filepath: `/recordings/${interviewId}/screen.mp4`,
              fileType: 2,
            });
            const egress = await egressClient.startTrackCompositeEgress(
              roomName(interviewId),
              { file: output },
              { videoTrackId: data.trackSid },
            );
            session.screenEgressId = egress.egressId;
            socket.emit("screen_recording_started", {
              egressId: egress.egressId,
            });
          } catch (err) {
            console.error("❌ Screen egress failed:", err.message);
          }
        }
      });

      socket.on("livekit_track_unpublished", async (data) => {
        if (data.source === "screen_share" && session.screenEgressId) {
          await stopEgress(session.screenEgressId);
          session.screenEgressId = null;
        }
      });

      socket.on("livekit_participant_joined", async ({ identity }) => {
        if (identity?.startsWith("mobile_") && !session.mobileEgressId) {
          try {
            const { EncodedFileOutput: EFO } = require("livekit-server-sdk");
            const output = new EFO({
              filepath: `/recordings/${interviewId}/mobile.mp4`,
              fileType: 2,
            });
            const egress = await egressClient.startParticipantCompositeEgress(
              roomName(interviewId),
              { file: output },
              { identity },
            );
            session.mobileEgressId = egress.egressId;
          } catch (err) {
            console.error("❌ Mobile egress failed:", err.message);
          }
        }
      });

      // ══════════════════════════════════════════════════════════════════════
      // SECONDARY CAMERA RELAY
      // ══════════════════════════════════════════════════════════════════════
      socket.on("secondary_camera_connected", (data) => {
        session.secondaryCameraConnected = true;
        session.secondaryCameraMetadata = {
          connectedAt: new Date(data.timestamp),
          angle: data.angle || null,
        };
        io.to(`interview_${interviewId}`).emit("secondary_camera_ready", {
          interviewId: data.interviewId,
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
        });
      });

      const relayMobileFrame = (data, ack) => {
        session.lastMobileFrame = data.frame;
        session.lastMobileFrameTimestamp = data.timestamp || Date.now();
        socket.to(`interview_${interviewId}`).emit("mobile_camera_frame", {
          frame: data.frame,
          timestamp: data.timestamp || Date.now(),
        });
        if (typeof ack === "function") ack();
      };
      socket.on("mobile_camera_frame", relayMobileFrame);
      socket.on("security_frame_request", relayMobileFrame);

      socket.on("request_secondary_camera_status", () => {
        if (session.secondaryCameraConnected)
          socket.emit("secondary_camera_ready", {
            interviewId,
            timestamp: Date.now(),
          });
      });

      // ══════════════════════════════════════════════════════════════════════
      // AUDIO  (legacy socket PCM fallback)
      // ══════════════════════════════════════════════════════════════════════
      let lastNoConnWarn = 0;
      socket.on("user_audio_chunk", (audioData) => {
        if (
          session.isSetupMode ||
          !session.interviewStarted ||
          !isListeningActive
        )
          return;
        if (!deepgramConnection) {
          const now = Date.now();
          if (now - lastNoConnWarn > 5000) {
            console.warn(`⚠️ No Deepgram for ${interviewId}`);
            lastNoConnWarn = now;
          }
          return;
        }
        deepgramConnection.send(audioData);
      });

      // LiveKit agent transcript
      socket.on("agent_transcript", async (data) => {
        if (!data?.text?.trim() || !isListeningActive || isProcessing) return;
        socket.emit("transcript_received", { text: data.text });
        isListeningActive = false;
        deepgramConnection?.pauseIdleDetection?.();
        if (awaitingRepeatResponse) await handleRepeatResponse(data.text);
        else await processUserTranscript(data.text);
      });

      socket.on("agent_interim", (data) => {
        if (data?.text?.trim())
          socket.emit("interim_transcript", { text: data.text });
      });

      socket.on("agent_idle", async () => {
        if (isListeningActive && !isProcessing) await handleIdle();
      });

      // ══════════════════════════════════════════════════════════════════════
      // FACE DETECTION
      // ══════════════════════════════════════════════════════════════════════
      socket.on(
        "holistic_detection_result",
        async ({ hasFace, faceCount, timestamp }) => {
          if (session.isSetupMode || !session.interviewStarted) return;
          const now = Date.now();
          if (now - lastHolisticTime < FACE_DETECTION_THROTTLE_MS) return;
          lastHolisticTime = now;

          try {
            if (faceCount === 0) {
              if (faceFirstMissingAt === null) {
                faceFirstMissingAt = now;
                return;
              }
              const absent = now - faceFirstMissingAt;
              if (absent < FACE_VIOLATION_WINDOW_MS) return;

              faceViolationCount++;
              socket.emit("face_violation", {
                type: "NO_FACE",
                count: faceViolationCount,
                max: MAX_FACE_VIOLATIONS,
                message: `No face detected — ${MAX_FACE_VIOLATIONS - faceViolationCount} warning(s) remaining`,
              });

              if (faceViolationCount >= MAX_FACE_VIOLATIONS) {
                socket.emit("interview_terminated", {
                  reason: "NO_FACE_DETECTED",
                });
                await safeRecordViolation(
                  "NO_FACE",
                  `Face absent ${Math.round(absent / 1000)}s`,
                  timestamp,
                );
                await endInterview();
              }
            } else if (faceCount > 1) {
              socket.emit("interview_terminated", {
                reason: "MULTIPLE_FACES",
                faceCount,
              });
              await safeRecordViolation(
                "MULTIPLE_FACES",
                `${faceCount} faces`,
                timestamp,
              );
              await endInterview();
            } else {
              faceFirstMissingAt = null;
              if (faceViolationCount > 0) {
                if (faceViolationTimeout) clearTimeout(faceViolationTimeout);
                faceViolationTimeout = setTimeout(() => {
                  faceViolationCount = 0;
                  socket.emit("face_violation_cleared");
                }, 2000);
              }
            }
          } catch (err) {
            console.error("❌ holistic_detection_result:", err.message);
          }
        },
      );

      // ══════════════════════════════════════════════════════════════════════
      // DISCONNECT
      // ══════════════════════════════════════════════════════════════════════
      socket.on("disconnect", () => {
        if (session.desktopSocketId === socket.id)
          session.desktopSocketId = null;
        if (deepgramConnection) {
          try {
            deepgramConnection.pauseIdleDetection?.();
          } catch (_) {}
          try {
            deepgramConnection.finish();
          } catch (_) {}
          deepgramConnection = null;
        }
        if (faceViolationTimeout) {
          clearTimeout(faceViolationTimeout);
          faceViolationTimeout = null;
        }
        isProcessing = false;
        isListeningActive = false;
      });

      socket.on("error", (err) => console.error("❌ Socket error:", err));

      // ══════════════════════════════════════════════════════════════════════
      // INTERVIEW FLOW HELPERS
      // ══════════════════════════════════════════════════════════════════════

      /**
       * Create / reuse a Deepgram connection.
       * If one is already connected and active, reset its transcript state
       * and return it — no reconnect needed.
       */
      function startDeepgramConnection() {
        // Reuse existing connection — just reset transcript state
        if (deepgramConnection?.isConnected?.()) {
          deepgramConnection.resetTranscriptState?.();
          return Promise.resolve(deepgramConnection);
        }

        // Clean up dead connection
        if (deepgramConnection) {
          try {
            deepgramConnection.finish();
          } catch (_) {}
          deepgramConnection = null;
        }

        return new Promise((resolve, reject) => {
          let hasResolved = false;
          let hasTranscript = false;

          const timeout = setTimeout(() => {
            if (!hasResolved) {
              hasResolved = true;
              reject(new Error("Deepgram timeout"));
            }
          }, 5000);

          const connection = createSTTSession().startLiveTranscription({
            onTranscript: async (transcript) => {
              if (
                !transcript?.trim() ||
                !isListeningActive ||
                isProcessing ||
                hasTranscript
              )
                return;
              hasTranscript = true;
              isListeningActive = false;
              deepgramConnection?.pauseIdleDetection?.();
              socket.emit("transcript_received", { text: transcript });
              // ⚠️ Do NOT finish deepgramConnection here — keep it alive for next question
              if (awaitingRepeatResponse)
                await handleRepeatResponse(transcript);
              else await processUserTranscript(transcript);
            },
            onInterim: (t) => {
              if (t?.trim()) socket.emit("interim_transcript", { text: t });
            },
            onError: (err) => {
              console.error("❌ Deepgram error:", err);
              if (!hasResolved) {
                clearTimeout(timeout);
                hasResolved = true;
                reject(err);
              }
            },
            onClose: () => {
              deepgramConnection = null;
            },
            onIdle: async () => {
              if (isListeningActive && !isProcessing) await handleIdle();
            },
          });

          connection.resetTranscriptState = () => {
            hasTranscript = false;
          };
          deepgramConnection = connection;

          if (connection.waitForReady) {
            connection
              .waitForReady(5000)
              .then(() => {
                if (!hasResolved) {
                  clearTimeout(timeout);
                  hasResolved = true;
                  resolve(connection);
                }
              })
              .catch((err) => {
                if (!hasResolved) {
                  clearTimeout(timeout);
                  hasResolved = true;
                  reject(err);
                }
              });
          } else {
            clearTimeout(timeout);
            hasResolved = true;
            resolve(connection);
          }
        });
      }

      /**
       * Transition to a new question:
       * 1. Reset Deepgram transcript state (reuse connection)
       * 2. Stream TTS
       * 3. Enable listening
       */
      async function transitionToNextQuestion(questionText, _ctx) {
        try {
          // Reset transcript state without reconnecting
          if (deepgramConnection?.isConnected?.()) {
            deepgramConnection.resetTranscriptState?.();
            deepgramConnection.pauseIdleDetection?.();
          } else {
            // Connection dropped — reconnect
            await startDeepgramConnection();
          }

          await streamTTSToClient(socket, questionText, interviewId);

          deepgramConnection?.resumeIdleDetection?.();
          isListeningActive = true;
          socket.emit("listening_enabled");
          isProcessing = false;
        } catch (err) {
          console.error("❌ transitionToNextQuestion:", err);
          socket.emit("error", { message: "Speech recognition unavailable" });
          isProcessing = false;
        }
      }

      async function handleIdle() {
        deepgramConnection?.pauseIdleDetection?.();
        if (awaitingRepeatResponse) {
          awaitingRepeatResponse = false;
          isListeningActive = false;
          socket.emit("listening_disabled");
          await moveToNextQuestion();
        } else {
          awaitingRepeatResponse = true;
          isListeningActive = false;
          socket.emit("listening_disabled");
          const prompt = "Can I repeat the question?";
          socket.emit("idle_prompt", { text: prompt });
          await transitionToNextQuestion(prompt, "handleIdle");
        }
      }

      async function moveToNextQuestion() {
        if (isProcessing) return;
        isProcessing = true;
        try {
          if (currentOrder >= MAX_QUESTIONS) {
            await endInterview();
            return;
          }
          const nextOrder = currentOrder + 1;
          const text = await generateNextQuestionWithAI({
            answer: "No response provided",
            questionOrder: nextOrder,
            previousQuestion: currentQuestionText,
          });
          await Interview.saveQuestion({
            interviewId,
            question: text,
            questionOrder: nextOrder,
            technology: null,
            difficulty: null,
          });
          currentOrder = nextOrder;
          currentQuestionText = text;
          socket.emit("next_question", { question: text });
          await transitionToNextQuestion(text, "moveToNextQuestion");
        } catch (err) {
          console.error("❌ moveToNextQuestion:", err);
          socket.emit("error", { message: "Error loading next question" });
          isProcessing = false;
        }
      }

      async function processUserTranscript(text) {
        if (isInterviewEnded || isProcessing) return;
        isProcessing = true;
        isListeningActive = false;
        socket.emit("listening_disabled");

        try {
          const currentQuestion = await Interview.getQuestionByOrder(
            interviewId,
            currentOrder,
          );
          if (!currentQuestion) {
            socket.emit("error", { message: "Question not found" });
            isProcessing = false;
            return;
          }
          if (currentOrder >= MAX_QUESTIONS) {
            await Interview.saveAnswer({
              interviewId,
              questionId: currentQuestion.id,
              answer: text,
            });
            await endInterview();
            return;
          }

          const nextOrder = currentOrder + 1;
          const [_, nextQ] = await Promise.all([
            Interview.saveAnswer({
              interviewId,
              questionId: currentQuestion.id,
              answer: text,
            }),
            (async () => {
              let q = await Interview.getQuestionByOrder(
                interviewId,
                nextOrder,
              );
              if (!q) {
                const generated = await generateNextQuestionWithAI({
                  answer: text,
                  questionOrder: nextOrder,
                  previousQuestion: currentQuestion.question,
                });
                await Interview.saveQuestion({
                  interviewId,
                  question: generated,
                  questionOrder: nextOrder,
                  technology: null,
                  difficulty: null,
                });
                q = await Interview.getQuestionByOrder(interviewId, nextOrder);
              }
              return q;
            })(),
          ]);

          currentOrder = nextOrder;
          currentQuestionText = nextQ.question;
          socket.emit("next_question", { question: nextQ.question });
          await transitionToNextQuestion(
            nextQ.question,
            "processUserTranscript",
          );
        } catch (err) {
          console.error("❌ processUserTranscript:", err);
          isProcessing = false;
          isListeningActive = false;
        }
      }

      async function handleRepeatResponse(transcript) {
        const lower = transcript.toLowerCase().trim();
        const yes = ["yes", "yeah", "sure", "repeat", "again"].some((w) =>
          lower.includes(w),
        );
        const no = ["no", "nope", "next", "skip"].some((w) =>
          lower.includes(w),
        );
        awaitingRepeatResponse = false;
        if (yes) {
          socket.emit("question", { question: currentQuestionText });
          await transitionToNextQuestion(
            currentQuestionText,
            "handleRepeatResponse-yes",
          );
        } else if (no) {
          await moveToNextQuestion();
        } else {
          const clarify =
            "I didn't understand. Would you like me to repeat the question? Please say yes or no.";
          socket.emit("idle_prompt", { text: clarify });
          await transitionToNextQuestion(
            clarify,
            "handleRepeatResponse-clarify",
          );
        }
      }

      async function endInterview() {
        if (isInterviewEnded) return;
        isInterviewEnded = true;
        isListeningActive = false;
        socket.emit("listening_disabled");
        socket.emit("interview_complete", {
          message: "Interview completed!",
          totalQuestions: currentOrder,
        });

        if (deepgramConnection) {
          try {
            deepgramConnection.pauseIdleDetection?.();
            deepgramConnection.finish();
          } catch (_) {}
          deepgramConnection = null;
        }
        if (faceViolationTimeout) {
          clearTimeout(faceViolationTimeout);
          faceViolationTimeout = null;
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

        socket.emit("evaluation_started", { message: "Evaluating responses…" });
        evaluateInterview(interviewId)
          .then((results) => {
            socket.emit("evaluation_complete", {
              message: "Evaluation complete!",
              results: {
                overallScore: results.overallEvaluation.overallScore,
                hireDecision: results.overallEvaluation.hireDecision,
                experienceLevel: results.overallEvaluation.experienceLevel,
              },
            });
            mergeInterviewMedia(interviewId, {
              layout: "picture-in-picture",
              screenPosition: "bottom-right",
              screenSize: 0.25,
              deleteChunksAfter: true,
              generatePreview: true,
            })
              .then((r) => {
                socket.emit("media_merge_complete", {
                  message: "Interview video ready!",
                  finalVideoUrl: r.finalVideoUrl,
                  previewUrl: r.previewUrl,
                  duration: r.duration,
                });
              })
              .catch((err) => {
                socket.emit("media_merge_error", {
                  message: "Video processing failed.",
                  error: err.message,
                });
              });
            cleanupSession(interviewId);
          })
          .catch(() =>
            socket.emit("evaluation_error", { message: "Evaluation failed." }),
          );

        isProcessing = false;
      }

      async function safeRecordViolation(type, details, timestamp) {
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
      console.error("❌ FATAL: Interview socket init failed:", err);
      socket.emit("error", { message: "Failed to initialize interview" });
      socket.disconnect();
    }
  }

  // ── Main connection handler ─────────────────────────────────────────────────
  io.on("connection", async (socket) => {
    const { interviewId, userId, type } = socket.handshake.query;
    if (!interviewId || !userId) {
      socket.emit("error", { message: "Missing interview or user ID" });
      return socket.disconnect();
    }
    if (type === "settings" || (type && type !== "interview")) {
      handleSettingsSocket(socket, interviewId, userId);
    } else {
      await handleInterviewSocket(socket, interviewId, userId);
    }
  });

  io.on("error", (err) => console.error("❌ Socket.IO server error:", err));
  console.log(" Socket.IO interview server (LiveKit) ready");
}

// ─── streamTTSToClient ────────────────────────────────────────────────────────
async function streamTTSToClient(socket, text, interviewId, retryCount = 0) {
  const MAX_RETRIES = 2;
  const TTS_TIMEOUT = 10000;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timer = setTimeout(() => {
      if (retryCount < MAX_RETRIES)
        resolve(streamTTSToClient(socket, text, interviewId, retryCount + 1));
      else reject(new Error("TTS timeout after retries"));
    }, TTS_TIMEOUT);

    try {
      const tts = getTTSInstance(interviewId);
      let chunkCount = 0;
      let hasError = false;

      tts.speakStream(text, (chunk) => {
        if (hasError) return;

        if (!chunk) {
          clearTimeout(timer);
          socket.emit("tts_end");
          resolve();
          return;
        }

        try {
          if (chunkCount === 0) {
            clearTimeout(timer); // First chunk received — clear the startup timeout
            console.log(`🎵 First TTS chunk: ${Date.now() - startTime}ms`);
          }
          chunkCount++;
          const buf = Buffer.isBuffer(chunk)
            ? chunk
            : typeof chunk === "string"
              ? Buffer.from(chunk, "base64")
              : Buffer.from(chunk);

          if (socket.connected)
            socket.emit("tts_audio", { audio: buf.toString("base64") });
        } catch (err) {
          clearTimeout(timer);
          hasError = true;
          reject(err);
        }
      });
    } catch (err) {
      clearTimeout(timer);
      if (retryCount < MAX_RETRIES)
        resolve(streamTTSToClient(socket, text, interviewId, retryCount + 1));
      else reject(err);
    }
  });
}

module.exports = { initInterviewSocket };
