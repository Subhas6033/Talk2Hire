const { Server } = require("socket.io");
const { Interview } = require("../Models/interview.models.js");
const { validateAnswer } = require("../Service/answervalidations.service.js");
const { generateNextQuestionWithAI } = require("../Service/ai.service.js");
const { createTTSStream } = require("../Service/tts.service.js");
const { createSTTSession } = require("../Service/stt.service.js");
const { evaluateInterview } = require("../Service/evaluation.service.js");
const {
  uploadVideoChunk,
  finalizeVideoUpload,
} = require("../Upload/uploadVideoOnFTP.js");
const { InterviewVideo } = require("../Models/interviewVideo.models.js");
const { InterviewAudio } = require("../Models/InterviewAudio.models.js");
const {
  uploadAudioChunk,
  finalizeAudioUpload,
} = require("../Upload/uploadAudioOnFTP.js");
const {
  mergeInterviewMedia,
} = require("../Service/globalVideoMerger.service.js");

// One TTS instance per interview session — eliminates cold start on every question
const ttsInstanceCache = new Map();

function getTTSInstance(interviewId) {
  if (!ttsInstanceCache.has(interviewId)) {
    console.log(`🆕 Creating NEW TTS instance for interview: ${interviewId}`);
    ttsInstanceCache.set(interviewId, createTTSStream());
  } else {
    console.log(`♻️ REUSING cached TTS instance for interview: ${interviewId}`);
  }
  return ttsInstanceCache.get(interviewId);
}

function initInterviewSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    maxHttpBufferSize: 10 * 1024 * 1024,
    pingTimeout: 60000,
    pingInterval: 25000,
    perMessageDeflate: false,
    httpCompression: false,
    connectTimeout: 45000,
  });

  const interviewSessions = new Map();

  function getOrCreateSession(interviewId) {
    if (!interviewSessions.has(interviewId)) {
      console.log(`📝 Creating new session for interview: ${interviewId}`);
      interviewSessions.set(interviewId, {
        videoUploads: {
          primary_camera: null,
          secondary_camera: null,
          screen_recording: null,
        },
        audioUploads: {
          mixed_audio: null,
          user_audio: null,
          interviewer_audio: null,
        },
        secondaryCameraConnected: false,
        secondaryCameraMetadata: null,
        serverReadySent: false,
        lastMobileFrame: null,
        lastMobileFrameTimestamp: null,
        isSetupMode: true,
        interviewStarted: false,
      });
    }
    return interviewSessions.get(interviewId);
  }

  function cleanupSession(interviewId) {
    console.log(`🧹 Cleaning up session: ${interviewId}`);
    interviewSessions.delete(interviewId);
    if (ttsInstanceCache.has(interviewId)) {
      ttsInstanceCache.delete(interviewId);
      console.log(`🗑️ TTS instance removed for: ${interviewId}`);
    }
  }

  // ============================================================================
  // SETTINGS SOCKET HANDLER
  // ============================================================================
  function handleSettingsSocket(socket, interviewId, userId) {
    console.log(`[SETTINGS] Socket connected for interview ${interviewId}`);
    const session = getOrCreateSession(interviewId);
    socket.join(`interview_${interviewId}`);

    socket.on("secondary_camera_connected", (data) => {
      console.log("[SETTINGS] Mobile camera connected:", data);
      session.secondaryCameraConnected = true;
      session.secondaryCameraMetadata = {
        connectedAt: new Date(data.timestamp),
        angle: data.angle || null,
        angleQuality: data.angleQuality || null,
      };
      socket.emit("secondary_camera_ready", {
        connected: true,
        timestamp: Date.now(),
      });
      socket.to(`interview_${interviewId}`).emit("secondary_camera_ready", {
        connected: true,
        timestamp: Date.now(),
      });
      io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
        connected: true,
        metadata: session.secondaryCameraMetadata,
      });
    });

    socket.on("security_frame_request", (data, ack) => {
      session.lastMobileFrame = data.frame;
      session.lastMobileFrameTimestamp = data.timestamp || Date.now();
      socket.to(`interview_${interviewId}`).emit("mobile_camera_frame", {
        frame: data.frame,
        timestamp: data.timestamp || Date.now(),
      });
      if (typeof ack === "function") ack();
    });

    socket.on("mobile_camera_frame", (data, ack) => {
      session.lastMobileFrame = data.frame;
      session.lastMobileFrameTimestamp = data.timestamp || Date.now();
      socket.to(`interview_${interviewId}`).emit("mobile_camera_frame", {
        frame: data.frame,
        timestamp: data.timestamp || Date.now(),
      });
      if (typeof ack === "function") ack();
    });

    socket.on("request_secondary_camera_status", () => {
      if (session.secondaryCameraConnected) {
        socket.emit("secondary_camera_ready", {
          connected: true,
          timestamp: Date.now(),
        });
        socket.emit("secondary_camera_status", {
          connected: true,
          metadata: session.secondaryCameraMetadata,
        });
        if (session.lastMobileFrame) {
          socket.emit("mobile_camera_frame", {
            frame: session.lastMobileFrame,
            timestamp: session.lastMobileFrameTimestamp || Date.now(),
          });
        }
      }
    });

    socket.on("disconnect", () => {
      console.log(`[SETTINGS] Socket disconnected: ${socket.id}`);
    });
  }

  // ============================================================================
  // INTERVIEW SOCKET HANDLER
  // ============================================================================
  async function handleInterviewSocket(socket, interviewId, userId) {
    console.log(`[INTERVIEW] Socket connected for interview ${interviewId}`);

    const session = getOrCreateSession(interviewId);
    const { videoUploads, audioUploads } = session;

    socket.join(`interview_${interviewId}`);

    if (session.secondaryCameraConnected) {
      console.log(
        "✅ Secondary camera already connected, notifying new client",
      );
      socket.emit("secondary_camera_ready", {
        interviewId,
        timestamp: Date.now(),
        message: "Mobile camera already connected and ready",
      });
      socket.emit("secondary_camera_status", {
        connected: true,
        metadata: session.secondaryCameraMetadata,
      });
      if (session.lastMobileFrame) {
        socket.emit("mobile_camera_frame", {
          frame: session.lastMobileFrame,
          timestamp: session.lastMobileFrameTimestamp || Date.now(),
        });
      }
    }

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
    const MAX_FACE_VIOLATIONS = 1;
    const FACE_DETECTION_THROTTLE_MS = 1000;

    let lastHolisticTime = 0;
    let faceViolationCount = 0;
    let lastFaceViolationTime = null;
    let faceViolationTimeout = null;

    try {
      const interviewSession = await Interview.getSessionById(interviewId);
      firstQuestion = await Interview.getQuestionByOrder(
        interviewId,
        currentOrder,
      );

      if (!firstQuestion) {
        const defaultQ =
          "Hello! Let's start with an introduction. Can you tell me about yourself, your background, and what brings you here today?";
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

      // PATCH 3: Pre-warm TTS instance during init so it's hot before client_ready
      getTTSInstance(interviewId);
      console.log("✅ First question ready");

      // ================================================================
      // SETUP MODE
      // ================================================================
      socket.on("setup_mode", (data) => {
        console.log(`🔧 [${socket.id}] Client in SETUP MODE`);
        session.isSetupMode = true;
        session.interviewStarted = false;
        socket.emit("server_ready", {
          setupMode: true,
          message: "Server ready in setup mode - recordings can be registered",
        });
      });

      // ================================================================
      // CLIENT READY
      // ================================================================
      socket.on("client_ready", async (data) => {
        console.log(`🚀 [${socket.id}] Client READY - Starting interview NOW`);
        session.isSetupMode = false;
        session.interviewStarted = true;

        try {
          if (firstQuestionSent) {
            console.log("⚠️ First question already sent, skipping");
            return;
          }
          if (!firstQuestion) {
            socket.emit("error", { message: "No question available" });
            return;
          }

          isProcessing = true;
          firstQuestionSent = true;
          currentQuestionText = firstQuestion.question;

          socket.emit("question", { question: firstQuestion.question });

          const deepgramReadyPromise = startDeepgramConnection();
          const ttsPromise = streamTTSToClient(
            socket,
            firstQuestion.question,
            interviewId,
          );

          const results = await Promise.allSettled([
            ttsPromise,
            deepgramReadyPromise,
          ]);

          if (results[0].status === "rejected")
            throw new Error("TTS failed: " + results[0].reason.message);

          let deepgramReady = results[1].status === "fulfilled";
          if (!deepgramReady) {
            try {
              await ensureDeepgramReady(
                startDeepgramConnection(),
                "client_ready-retry",
              );
              deepgramReady = true;
            } catch (retryError) {
              throw new Error("Deepgram initialization failed after retry");
            }
          }

          if (!deepgramConnection || !deepgramConnection.isConnected()) {
            await ensureDeepgramReady(
              startDeepgramConnection(),
              "client_ready-final",
            );
          }

          isListeningActive = true;
          socket.emit("listening_enabled");
          isProcessing = false;

          console.log(`🎬 Interview started for ${interviewId}`);
        } catch (error) {
          console.error(`❌ Failed to start interview:`, error);
          socket.emit("error", {
            message: "Failed to start interview",
            error: error.message,
          });
          isProcessing = false;
          firstQuestionSent = false;
          session.interviewStarted = false;
        }
      });

      // ================================================================
      // SECONDARY CAMERA EVENTS
      // ================================================================
      socket.on("secondary_camera_connected", (data) => {
        session.secondaryCameraConnected = true;
        session.secondaryCameraMetadata = {
          connectedAt: new Date(data.timestamp),
          angle: data.angle || null,
          angleQuality: data.angleQuality || null,
        };
        io.to(`interview_${interviewId}`).emit("secondary_camera_ready", {
          interviewId: data.interviewId,
          timestamp: Date.now(),
          message: "Mobile camera connected and ready",
        });
        io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
          connected: true,
          metadata: session.secondaryCameraMetadata,
        });
      });

      socket.on("security_frame_request", (data, ack) => {
        session.lastMobileFrame = data.frame;
        session.lastMobileFrameTimestamp = data.timestamp || Date.now();
        socket.to(`interview_${interviewId}`).emit("mobile_camera_frame", {
          frame: data.frame,
          timestamp: data.timestamp || Date.now(),
        });
        if (typeof ack === "function") ack();
      });

      socket.on("mobile_camera_frame", (data) => {
        session.lastMobileFrame = data.frame;
        session.lastMobileFrameTimestamp = data.timestamp || Date.now();
        socket.to(`interview_${interviewId}`).emit("mobile_camera_frame", {
          frame: data.frame,
          timestamp: data.timestamp || Date.now(),
        });
      });

      socket.on("request_secondary_camera_status", (data) => {
        if (session.secondaryCameraConnected) {
          socket.emit("secondary_camera_ready", {
            interviewId: data.interviewId,
            timestamp: Date.now(),
            message: "Mobile camera already connected",
          });
        }
      });

      socket.on("secondary_camera_disconnected", (data) => {
        session.secondaryCameraConnected = false;
        io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
          connected: false,
        });
      });

      // ================================================================
      // VIDEO RECORDING EVENTS
      // ================================================================
      socket.on("video_recording_start", async (data) => {
        const { videoType, totalChunks, metadata, setupMode } = data;
        console.log("📹 Video recording start request:", {
          videoType,
          setupMode: setupMode || session.isSetupMode,
        });

        try {
          const validVideoTypes = [
            "primary_camera",
            "secondary_camera",
            "screen_recording",
          ];
          if (!validVideoTypes.includes(videoType)) {
            throw new Error(`Invalid video type: ${videoType}`);
          }

          if (videoUploads[videoType]) {
            console.log(
              `♻️ Video session already exists for ${videoType}, reusing`,
            );
            socket.emit("video_recording_ready", {
              videoType,
              videoId: videoUploads[videoType].videoId,
              setupMode: setupMode || session.isSetupMode,
              message: "Reconnected to existing video session",
            });
            return;
          }

          const videoId = await InterviewVideo.create({
            interviewId,
            userId,
            videoType,
            originalFilename: `${videoType}_${Date.now()}.webm`,
            fileSize: 0,
            totalChunks: totalChunks || 0,
            duration: null,
          });

          videoUploads[videoType] = {
            videoId,
            chunks: 0,
            totalChunks: totalChunks || 0,
            metadata: metadata || {},
          };

          socket.emit("video_recording_ready", {
            videoType,
            videoId,
            setupMode: setupMode || session.isSetupMode,
            message:
              setupMode || session.isSetupMode
                ? "Video session registered (SETUP MODE)"
                : "Ready to receive video chunks",
          });

          console.log(
            `✅ video_recording_ready emitted for ${videoType}, videoId: ${videoId}`,
          );
        } catch (error) {
          console.error("❌ Error starting video recording:", error);
          socket.emit("video_recording_error", {
            videoType,
            error: error.message,
          });
        }
      });

      socket.on("video_chunk", async (data) => {
        if (session.isSetupMode || !session.interviewStarted) return;

        const { videoType, chunkNumber, chunkData, isLastChunk } = data;

        try {
          const videoInfo = videoUploads[videoType];
          if (!videoInfo?.videoId)
            throw new Error(`No video session for ${videoType}`);

          let chunkBuffer;
          if (typeof chunkData === "string")
            chunkBuffer = Buffer.from(chunkData, "base64");
          else if (Buffer.isBuffer(chunkData)) chunkBuffer = chunkData;
          else chunkBuffer = Buffer.from(chunkData);

          uploadVideoChunk({
            chunkBuffer,
            videoId: videoInfo.videoId,
            chunkNumber,
            totalChunks: videoInfo.totalChunks,
            interviewId,
          })
            .then((result) => {
              videoInfo.chunks++;
              socket.emit("video_chunk_uploaded", {
                videoType,
                chunkNumber,
                progress: result.progress,
              });
            })
            .catch((error) => {
              console.error(`❌ Chunk upload failed for ${videoType}:`, error);
              socket.emit("video_chunk_error", {
                videoType,
                chunkNumber,
                error: error.message,
              });
            });
        } catch (error) {
          console.error(`❌ Error processing ${videoType} chunk:`, error);
          socket.emit("video_chunk_error", {
            videoType,
            chunkNumber,
            error: error.message,
          });
        }
      });

      socket.on("video_recording_stop", async (data) => {
        const { videoType, totalChunks } = data;
        console.log(`🛑 Video recording stopped: ${videoType}`);

        try {
          const videoInfo = videoUploads[videoType];
          if (!videoInfo?.videoId) {
            console.warn(`⚠️ No video session for ${videoType}`);
            return;
          }

          if (totalChunks > 0) videoInfo.totalChunks = totalChunks;

          const result = await finalizeVideoUpload({
            videoId: videoInfo.videoId,
            interviewId,
          });
          socket.emit("video_processing_complete", {
            videoType,
            videoId: videoInfo.videoId,
            ftpUrl: result.ftpUrl,
          });
          console.log(`✅ ${videoType} finalized: ${result.ftpUrl}`);
        } catch (error) {
          console.error(`❌ Error finalizing ${videoType}:`, error);
          socket.emit("video_processing_error", {
            videoType,
            error: error.message,
          });
          if (videoUploads[videoType]?.videoId) {
            await InterviewVideo.markAsFailed(
              videoUploads[videoType].videoId,
              error.message,
            );
          }
        }
      });

      // ================================================================
      // AUDIO RECORDING EVENTS
      // ================================================================
      socket.on("audio_recording_start", async (data) => {
        const { audioType, metadata, setupMode } = data;
        console.log("🎤 Audio recording start request:", {
          audioType,
          setupMode: setupMode || session.isSetupMode,
        });

        try {
          if (audioUploads[audioType]) {
            console.log(
              `♻️ Audio session already exists for ${audioType}, reusing`,
            );
            socket.emit("audio_recording_ready", {
              audioType,
              audioId: audioUploads[audioType].audioId,
              setupMode: setupMode || session.isSetupMode,
              message: "Reconnected to existing audio session",
            });
            return;
          }

          const audioId = await InterviewAudio.create({
            interviewId,
            userId,
            audioType,
            fileSize: 0,
            totalChunks: 0,
          });

          audioUploads[audioType] = {
            audioId,
            chunks: 0,
            totalChunks: 0,
            metadata: metadata || {},
          };

          socket.emit("audio_recording_ready", {
            audioType,
            audioId,
            setupMode: setupMode || session.isSetupMode,
            message:
              setupMode || session.isSetupMode
                ? "Audio session registered (SETUP MODE)"
                : "Ready to receive audio chunks",
          });

          console.log(`✅ audio_recording_ready emitted, audioId: ${audioId}`);
        } catch (error) {
          console.error("❌ Error starting audio recording:", error);
          socket.emit("audio_recording_error", {
            audioType,
            error: error.message,
          });
        }
      });

      socket.on("audio_chunk", async (data) => {
        if (session.isSetupMode || !session.interviewStarted) return;

        const { audioType, chunkNumber, chunkData } = data;

        try {
          const audioInfo = audioUploads[audioType];
          if (!audioInfo?.audioId)
            throw new Error(`No audio session for ${audioType}`);

          let chunkBuffer;
          if (typeof chunkData === "string")
            chunkBuffer = Buffer.from(chunkData, "base64");
          else if (Buffer.isBuffer(chunkData)) chunkBuffer = chunkData;
          else chunkBuffer = Buffer.from(chunkData);

          uploadAudioChunk({
            chunkBuffer,
            audioId: audioInfo.audioId,
            chunkNumber,
            totalChunks: audioInfo.totalChunks,
            interviewId,
          })
            .then((result) => {
              audioInfo.chunks++;
              socket.emit("audio_chunk_uploaded", {
                audioType,
                chunkNumber,
                progress: result.progress,
              });
            })
            .catch((error) => {
              console.error(`❌ Audio chunk upload failed:`, error);
              socket.emit("audio_chunk_error", {
                audioType,
                chunkNumber,
                error: error.message,
              });
            });
        } catch (error) {
          console.error(`❌ Error processing audio chunk:`, error);
          socket.emit("audio_chunk_error", {
            audioType,
            chunkNumber,
            error: error.message,
          });
        }
      });

      socket.on("audio_recording_stop", async (data) => {
        const { audioType, totalChunks } = data;
        try {
          const audioInfo = audioUploads[audioType];
          if (!audioInfo?.audioId) {
            console.warn(`⚠️ No audio session for ${audioType}`);
            return;
          }

          if (totalChunks > 0) audioInfo.totalChunks = totalChunks;

          const result = await finalizeAudioUpload({
            audioId: audioInfo.audioId,
            interviewId,
          });
          socket.emit("audio_processing_complete", {
            audioType,
            audioId: audioInfo.audioId,
            ftpUrl: result.ftpUrl,
          });
          console.log(`✅ Audio ${audioType} finalized`);
        } catch (error) {
          console.error(`❌ Error finalizing audio:`, error);
          socket.emit("audio_processing_error", {
            audioType,
            error: error.message,
          });
        }
      });

      // ================================================================
      // INTERVIEW FLOW HELPERS
      // ================================================================
      async function ensureDeepgramReady(deepgramReadyPromise, context = "") {
        await deepgramReadyPromise;
        if (deepgramConnection && deepgramConnection.isConnected()) return true;

        const retryConnection = startDeepgramConnection();
        await retryConnection;
        if (deepgramConnection && deepgramConnection.isConnected()) return true;

        throw new Error("Deepgram connection failed after retry");
      }

      async function handleIdle() {
        if (deepgramConnection) deepgramConnection.pauseIdleDetection();

        if (awaitingRepeatResponse) {
          awaitingRepeatResponse = false;
          isListeningActive = false;
          socket.emit("listening_disabled");
          await moveToNextQuestion();
        } else {
          awaitingRepeatResponse = true;
          isListeningActive = false;
          socket.emit("listening_disabled");

          const promptText = "Can I repeat the question?";
          socket.emit("idle_prompt", { text: promptText });

          const oldConnection = deepgramConnection;
          deepgramConnection = null;

          try {
            const deepgramReady = startDeepgramConnection();
            await streamTTSToClient(socket, promptText, interviewId);
            await ensureDeepgramReady(deepgramReady, "handleIdle");
            if (oldConnection) {
              try {
                oldConnection.finish();
              } catch (e) {}
            }
            isListeningActive = true;
            socket.emit("listening_enabled");
            if (deepgramConnection) deepgramConnection.resumeIdleDetection();
          } catch (error) {
            if (!deepgramConnection && oldConnection)
              deepgramConnection = oldConnection;
            socket.emit("error", { message: "Speech recognition unavailable" });
          }
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
          const nextQuestionText = await generateNextQuestionWithAI({
            answer: "No response provided",
            questionOrder: nextOrder,
            previousQuestion: currentQuestionText,
          });

          await Interview.saveQuestion({
            interviewId,
            question: nextQuestionText,
            questionOrder: nextOrder,
            technology: null,
            difficulty: null,
          });

          currentOrder = nextOrder;
          currentQuestionText = nextQuestionText;
          socket.emit("next_question", { question: nextQuestionText });

          const oldConnection = deepgramConnection;
          deepgramConnection = null;

          try {
            const deepgramReady = startDeepgramConnection();
            await streamTTSToClient(socket, nextQuestionText, interviewId);
            await ensureDeepgramReady(deepgramReady, "moveToNextQuestion");
            if (oldConnection) {
              try {
                oldConnection.finish();
              } catch (e) {}
            }
            isListeningActive = true;
            socket.emit("listening_enabled");
            isProcessing = false;
          } catch (error) {
            if (!deepgramConnection && oldConnection)
              deepgramConnection = oldConnection;
            socket.emit("error", { message: "Speech recognition unavailable" });
            isProcessing = false;
          }
        } catch (error) {
          console.error("❌ Error moving to next question:", error);
          socket.emit("error", { message: "Error loading next question" });
          isProcessing = false;
        }
      }

      async function endInterview() {
        console.log("🏁 Ending interview");
        isInterviewEnded = true;

        try {
          socket.emit("interview_complete", {
            message: "Interview completed successfully!",
            totalQuestions: currentOrder,
          });
          isListeningActive = false;
          socket.emit("listening_disabled");

          if (deepgramConnection) {
            try {
              // PATCH 2: pause idle detection before finishing so the 10s
              // ghost timer can't fire on a dead socket
              deepgramConnection.pauseIdleDetection();
              deepgramConnection.finish();
            } catch (e) {}
            deepgramConnection = null;
          }

          if (faceViolationTimeout) {
            clearTimeout(faceViolationTimeout);
            faceViolationTimeout = null;
          }
          faceViolationCount = 0;
          lastFaceViolationTime = null;

          socket.emit("evaluation_started", {
            message: "Evaluating your interview responses...",
          });

          evaluateInterview(interviewId)
            .then((results) => {
              socket.emit("evaluation_complete", {
                message: "Evaluation completed!",
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
                .then((mergeResult) => {
                  socket.emit("media_merge_complete", {
                    message: "Your interview video is ready!",
                    finalVideoUrl: mergeResult.finalVideoUrl,
                    previewUrl: mergeResult.previewUrl,
                    duration: mergeResult.duration,
                    videosIncluded: Object.keys(mergeResult.videos || {}),
                  });
                })
                .catch((mergeError) => {
                  console.error("❌ Media merge failed:", mergeError);
                  socket.emit("media_merge_error", {
                    message: "Video processing failed.",
                    error: mergeError.message,
                  });
                });

              cleanupSession(interviewId);
            })
            .catch((error) => {
              console.error("❌ Evaluation failed:", error);
              socket.emit("evaluation_error", {
                message: "Evaluation failed.",
              });
            });

          isProcessing = false;
        } catch (error) {
          console.error("❌ Error ending interview:", error);
          isProcessing = false;
        }
      }

      // ================================================================
      // PATCH 1: startDeepgramConnection — reuse live connection between
      // questions instead of always tearing down and rebuilding the WebSocket.
      // Each new connection costs ~300–500ms handshake the user hears as
      // silence. We only create a new one when the existing connection is
      // dead or missing.
      // ================================================================
      function startDeepgramConnection() {
        // Reuse an existing live connection — reset per-question state only
        if (deepgramConnection && deepgramConnection.isConnected()) {
          console.log(`♻️ Reusing live Deepgram connection for ${interviewId}`);
          if (typeof deepgramConnection.resetTranscriptState === "function") {
            deepgramConnection.resetTranscriptState();
          }
          return Promise.resolve(deepgramConnection);
        }

        // Tear down any stale/dead connection before creating a new one
        if (deepgramConnection) {
          try {
            deepgramConnection.finish();
          } catch (e) {}
          deepgramConnection = null;
        }

        return new Promise((resolve, reject) => {
          const sttSession = createSTTSession();
          let hasReceivedTranscript = false;
          let hasResolved = false;

          const connectionTimeout = setTimeout(() => {
            if (!hasResolved) {
              hasResolved = true;
              reject(new Error("Deepgram connection timeout"));
            }
          }, 5000);

          const connection = sttSession.startLiveTranscription({
            onTranscript: async (transcript) => {
              if (
                !transcript?.trim() ||
                !isListeningActive ||
                isProcessing ||
                hasReceivedTranscript
              )
                return;

              hasReceivedTranscript = true;
              isListeningActive = false;
              if (deepgramConnection) deepgramConnection.pauseIdleDetection();

              socket.emit("transcript_received", { text: transcript });

              if (deepgramConnection) {
                try {
                  deepgramConnection.finish();
                } catch (e) {}
                deepgramConnection = null;
              }

              if (awaitingRepeatResponse)
                await handleRepeatResponse(transcript);
              else await processUserTranscript(transcript);
            },

            onInterim: (transcript) => {
              if (transcript?.trim())
                socket.emit("interim_transcript", { text: transcript });
            },

            onError: (error) => {
              console.error("❌ Deepgram STT error:", error);
              isListeningActive = false;
              if (!hasResolved) {
                clearTimeout(connectionTimeout);
                hasResolved = true;
                reject(error);
              }
            },

            onClose: () => {
              deepgramConnection = null;
            },

            // PATCH 2: guard against idle firing after disconnect
            onIdle: async () => {
              if (isListeningActive && !isProcessing && deepgramConnection) {
                await handleIdle();
              }
            },
          });

          // Expose reset method so reuse path can reset per-question state
          connection.resetTranscriptState = () => {
            hasReceivedTranscript = false;
          };

          deepgramConnection = connection;

          if (connection.waitForReady) {
            connection
              .waitForReady(5000)
              .then(() => {
                if (!hasResolved) {
                  clearTimeout(connectionTimeout);
                  hasResolved = true;
                  resolve(connection);
                }
              })
              .catch((error) => {
                if (!hasResolved) {
                  clearTimeout(connectionTimeout);
                  hasResolved = true;
                  reject(error);
                }
              });
          } else {
            clearTimeout(connectionTimeout);
            hasResolved = true;
            resolve(connection);
          }
        });
      }

      async function handleRepeatResponse(transcript) {
        const lower = transcript.toLowerCase().trim();

        if (
          ["yes", "yeah", "sure", "repeat", "again"].some((w) =>
            lower.includes(w),
          )
        ) {
          awaitingRepeatResponse = false;
          socket.emit("question", { question: currentQuestionText });
          const oldConnection = deepgramConnection;
          deepgramConnection = null;
          try {
            const deepgramReady = startDeepgramConnection();
            await streamTTSToClient(socket, currentQuestionText, interviewId);
            await ensureDeepgramReady(deepgramReady, "handleRepeatResponse");
            if (oldConnection) {
              try {
                oldConnection.finish();
              } catch (e) {}
            }
            isListeningActive = true;
            socket.emit("listening_enabled");
            isProcessing = false;
          } catch (error) {
            if (!deepgramConnection && oldConnection)
              deepgramConnection = oldConnection;
            socket.emit("error", { message: "Speech recognition unavailable" });
            isProcessing = false;
          }
        } else if (
          ["no", "nope", "next", "skip"].some((w) => lower.includes(w))
        ) {
          awaitingRepeatResponse = false;
          await moveToNextQuestion();
        } else {
          const clarificationText =
            "I didn't understand. Would you like me to repeat the question? Please say yes or no.";
          socket.emit("idle_prompt", { text: clarificationText });
          const oldConnection = deepgramConnection;
          deepgramConnection = null;
          try {
            const deepgramReady = startDeepgramConnection();
            await streamTTSToClient(socket, clarificationText, interviewId);
            await ensureDeepgramReady(
              deepgramReady,
              "handleRepeatResponse-clarification",
            );
            if (oldConnection) {
              try {
                oldConnection.finish();
              } catch (e) {}
            }
            isListeningActive = true;
            socket.emit("listening_enabled");
            isProcessing = false;
          } catch (error) {
            if (!deepgramConnection && oldConnection)
              deepgramConnection = oldConnection;
            socket.emit("error", { message: "Speech recognition unavailable" });
            isProcessing = false;
          }
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

          const [_, nextQuestion] = await Promise.all([
            Interview.saveAnswer({
              interviewId,
              questionId: currentQuestion.id,
              answer: text,
            }),
            (async () => {
              let nextQ = await Interview.getQuestionByOrder(
                interviewId,
                nextOrder,
              );
              if (!nextQ) {
                const nextQuestionText = await generateNextQuestionWithAI({
                  answer: text,
                  questionOrder: nextOrder,
                  previousQuestion: currentQuestion.question,
                });
                await Interview.saveQuestion({
                  interviewId,
                  question: nextQuestionText,
                  questionOrder: nextOrder,
                  technology: null,
                  difficulty: null,
                });
                nextQ = await Interview.getQuestionByOrder(
                  interviewId,
                  nextOrder,
                );
              }
              return nextQ;
            })(),
          ]);

          currentOrder = nextOrder;
          currentQuestionText = nextQuestion.question;
          socket.emit("next_question", { question: nextQuestion.question });

          const oldConnection = deepgramConnection;
          deepgramConnection = null;

          try {
            const deepgramReady = startDeepgramConnection();
            await streamTTSToClient(socket, nextQuestion.question, interviewId);
            await ensureDeepgramReady(deepgramReady, "processUserTranscript");
            if (oldConnection) {
              try {
                oldConnection.finish();
              } catch (e) {}
            }
            isListeningActive = true;
            socket.emit("listening_enabled");
            isProcessing = false;
          } catch (error) {
            if (!deepgramConnection && oldConnection)
              deepgramConnection = oldConnection;
            socket.emit("error", { message: "Speech recognition unavailable" });
            isProcessing = false;
          }
        } catch (error) {
          console.error("❌ Error in processUserTranscript:", error);
          isProcessing = false;
          isListeningActive = false;
        }
      }

      // ================================================================
      // HOLISTIC DETECTION
      // ================================================================
      async function safeRecordViolation(violationType, details, timestamp) {
        try {
          if (typeof Interview.saveViolation === "function") {
            await Interview.saveViolation({
              interviewId,
              violationType,
              details,
              timestamp: new Date(timestamp),
            });
          } else {
            console.warn(
              `⚠️ Interview.saveViolation is not implemented. ` +
                `Violation not persisted: ${violationType} — ${details}`,
            );
          }
        } catch (err) {
          console.error(
            "❌ Failed to record violation (non-fatal):",
            err.message,
          );
        }
      }

      socket.on("holistic_detection_result", async (data) => {
        if (session.isSetupMode || !session.interviewStarted) return;

        const {
          hasFace,
          hasPose,
          hasLeftHand,
          hasRightHand,
          faceCount,
          timestamp,
        } = data;
        const now = Date.now();

        if (now - lastHolisticTime < FACE_DETECTION_THROTTLE_MS) return;
        lastHolisticTime = now;

        try {
          if (faceCount === 0) {
            faceViolationCount++;
            lastFaceViolationTime = now;

            socket.emit("face_violation", {
              type: "NO_FACE",
              count: faceViolationCount,
              max: MAX_FACE_VIOLATIONS,
              message: "No face detected in frame",
            });

            if (faceViolationTimeout) {
              clearTimeout(faceViolationTimeout);
              faceViolationTimeout = null;
            }

            if (faceViolationCount >= MAX_FACE_VIOLATIONS) {
              socket.emit("interview_terminated", {
                reason: "NO_FACE_DETECTED",
                message:
                  "Interview terminated: Your face was not visible in the camera",
                violationCount: faceViolationCount,
              });

              await safeRecordViolation(
                "NO_FACE",
                `Face not detected for ${faceViolationCount} consecutive checks`,
                timestamp,
              );

              await endInterview();
              return;
            }
          } else if (faceCount > 1) {
            socket.emit("interview_terminated", {
              reason: "MULTIPLE_FACES",
              message: `Interview terminated: ${faceCount} people detected.`,
              faceCount,
            });

            await safeRecordViolation(
              "MULTIPLE_FACES",
              `${faceCount} faces detected`,
              timestamp,
            );

            await endInterview();
            return;
          } else if (faceCount === 1) {
            if (faceViolationCount > 0) {
              if (faceViolationTimeout) clearTimeout(faceViolationTimeout);
              faceViolationTimeout = setTimeout(() => {
                if (faceViolationCount > 0) {
                  faceViolationCount = 0;
                  lastFaceViolationTime = null;
                  socket.emit("face_violation_cleared");
                }
              }, 2000);
            }
          }
        } catch (error) {
          console.error(
            "❌ Error processing holistic detection:",
            error.message,
          );
        }
      });

      // ================================================================
      // AUDIO STREAMING
      // ================================================================
      let lastNoConnectionWarning = 0;
      let lastSendFailureWarning = 0;
      const WARNING_THROTTLE_MS = 5000;

      socket.on("user_audio_chunk", (audioData) => {
        if (
          session.isSetupMode ||
          !session.interviewStarted ||
          !isListeningActive
        )
          return;
        if (!deepgramConnection) {
          const now = Date.now();
          if (now - lastNoConnectionWarning > WARNING_THROTTLE_MS) {
            console.log(`⚠️ No Deepgram connection for ${interviewId}`);
            lastNoConnectionWarning = now;
          }
          return;
        }
        const sent = deepgramConnection.send(audioData);
        if (!sent) {
          const now = Date.now();
          if (now - lastSendFailureWarning > WARNING_THROTTLE_MS) {
            console.log(`⚠️ Failed to send audio for ${interviewId}`);
            lastSendFailureWarning = now;
          }
        }
      });

      // ================================================================
      // DISCONNECT
      // PATCH 2: Call pauseIdleDetection() BEFORE finish() so the 10-second
      // idle timer cannot fire on a dead socket after the user leaves.
      // ================================================================
      socket.on("disconnect", (reason) => {
        console.log("🔌 Interview socket disconnected:", {
          socketId: socket.id,
          interviewId,
          reason,
        });

        if (deepgramConnection) {
          try {
            deepgramConnection.pauseIdleDetection();
          } catch (e) {}
          try {
            deepgramConnection.finish();
          } catch (e) {}
          deepgramConnection = null;
        }

        if (faceViolationTimeout) {
          clearTimeout(faceViolationTimeout);
          faceViolationTimeout = null;
        }

        faceViolationCount = 0;
        lastFaceViolationTime = null;
        isProcessing = false;
        isListeningActive = false;
        awaitingRepeatResponse = false;
      });

      socket.on("error", (error) => {
        console.error("❌ Socket error:", error);
      });

      console.log("✅ All event listeners registered");

      setTimeout(() => {
        socket.emit("server_ready", {
          setupMode: session.isSetupMode,
          message: "Server ready - waiting for setup_mode or client_ready",
        });
        console.log("📤 Emitted server_ready");
      }, 100);
    } catch (error) {
      console.error("❌ FATAL: Error during initialization:", error);
      socket.emit("error", { message: "Failed to initialize interview" });
      socket.disconnect();
    }
  }

  // ============================================================================
  // MAIN CONNECTION HANDLER
  // ============================================================================
  io.on("connection", async (socket) => {
    const { interviewId, userId, type } = socket.handshake.query;

    if (!interviewId || !userId) {
      socket.emit("error", { message: "Missing interview or user ID" });
      return socket.disconnect();
    }

    console.log(
      `🔌 Socket connected: ${socket.id} | Type: ${type || "interview"} | Interview: ${interviewId}`,
    );

    if (type === "settings") {
      handleSettingsSocket(socket, interviewId, userId);
    } else {
      await handleInterviewSocket(socket, interviewId, userId);
    }
  });

  io.on("error", (error) => {
    console.error("❌ Socket.IO server error:", error);
  });
  console.log("✅ Socket.IO interview server ready");
}

// ============================================================================
// streamTTSToClient — ZERO-LATENCY STREAMING
// ============================================================================
async function streamTTSToClient(socket, text, interviewId, retryCount = 0) {
  const MAX_RETRIES = 2;
  const TTS_TIMEOUT = 10000;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    console.log("🔊 TTS starting for:", text.substring(0, 50) + "...");

    const ttsTimeout = setTimeout(() => {
      console.error("❌ TTS timeout");
      if (retryCount < MAX_RETRIES) {
        resolve(streamTTSToClient(socket, text, interviewId, retryCount + 1));
      } else {
        reject(new Error("TTS timeout after retries"));
      }
    }, TTS_TIMEOUT);

    try {
      const tts = interviewId ? getTTSInstance(interviewId) : createTTSStream();
      let chunkCount = 0;
      let totalBytes = 0;
      let firstChunkTime = null;
      let hasError = false;

      tts.speakStream(text, (chunk) => {
        if (hasError) return;

        if (!chunk) {
          clearTimeout(ttsTimeout);
          console.log(
            `✅ TTS complete: ${totalBytes}B in ${chunkCount} chunks (${Date.now() - startTime}ms)`,
          );
          socket.emit("tts_end");
          resolve();
          return;
        }

        try {
          if (chunkCount === 0) clearTimeout(ttsTimeout);

          const buf = Buffer.isBuffer(chunk)
            ? chunk
            : typeof chunk === "string"
              ? Buffer.from(chunk, "base64")
              : Buffer.from(chunk);

          totalBytes += buf.length;
          chunkCount++;

          if (chunkCount === 1) {
            firstChunkTime = Date.now() - startTime;
            console.log(`🎵 First TTS chunk ready in ${firstChunkTime}ms`);
          }

          if (socket.connected)
            socket.emit("tts_audio", { audio: buf.toString("base64") });
        } catch (error) {
          clearTimeout(ttsTimeout);
          console.error("❌ Error sending TTS chunk:", error);
          hasError = true;
          reject(error);
        }
      });
    } catch (error) {
      clearTimeout(ttsTimeout);
      console.error("❌ Error creating TTS stream:", error);
      if (retryCount < MAX_RETRIES) {
        resolve(streamTTSToClient(socket, text, interviewId, retryCount + 1));
      } else {
        reject(error);
      }
    }
  });
}

module.exports = { initInterviewSocket };
