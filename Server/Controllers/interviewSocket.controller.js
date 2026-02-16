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

// FIX: One TTS instance per interview session — eliminates cold start on every question
const ttsInstanceCache = new Map();

// Log functions to see if the cached TTS instance is being reused or if a new one is created, along with cache size
function getTTSInstance(interviewId) {
  const isExisting = ttsInstanceCache.has(interviewId);
  const cacheSize = ttsInstanceCache.size;

  if (!isExisting) {
    console.log(`🆕 Creating NEW TTS instance for interview: ${interviewId}`);
    console.log(
      `📊 Cache status BEFORE creation: ${cacheSize} instances cached`,
    );
    ttsInstanceCache.set(interviewId, createTTSStream());
    console.log(`✅ TTS instance created and cached for: ${interviewId}`);
    console.log(
      `📊 Cache status AFTER creation: ${ttsInstanceCache.size} instances cached`,
    );
  } else {
    console.log(`♻️ REUSING cached TTS instance for interview: ${interviewId}`);
    console.log(`📊 Cache hit! Total cached instances: ${cacheSize}`);
    console.log(`⚡ NO cold start - instant TTS ready`);
  }

  return ttsInstanceCache.get(interviewId);
}

/**
 * Initialize Socket.IO server for interview sessions
 * Handles real-time communication for video, audio, and transcription
 */
function initInterviewSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    maxHttpBufferSize: 10 * 1024 * 1024, // 10MB max message size
    pingTimeout: 60000, // 60 second ping timeout
    pingInterval: 25000, // Ping every 25 seconds
  });

  // Store persistent session data across connections
  const interviewSessions = new Map();

  /**
   * Get or create a session for an interview
   * Sessions persist across socket reconnections
   */
  function getOrCreateSession(interviewId) {
    if (!interviewSessions.has(interviewId)) {
      console.log(`Creating new session for interview: ${interviewId}`);
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
        // FIXED: Cache last mobile frame for reconnection
        lastMobileFrame: null,
        lastMobileFrameTimestamp: null,
      });
    }
    return interviewSessions.get(interviewId);
  }

  /**
   * Clean up session data when interview ends
   */
  function cleanupSession(interviewId) {
    console.log(`🧹 Cleaning up session: ${interviewId}`);

    const hadTTSInstance = ttsInstanceCache.has(interviewId);
    const cacheSizeBefore = ttsInstanceCache.size;

    interviewSessions.delete(interviewId);

    if (hadTTSInstance) {
      ttsInstanceCache.delete(interviewId);
      console.log(`🗑️ TTS instance removed for: ${interviewId}`);
      console.log(
        `📊 Cache size: ${cacheSizeBefore} → ${ttsInstanceCache.size}`,
      );
    } else {
      console.log(`⚠️ No TTS instance found in cache for: ${interviewId}`);
    }
  }

  // Handle new socket connections
  io.on("connection", async (socket) => {
    const { interviewId, userId } = socket.handshake.query;

    if (!interviewId || !userId) {
      socket.emit("error", { message: "Missing interview or user ID" });
      return socket.disconnect();
    }

    // Join room to enable broadcast to all clients in this interview
    socket.join(`interview_${interviewId}`);
    console.log(`Socket ${socket.id} joined room: interview_${interviewId}`);

    const session = getOrCreateSession(interviewId);
    const { videoUploads, audioUploads } = session;

    // FIXED: Handle reconnection - send cached state to new client
    if (session.secondaryCameraConnected) {
      console.log("Secondary camera already connected, notifying new client");

      // Emit immediately to avoid race condition
      socket.emit("secondary_camera_ready", {
        interviewId: interviewId,
        timestamp: Date.now(),
        message: "Mobile camera already connected and ready",
      });

      socket.emit("secondary_camera_status", {
        connected: true,
        metadata: session.secondaryCameraMetadata,
      });

      // FIXED: Send last cached frame so canvas displays immediately on reconnect
      if (session.lastMobileFrame) {
        console.log("Sending cached last frame to reconnected client");
        socket.emit("mobile_camera_frame", {
          frame: session.lastMobileFrame,
          timestamp: session.lastMobileFrameTimestamp || Date.now(),
        });
      }
    }

    // Interview state variables
    let currentOrder = 1;
    let isProcessing = false;
    let isInterviewEnded = false; // FIX: guard late transcripts after interview ends
    let firstQuestionSent = false;
    let firstQuestion = null;
    let deepgramConnection = null;
    let isListeningActive = false;
    let awaitingRepeatResponse = false;
    let currentQuestionText = "";

    // Configuration constants
    const MAX_QUESTIONS = 10;
    const MAX_FACE_VIOLATIONS = 1;
    const FACE_DETECTION_THROTTLE_MS = 1000;

    // Face detection state
    let lastHolisticTime = 0;
    let faceViolationCount = 0;
    let lastFaceViolationTime = null;
    let faceViolationTimeout = null;

    try {
      // Initialize interview session and first question
      const interviewSession = await Interview.getSessionById(interviewId);
      firstQuestion = await Interview.getQuestionByOrder(
        interviewId,
        currentOrder,
      );

      // Create default first question if none exists
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

      console.log("First question ready:", {
        questionId: firstQuestion.id,
        questionText: firstQuestion.question.substring(0, 50) + "...",
      });

      console.log("Initialization complete");
      console.log("Registering all socket event handlers");

      // ================================================================
      // SECONDARY CAMERA EVENTS
      // ================================================================

      // FIXED: Support both event names for backward compatibility
      socket.on("security_frame_request", (data, ack) => {
        // Cache frame for reconnection
        session.lastMobileFrame = data.frame;
        session.lastMobileFrameTimestamp = data.timestamp || Date.now();

        // Relay to desktop as "mobile_camera_frame"
        socket.to(`interview_${interviewId}`).emit("mobile_camera_frame", {
          frame: data.frame,
          timestamp: data.timestamp || Date.now(),
        });

        // FIX: Call ack so the client's ACK callback fires immediately,
        // resetting isFramePendingRef and allowing the next frame to be sent.
        if (typeof ack === "function") {
          ack();
        }
      });

      // Primary event listener for mobile camera frames
      socket.on("mobile_camera_frame", (data) => {
        // Cache frame for reconnection
        session.lastMobileFrame = data.frame;
        session.lastMobileFrameTimestamp = data.timestamp || Date.now();

        // Relay to all other clients in the room
        socket.to(`interview_${interviewId}`).emit("mobile_camera_frame", {
          frame: data.frame,
          timestamp: data.timestamp || Date.now(),
        });
      });

      socket.on("request_secondary_camera_status", (data) => {
        const session = getOrCreateSession(data.interviewId);

        if (session.secondaryCameraConnected) {
          socket.emit("secondary_camera_ready", {
            interviewId: data.interviewId,
            timestamp: Date.now(),
            message: "Mobile camera already connected",
          });
        }
      });

      // Handle secondary camera connection event
      socket.on("secondary_camera_connected", (data) => {
        console.log("Secondary camera connected:", {
          interviewId: data.interviewId,
          userId: data.userId,
          timestamp: data.timestamp,
        });

        session.secondaryCameraConnected = true;
        session.secondaryCameraMetadata = {
          connectedAt: new Date(data.timestamp),
          angle: data.angle || null,
          angleQuality: data.angleQuality || null,
        };

        console.log("Secondary camera status updated in session");

        // Emit to ALL clients in the room
        io.to(`interview_${interviewId}`).emit("secondary_camera_ready", {
          interviewId: data.interviewId,
          timestamp: Date.now(),
          message: "Mobile camera connected and ready",
        });

        console.log(
          `Emitted 'secondary_camera_ready' to room: interview_${interviewId}`,
        );

        // Also broadcast status for backward compatibility
        io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
          connected: true,
          metadata: session.secondaryCameraMetadata,
        });
      });

      // Handle secondary camera disconnection
      socket.on("secondary_camera_disconnected", (data) => {
        console.log("Secondary camera disconnected:", {
          interviewId: data.interviewId,
          userId: data.userId,
        });

        session.secondaryCameraConnected = false;

        io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
          connected: false,
        });

        console.log("Secondary camera disconnected from session");
      });

      // ================================================================
      // VIDEO RECORDING EVENTS
      // ================================================================

      socket.on("video_recording_start", async (data) => {
        const { videoType, totalChunks, metadata } = data;

        console.log("Video recording start request received:", {
          socketId: socket.id,
          videoType,
          totalChunks,
          metadata,
          interviewId,
          userId,
        });

        try {
          const validVideoTypes = [
            "primary_camera",
            "secondary_camera",
            "screen_recording",
          ];

          if (!validVideoTypes.includes(videoType)) {
            throw new Error(
              `Invalid video type: ${videoType}. Valid types: ${validVideoTypes.join(", ")}`,
            );
          }

          // Reuse existing session if available
          if (videoUploads[videoType]) {
            console.log(
              `Video session already exists for ${videoType}, reusing:`,
              { videoId: videoUploads[videoType].videoId },
            );
            socket.emit("video_recording_ready", {
              videoType,
              videoId: videoUploads[videoType].videoId,
              message: "Reconnected to existing video session",
            });
            return;
          }

          console.log("Creating video record in database");

          const videoId = await InterviewVideo.create({
            interviewId,
            userId,
            videoType,
            originalFilename: `${videoType}_${Date.now()}.webm`,
            fileSize: 0,
            totalChunks: totalChunks || 0,
            duration: null,
          });

          console.log(`Video record created with ID: ${videoId}`);

          videoUploads[videoType] = {
            videoId,
            chunks: 0,
            totalChunks: totalChunks || 0,
            metadata: metadata || {},
          };

          const responseData = {
            videoType,
            videoId,
            message: "Ready to receive video chunks",
          };

          socket.emit("video_recording_ready", responseData);
          console.log(`Emitted video_recording_ready:`, responseData);

          if (videoType === "secondary_camera") {
            console.log("Secondary camera recording session created:", {
              videoId,
              interviewId,
              userId,
            });
          }
        } catch (error) {
          console.error("Error starting video recording:", error);
          socket.emit("video_recording_error", {
            videoType,
            error: error.message,
          });
        }
      });

      // Handle incoming video chunks
      socket.on("video_chunk", async (data) => {
        const { videoType, chunkNumber, chunkData, isLastChunk } = data;

        // Log progress for first, last, and every 10th chunk
        if (chunkNumber === 1 || chunkNumber % 10 === 0 || isLastChunk) {
          console.log(`Received ${videoType} chunk:`, {
            chunkNumber,
            size: chunkData?.length || 0,
            isLastChunk,
          });
        }

        try {
          const videoInfo = videoUploads[videoType];

          if (!videoInfo || !videoInfo.videoId) {
            throw new Error(`No video session for ${videoType}`);
          }

          // Convert chunk data to Buffer
          let chunkBuffer;
          if (typeof chunkData === "string") {
            chunkBuffer = Buffer.from(chunkData, "base64");
          } else if (Buffer.isBuffer(chunkData)) {
            chunkBuffer = chunkData;
          } else if (chunkData instanceof ArrayBuffer) {
            chunkBuffer = Buffer.from(chunkData);
          } else {
            chunkBuffer = Buffer.from(chunkData);
          }

          // Upload chunk asynchronously
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
                checksum: result.checksum,
              });

              if (chunkNumber % 10 === 0 || isLastChunk) {
                console.log(
                  `${videoType} chunk ${chunkNumber} uploaded (${result.progress}%)`,
                );
              }

              // Update total chunks if this is the last chunk
              if (isLastChunk && videoInfo.totalChunks === 0) {
                videoInfo.totalChunks = chunkNumber;
              }
            })
            .catch((error) => {
              console.error(`Chunk upload failed for ${videoType}:`, error);
              socket.emit("video_chunk_error", {
                videoType,
                chunkNumber,
                error: error.message,
              });
            });
        } catch (error) {
          console.error(`Error processing ${videoType} chunk:`, error);
          socket.emit("video_chunk_error", {
            videoType,
            chunkNumber,
            error: error.message,
          });
        }
      });

      // Handle video recording stop
      socket.on("video_recording_stop", async (data) => {
        const { videoType, totalChunks } = data;

        console.log(`Video recording stopped: ${videoType}`, {
          totalChunks,
        });

        try {
          const videoInfo = videoUploads[videoType];

          if (!videoInfo || !videoInfo.videoId) {
            console.warn(`No video session found for ${videoType}`);
            return;
          }

          if (totalChunks && totalChunks > 0) {
            videoInfo.totalChunks = totalChunks;
          }

          console.log(`Finalizing ${videoType}...`, {
            videoId: videoInfo.videoId,
            chunksReceived: videoInfo.chunks,
            totalChunks: videoInfo.totalChunks,
          });

          const result = await finalizeVideoUpload({
            videoId: videoInfo.videoId,
            interviewId,
          });

          socket.emit("video_processing_complete", {
            videoType,
            videoId: videoInfo.videoId,
            ftpUrl: result.ftpUrl,
            fileSize: result.fileSize,
            duration: result.duration,
          });

          console.log(`${videoType} finalized:`, result.ftpUrl);

          if (videoType === "secondary_camera") {
            console.log("Secondary camera recording finalized:", {
              videoId: videoInfo.videoId,
              ftpUrl: result.ftpUrl,
            });
          }
        } catch (error) {
          console.error(`Error finalizing ${videoType}:`, error);
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
        const { audioType, metadata } = data;

        console.log("Audio recording start request:", {
          socketId: socket.id,
          audioType,
          interviewId,
          userId,
        });

        try {
          // Reuse existing session if available
          if (audioUploads[audioType]) {
            console.log(
              `Audio session already exists for ${audioType}, reusing`,
            );
            socket.emit("audio_recording_ready", {
              audioType,
              audioId: audioUploads[audioType].audioId,
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

          console.log(`Audio record created with ID: ${audioId}`);

          audioUploads[audioType] = {
            audioId,
            chunks: 0,
            totalChunks: 0,
            metadata: metadata || {},
          };

          socket.emit("audio_recording_ready", {
            audioType,
            audioId,
            message: "Ready to receive audio chunks",
          });

          console.log(`Emitted audio_recording_ready`);
        } catch (error) {
          console.error("Error starting audio recording:", error);
          socket.emit("audio_recording_error", {
            audioType,
            error: error.message,
          });
        }
      });

      // Handle incoming audio chunks
      socket.on("audio_chunk", async (data) => {
        const { audioType, chunkNumber, chunkData } = data;

        if (chunkNumber === 1 || chunkNumber % 10 === 0) {
          console.log(`Received audio chunk:`, {
            audioType,
            chunkNumber,
            size: chunkData?.length || 0,
          });
        }

        try {
          const audioInfo = audioUploads[audioType];

          if (!audioInfo || !audioInfo.audioId) {
            throw new Error(`No audio session for ${audioType}`);
          }

          // Convert chunk data to Buffer
          let chunkBuffer;
          if (typeof chunkData === "string") {
            chunkBuffer = Buffer.from(chunkData, "base64");
          } else if (Buffer.isBuffer(chunkData)) {
            chunkBuffer = chunkData;
          } else {
            chunkBuffer = Buffer.from(chunkData);
          }

          // Upload chunk asynchronously
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
              if (chunkNumber % 10 === 0) {
                console.log(
                  `Audio chunk ${chunkNumber} uploaded for ${audioType} (${result.progress}%)`,
                );
              }
            })
            .catch((error) => {
              console.error(
                `Audio chunk upload failed for ${audioType}:`,
                error,
              );
              socket.emit("audio_chunk_error", {
                audioType,
                chunkNumber,
                error: error.message,
              });
            });
        } catch (error) {
          console.error(`Error processing audio chunk:`, error);
          socket.emit("audio_chunk_error", {
            audioType,
            chunkNumber,
            error: error.message,
          });
        }
      });

      // Handle audio recording stop
      socket.on("audio_recording_stop", async (data) => {
        const { audioType, totalChunks } = data;

        console.log(`Audio recording stopped: ${audioType}`, {
          totalChunks,
        });

        try {
          const audioInfo = audioUploads[audioType];

          if (!audioInfo || !audioInfo.audioId) {
            console.warn(`No audio session found for ${audioType}`);
            return;
          }

          if (totalChunks && totalChunks > 0) {
            audioInfo.totalChunks = totalChunks;
          }

          console.log(`Finalizing audio ${audioType}...`, {
            audioId: audioInfo.audioId,
            chunksReceived: audioInfo.chunks,
            totalChunks: audioInfo.totalChunks,
          });

          const result = await finalizeAudioUpload({
            audioId: audioInfo.audioId,
            interviewId,
          });

          socket.emit("audio_processing_complete", {
            audioType,
            audioId: audioInfo.audioId,
            ftpUrl: result.ftpUrl,
            fileSize: result.fileSize,
            duration: result.duration,
          });

          console.log(`Audio ${audioType} finalized:`, result.ftpUrl);
        } catch (error) {
          console.error(`Error finalizing audio:`, error);
          socket.emit("audio_processing_error", {
            audioType,
            error: error.message,
          });
        }
      });

      // ================================================================
      // INTERVIEW FLOW HELPER FUNCTIONS
      // ================================================================

      /**
       * ✅ FIXED: Verify Deepgram connection is ready before enabling listening
       * This prevents "No Deepgram connection available" errors
       */
      async function ensureDeepgramReady(deepgramReadyPromise, context = "") {
        try {
          console.log(`⏳ [${context}] Waiting for Deepgram to be ready...`);
          await deepgramReadyPromise;

          // ✅ CRITICAL: Verify connection is actually ready
          if (deepgramConnection && deepgramConnection.isConnected()) {
            console.log(`✅ [${context}] Deepgram verified ready`);
            return true;
          }

          console.error(
            `❌ [${context}] Deepgram not ready after wait, retrying...`,
          );

          // Retry once
          console.log(`🔄 [${context}] Retrying Deepgram connection...`);
          const retryConnection = startDeepgramConnection();
          await retryConnection;

          if (deepgramConnection && deepgramConnection.isConnected()) {
            console.log(`✅ [${context}] Deepgram ready after retry`);
            return true;
          }

          console.error(`❌ [${context}] Deepgram failed after retry`);
          throw new Error("Deepgram connection failed after retry");
        } catch (error) {
          console.error(`❌ [${context}] Error waiting for Deepgram:`, error);
          throw error;
        }
      }

      /**
       * ✅ FIXED: Handle user idle timeout
       * Asks if user wants question repeated or moves to next question
       * Now includes proper connection management
       */
      async function handleIdle() {
        console.log("Handling idle timeout");

        if (deepgramConnection) {
          deepgramConnection.pauseIdleDetection();
        }

        if (awaitingRepeatResponse) {
          // User didn't respond to repeat prompt, move to next question
          console.log("No response to repeat prompt, moving to next question");
          awaitingRepeatResponse = false;
          isListeningActive = false;
          socket.emit("listening_disabled");
          await moveToNextQuestion();
        } else {
          // First idle - ask if user wants to repeat
          console.log("First idle - asking if user wants to repeat");
          awaitingRepeatResponse = true;
          isListeningActive = false;
          socket.emit("listening_disabled");

          const promptText = "Can I repeat the question?";
          socket.emit("idle_prompt", { text: promptText });

          // ✅ FIXED: Keep old connection, start new one in parallel
          const oldConnection = deepgramConnection;
          deepgramConnection = null;

          try {
            // OPTIMIZATION: Start Deepgram in parallel BEFORE TTS
            const deepgramReady = startDeepgramConnection();

            // Stream TTS immediately
            await streamTTSToClient(socket, promptText, interviewId);

            // ✅ FIXED: Wait and verify Deepgram is ready
            await ensureDeepgramReady(deepgramReady, "handleIdle");

            // ✅ Only NOW close old connection (new one is ready)
            if (oldConnection) {
              try {
                oldConnection.finish();
              } catch (e) {
                console.error("Error closing old connection:", e);
              }
            }

            isListeningActive = true;
            socket.emit("listening_enabled");

            if (deepgramConnection) {
              deepgramConnection.resumeIdleDetection();
            }
          } catch (error) {
            console.error("❌ Failed to enable listening:", error);

            // Restore old connection if new one failed
            if (!deepgramConnection && oldConnection) {
              deepgramConnection = oldConnection;
              console.log("⚠️ Restored old Deepgram connection after failure");
            }

            socket.emit("error", { message: "Speech recognition unavailable" });
          }
        }
      }

      /**
       * ✅ FIXED: Move to the next interview question
       * Now includes proper connection lifecycle management
       */
      async function moveToNextQuestion() {
        if (isProcessing) {
          console.log("Already processing, ignoring");
          return;
        }

        isProcessing = true;
        console.log("Moving to next question");

        try {
          if (currentOrder >= MAX_QUESTIONS) {
            console.log("Interview complete - reached maximum questions");
            await endInterview();
            return;
          }

          const nextOrder = currentOrder + 1;

          // Generate next question using AI
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

          // ✅ FIXED: Keep old connection, start new one in parallel
          const oldConnection = deepgramConnection;
          deepgramConnection = null;

          try {
            // OPTIMIZATION: Start Deepgram in parallel BEFORE TTS
            const deepgramReady = startDeepgramConnection();

            // Stream TTS immediately
            await streamTTSToClient(socket, nextQuestionText, interviewId);

            // ✅ FIXED: Wait and verify Deepgram is ready
            await ensureDeepgramReady(deepgramReady, "moveToNextQuestion");

            // ✅ Only NOW close old connection (new one is ready)
            if (oldConnection) {
              try {
                oldConnection.finish();
              } catch (e) {
                console.error("Error closing old connection:", e);
              }
            }

            isListeningActive = true;
            socket.emit("listening_enabled");
            isProcessing = false;

            console.log("Moved to next question successfully");
          } catch (error) {
            console.error("❌ Failed to enable listening:", error);

            // Restore old connection if new one failed
            if (!deepgramConnection && oldConnection) {
              deepgramConnection = oldConnection;
              console.log("⚠️ Restored old Deepgram connection after failure");
            }

            socket.emit("error", { message: "Speech recognition unavailable" });
            isProcessing = false;
          }
        } catch (error) {
          console.error("Error moving to next question:", error);
          socket.emit("error", { message: "Error loading next question" });
          isProcessing = false;
        }
      }

      /**
       * End the interview and trigger evaluation
       */
      async function endInterview() {
        console.log("Ending interview");
        // FIX: Mark interview as ended so processUserTranscript ignores late transcripts
        isInterviewEnded = true;

        try {
          socket.emit("interview_complete", {
            message: "Interview completed successfully!",
            totalQuestions: currentOrder,
          });

          isListeningActive = false;
          socket.emit("listening_disabled");

          // Clean up Deepgram connection
          if (deepgramConnection) {
            try {
              deepgramConnection.finish();
            } catch (e) {
              console.error("Error closing Deepgram:", e);
            }
            deepgramConnection = null;
          }

          // Clean up face violation timeout
          if (faceViolationTimeout) {
            clearTimeout(faceViolationTimeout);
            faceViolationTimeout = null;
          }
          faceViolationCount = 0;
          lastFaceViolationTime = null;

          socket.emit("evaluation_started", {
            message: "Evaluating your interview responses...",
          });

          console.log("Starting automatic evaluation");

          // Start evaluation process
          evaluateInterview(interviewId)
            .then((results) => {
              console.log("Evaluation completed:", {
                overallScore: results.overallEvaluation.overallScore,
                hireDecision: results.overallEvaluation.hireDecision,
              });

              socket.emit("evaluation_complete", {
                message: "Evaluation completed!",
                results: {
                  overallScore: results.overallEvaluation.overallScore,
                  hireDecision: results.overallEvaluation.hireDecision,
                  experienceLevel: results.overallEvaluation.experienceLevel,
                },
              });

              console.log("Triggering global media merger");

              // Merge all recorded media
              mergeInterviewMedia(interviewId, {
                layout: "picture-in-picture",
                screenPosition: "bottom-right",
                screenSize: 0.25,
                deleteChunksAfter: true,
                generatePreview: true,
              })
                .then((mergeResult) => {
                  console.log("Media merge complete:", {
                    finalVideoUrl: mergeResult.finalVideoUrl,
                    fileSize: mergeResult.fileSize,
                    duration: mergeResult.duration,
                    videosIncluded: Object.keys(mergeResult.videos || {}),
                  });

                  socket.emit("media_merge_complete", {
                    message: "Your interview video is ready!",
                    finalVideoUrl: mergeResult.finalVideoUrl,
                    previewUrl: mergeResult.previewUrl,
                    duration: mergeResult.duration,
                    videosIncluded: Object.keys(mergeResult.videos || {}),
                  });
                })
                .catch((mergeError) => {
                  console.error("Media merge failed:", mergeError);
                  socket.emit("media_merge_error", {
                    message: "Video processing failed. Please contact support.",
                    error: mergeError.message,
                  });
                });

              cleanupSession(interviewId);
            })
            .catch((error) => {
              console.error("Evaluation failed:", error);
              socket.emit("evaluation_error", {
                message: "Evaluation failed. Please try again later.",
              });
            });

          isProcessing = false;
        } catch (error) {
          console.error("Error ending interview:", error);
          isProcessing = false;
        }
      }

      /**
       * ✅ FULLY FIXED: Initialize Deepgram connection for speech recognition
       * Returns promise that resolves ONLY when WebSocket is actually OPEN
       * Includes proper timeout and error handling
       */
      function startDeepgramConnection() {
        if (deepgramConnection) {
          console.log("Closing existing Deepgram connection");
          try {
            deepgramConnection.finish();
          } catch (e) {
            console.error("Error closing old connection:", e);
          }
          deepgramConnection = null;
        }

        return new Promise((resolve, reject) => {
          console.log("Creating new Deepgram connection");
          const sttSession = createSTTSession();
          let hasReceivedTranscript = false;
          let hasResolved = false;

          // ✅ CRITICAL: Set timeout for connection
          const connectionTimeout = setTimeout(() => {
            if (!hasResolved) {
              console.error("❌ Deepgram connection timeout - never opened");
              hasResolved = true;
              reject(new Error("Deepgram connection timeout"));
            }
          }, 5000); // 5 second timeout (increased from 3s for stability)

          const connection = sttSession.startLiveTranscription({
            onTranscript: async (transcript) => {
              console.log("Deepgram final transcript:", transcript);

              if (!transcript || transcript.trim() === "") return;
              if (!isListeningActive) return;
              if (isProcessing) return;
              if (hasReceivedTranscript) return;

              hasReceivedTranscript = true;
              isListeningActive = false;
              console.log("Listening disabled after transcript");

              if (deepgramConnection) {
                deepgramConnection.pauseIdleDetection();
              }

              socket.emit("transcript_received", { text: transcript });

              if (deepgramConnection) {
                try {
                  deepgramConnection.finish();
                } catch (e) {
                  console.error("Error finishing connection:", e);
                }
                deepgramConnection = null;
              }

              if (awaitingRepeatResponse) {
                await handleRepeatResponse(transcript);
              } else {
                await processUserTranscript(transcript);
              }
            },

            onInterim: (transcript) => {
              if (transcript && transcript.trim()) {
                socket.emit("interim_transcript", { text: transcript });
              }
            },

            onError: (error) => {
              console.error("Deepgram STT error:", error);
              if (error.message?.includes("timeout")) {
                socket.emit("error", {
                  message: "Unable to start speech recognition",
                });
              }
              isListeningActive = false;

              // Reject promise if connection fails during setup
              if (!hasResolved) {
                clearTimeout(connectionTimeout);
                hasResolved = true;
                reject(error);
              }
            },

            onClose: () => {
              console.log("Deepgram STT connection closed");
              deepgramConnection = null;
            },

            onIdle: async () => {
              if (isListeningActive && !isProcessing) {
                await handleIdle();
              }
            },
          });

          deepgramConnection = connection;

          // ✅ CRITICAL FIX: Wait for the connection to actually open
          // Use the waitForReady method from stt.service.js
          if (connection.waitForReady) {
            connection
              .waitForReady(5000) // 5 second timeout
              .then(() => {
                if (!hasResolved) {
                  clearTimeout(connectionTimeout);
                  hasResolved = true;
                  console.log("✅ Deepgram connection opened and ready");
                  resolve(connection);
                }
              })
              .catch((error) => {
                if (!hasResolved) {
                  clearTimeout(connectionTimeout);
                  hasResolved = true;
                  console.error("❌ Deepgram waitForReady failed:", error);
                  reject(error);
                }
              });
          } else {
            // Fallback: resolve immediately if waitForReady not available
            console.warn(
              "⚠️ waitForReady not available, resolving immediately",
            );
            clearTimeout(connectionTimeout);
            hasResolved = true;
            resolve(connection);
          }

          console.log("Deepgram connection created, waiting for OPEN event...");
        });
      }

      /**
       * ✅ FIXED: Handle user response to "repeat question" prompt
       * Now includes proper connection lifecycle management
       */
      async function handleRepeatResponse(transcript) {
        console.log("Handling repeat response:", transcript);
        const lowerTranscript = transcript.toLowerCase().trim();

        if (
          lowerTranscript.includes("yes") ||
          lowerTranscript.includes("yeah") ||
          lowerTranscript.includes("sure") ||
          lowerTranscript.includes("repeat") ||
          lowerTranscript.includes("again")
        ) {
          console.log("User wants to repeat");
          awaitingRepeatResponse = false;

          socket.emit("question", { question: currentQuestionText });

          // ✅ FIXED: Keep old connection, start new one in parallel
          const oldConnection = deepgramConnection;
          deepgramConnection = null;

          try {
            // OPTIMIZATION: Start Deepgram in parallel BEFORE TTS
            const deepgramReady = startDeepgramConnection();

            // Stream TTS immediately
            await streamTTSToClient(socket, currentQuestionText, interviewId);

            // ✅ FIXED: Wait and verify Deepgram is ready
            await ensureDeepgramReady(deepgramReady, "handleRepeatResponse");

            // ✅ Only NOW close old connection (new one is ready)
            if (oldConnection) {
              try {
                oldConnection.finish();
              } catch (e) {
                console.error("Error closing old connection:", e);
              }
            }

            isListeningActive = true;
            socket.emit("listening_enabled");
            isProcessing = false;
          } catch (error) {
            console.error("❌ Failed to enable listening:", error);

            // Restore old connection if new one failed
            if (!deepgramConnection && oldConnection) {
              deepgramConnection = oldConnection;
              console.log("⚠️ Restored old Deepgram connection after failure");
            }

            socket.emit("error", { message: "Speech recognition unavailable" });
            isProcessing = false;
          }
        } else if (
          lowerTranscript.includes("no") ||
          lowerTranscript.includes("nope") ||
          lowerTranscript.includes("next") ||
          lowerTranscript.includes("skip")
        ) {
          console.log("User wants next question");
          awaitingRepeatResponse = false;
          await moveToNextQuestion();
        } else {
          console.log("Unclear response, asking again");
          const clarificationText =
            "I didn't understand. Would you like me to repeat the question? Please say yes or no.";

          socket.emit("idle_prompt", { text: clarificationText });

          // ✅ FIXED: Keep old connection, start new one in parallel
          const oldConnection = deepgramConnection;
          deepgramConnection = null;

          try {
            // OPTIMIZATION: Start Deepgram in parallel BEFORE TTS
            const deepgramReady = startDeepgramConnection();

            // Stream TTS immediately
            await streamTTSToClient(socket, clarificationText, interviewId);

            // ✅ FIXED: Wait and verify Deepgram is ready
            await ensureDeepgramReady(
              deepgramReady,
              "handleRepeatResponse-clarification",
            );

            // ✅ Only NOW close old connection (new one is ready)
            if (oldConnection) {
              try {
                oldConnection.finish();
              } catch (e) {
                console.error("Error closing old connection:", e);
              }
            }

            isListeningActive = true;
            socket.emit("listening_enabled");
            isProcessing = false;
          } catch (error) {
            console.error("❌ Failed to enable listening:", error);

            // Restore old connection if new one failed
            if (!deepgramConnection && oldConnection) {
              deepgramConnection = oldConnection;
              console.log("⚠️ Restored old Deepgram connection after failure");
            }

            socket.emit("error", { message: "Speech recognition unavailable" });
            isProcessing = false;
          }
        }
      }

      /**
       * ✅ FULLY OPTIMIZED: Process user's transcript and generate next question
       * saveAnswer and generateNextQuestion now run in parallel
       * Connection lifecycle properly managed
       */
      async function processUserTranscript(text) {
        // FIX: Guard against late Deepgram transcripts arriving after interview ends/terminates
        if (isInterviewEnded) {
          console.log("Interview ended, ignoring late transcript");
          return;
        }
        if (isProcessing) {
          console.log("Already processing, ignoring transcript");
          return;
        }

        isProcessing = true;
        isListeningActive = false;
        socket.emit("listening_disabled");

        try {
          const currentQuestion = await Interview.getQuestionByOrder(
            interviewId,
            currentOrder,
          );

          if (!currentQuestion) {
            console.error("Current question not found:", currentOrder);
            socket.emit("error", { message: "Question not found" });
            isProcessing = false;
            return;
          }

          // Check if interview is complete before doing extra work
          if (currentOrder >= MAX_QUESTIONS) {
            // Still save the answer, then end
            await Interview.saveAnswer({
              interviewId,
              questionId: currentQuestion.id,
              answer: text,
            });
            await endInterview();
            return;
          }

          const nextOrder = currentOrder + 1;

          // OPTIMIZATION: Run saveAnswer and fetch/generate next question in parallel
          const [_, nextQuestion] = await Promise.all([
            // Save user's answer
            Interview.saveAnswer({
              interviewId,
              questionId: currentQuestion.id,
              answer: text,
            }),
            // Simultaneously fetch or generate next question
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
              } else {
                console.log(
                  "Next question already exists, using cached version",
                );
              }

              return nextQ;
            })(),
          ]);

          currentOrder = nextOrder;
          currentQuestionText = nextQuestion.question;

          socket.emit("next_question", { question: nextQuestion.question });

          // ✅ FIXED: Keep old connection, start new one in parallel
          const oldConnection = deepgramConnection;
          deepgramConnection = null;

          try {
            // OPTIMIZATION: Start Deepgram in parallel BEFORE TTS
            const deepgramReady = startDeepgramConnection();

            // Stream TTS immediately
            await streamTTSToClient(socket, nextQuestion.question, interviewId);

            // ✅ FIXED: Wait and verify Deepgram is ready
            await ensureDeepgramReady(deepgramReady, "processUserTranscript");

            // ✅ Only NOW close old connection (new one is ready)
            if (oldConnection) {
              try {
                oldConnection.finish();
              } catch (e) {
                console.error("Error closing old connection:", e);
              }
            }

            isListeningActive = true;
            socket.emit("listening_enabled");
            isProcessing = false;

            console.log("Question cycle complete");
          } catch (error) {
            console.error("❌ Failed to enable listening:", error);

            // Restore old connection if new one failed
            if (!deepgramConnection && oldConnection) {
              deepgramConnection = oldConnection;
              console.log("⚠️ Restored old Deepgram connection after failure");
            }

            socket.emit("error", { message: "Speech recognition unavailable" });
            isProcessing = false;
          }
        } catch (error) {
          console.error("Error in processUserTranscript:", error);
          isProcessing = false;
          isListeningActive = false;
        }
      }

      // ================================================================
      // INTERVIEW QUESTION FLOW
      // ================================================================

      socket.on("ready_for_question", async () => {
        console.log("'ready_for_question' event received");

        if (firstQuestionSent) {
          console.log("First question already sent, ignoring");
          return;
        }
        if (isProcessing) {
          console.log("Already processing, ignoring ready_for_question");
          return;
        }
        if (!firstQuestion) {
          socket.emit("error", { message: "No question available" });
          return;
        }

        isProcessing = true;
        firstQuestionSent = true;

        try {
          currentQuestionText = firstQuestion.question;
          socket.emit("question", { question: firstQuestion.question });
          console.log("'question' event emitted");

          // OPTIMIZATION: Start Deepgram in parallel BEFORE TTS
          const deepgramReady = startDeepgramConnection();

          // Stream TTS immediately
          await streamTTSToClient(socket, firstQuestion.question, interviewId);
          console.log("First question TTS done");

          // ✅ FIXED: Wait and verify Deepgram is ready
          try {
            await ensureDeepgramReady(deepgramReady, "ready_for_question");

            isListeningActive = true;
            socket.emit("listening_enabled");
            console.log("Listening enabled");

            isProcessing = false;
          } catch (error) {
            console.error("❌ Failed to enable listening:", error);
            socket.emit("error", { message: "Speech recognition unavailable" });
            isProcessing = false;
            firstQuestionSent = false;
          }
        } catch (error) {
          console.error("Error in ready_for_question handler:", error);
          socket.emit("error", { message: "Error loading question" });
          isProcessing = false;
          firstQuestionSent = false;
        }
      });

      // ================================================================
      // HOLISTIC DETECTION (Face/Pose Detection)
      // ================================================================

      socket.on("holistic_detection_result", async (data) => {
        const {
          hasFace,
          hasPose,
          hasLeftHand,
          hasRightHand,
          faceCount,
          timestamp,
        } = data;

        const now = Date.now();

        // Throttle detection processing
        if (now - lastHolisticTime < FACE_DETECTION_THROTTLE_MS) return;
        lastHolisticTime = now;

        // Log detection status occasionally (10% of the time)
        if (Math.random() < 0.1) {
          console.log(`Holistic detection:`, {
            hasFace,
            hasPose,
            hasLeftHand,
            hasRightHand,
            faceCount,
          });
        }

        try {
          if (faceCount === 0) {
            faceViolationCount++;
            lastFaceViolationTime = now;

            console.log(
              `NO FACE - Violation ${faceViolationCount}/${MAX_FACE_VIOLATIONS}`,
            );

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

            // Terminate interview if violation threshold reached
            if (faceViolationCount >= MAX_FACE_VIOLATIONS) {
              console.log("TERMINATING: No face detected");

              socket.emit("interview_terminated", {
                reason: "NO_FACE_DETECTED",
                message:
                  "Interview terminated: Your face was not visible in the camera",
                violationCount: faceViolationCount,
              });

              await Interview.saveViolation({
                interviewId,
                violationType: "NO_FACE",
                details: `Face not detected for ${faceViolationCount} consecutive checks`,
                timestamp: new Date(timestamp),
              });

              await endInterview();
              return;
            }
          } else if (faceCount > 1) {
            // Immediate termination for multiple faces
            console.log(`TERMINATING: Multiple faces (${faceCount})`);

            socket.emit("interview_terminated", {
              reason: "MULTIPLE_FACES",
              message: `Interview terminated: ${faceCount} people detected. Only the candidate should be visible.`,
              faceCount,
            });

            await Interview.saveViolation({
              interviewId,
              violationType: "MULTIPLE_FACES",
              details: `${faceCount} faces detected`,
              timestamp: new Date(timestamp),
            });

            await endInterview();
            return;
          } else if (faceCount === 1) {
            // Reset violation count after 2 seconds of correct detection
            if (faceViolationCount > 0) {
              if (faceViolationTimeout) clearTimeout(faceViolationTimeout);

              faceViolationTimeout = setTimeout(() => {
                if (faceViolationCount > 0) {
                  console.log(
                    `Face violation count reset (was ${faceViolationCount})`,
                  );
                  faceViolationCount = 0;
                  lastFaceViolationTime = null;
                  socket.emit("face_violation_cleared");
                }
              }, 2000);
            }

            if (faceViolationCount > 0 || lastFaceViolationTime !== null) {
              socket.emit("face_status_ok", {
                faceCount: 1,
                hasPose,
                hasLeftHand,
                hasRightHand,
                message: "Detection OK",
              });
            }
          }
        } catch (error) {
          console.error("Error processing holistic detection:", error);
          socket.emit("error", { message: "Error processing detection" });
        }
      });

      // ================================================================
      // AUDIO STREAMING (Deepgram STT)
      // ================================================================

      socket.on("user_audio_chunk", (audioData) => {
        if (!isListeningActive) return;

        if (!deepgramConnection) {
          console.log("No Deepgram connection available");
          return;
        }

        const sent = deepgramConnection.send(audioData);
        if (!sent) {
          const state = deepgramConnection.getReadyState();
          console.log("Failed to send audio. State:", state);
        }
      });

      // ================================================================
      // DISCONNECT
      // ================================================================

      socket.on("disconnect", (reason) => {
        console.log("Interview socket disconnected:", {
          socketId: socket.id,
          interviewId,
          reason,
        });

        // Clean up Deepgram connection
        if (deepgramConnection) {
          try {
            deepgramConnection.finish();
          } catch (error) {
            console.error("Error closing Deepgram:", error);
          }
          deepgramConnection = null;
        }

        // Clean up timeouts
        if (faceViolationTimeout) {
          clearTimeout(faceViolationTimeout);
          faceViolationTimeout = null;
        }

        // Reset state
        faceViolationCount = 0;
        lastFaceViolationTime = null;
        isProcessing = false;
        isListeningActive = false;
        awaitingRepeatResponse = false;

        console.log(
          `Persistent session preserved for interview ${interviewId}`,
        );
      });

      socket.on("error", (error) => {
        console.error("Socket error:", error);
      });

      console.log("All event listeners registered");

      // Emit server_ready signal after short delay
      setTimeout(() => {
        socket.emit("server_ready");
        console.log("Emitted 'server_ready' signal to client");
      }, 100);
    } catch (error) {
      console.error("FATAL: Error during initialization:", error);
      socket.emit("error", { message: "Failed to initialize interview" });
      socket.disconnect();
    }
  });

  io.on("error", (error) => {
    console.error("Socket.IO server error:", error);
  });

  console.log("Socket.IO interview server ready");
}

/**
 * ============================================================================
 * ✅ FULLY OPTIMIZED: streamTTSToClient - ZERO-LATENCY STREAMING
 * Now includes timeout and retry logic for stability
 * ============================================================================
 */
async function streamTTSToClient(socket, text, interviewId, retryCount = 0) {
  const MAX_RETRIES = 2;
  const TTS_TIMEOUT = 10000; // 10 second timeout

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    console.log("🔊 TTS starting for:", text.substring(0, 50) + "...");

    // ✅ Add timeout for TTS
    const ttsTimeout = setTimeout(() => {
      console.error("❌ TTS timeout - no response after 10s");

      if (retryCount < MAX_RETRIES) {
        console.log(
          `🔄 Retrying TTS (attempt ${retryCount + 1}/${MAX_RETRIES})`,
        );
        resolve(streamTTSToClient(socket, text, interviewId, retryCount + 1));
      } else {
        reject(new Error("TTS timeout after retries"));
      }
    }, TTS_TIMEOUT);

    try {
      const wasInCache = interviewId && ttsInstanceCache.has(interviewId);
      console.log(`🔍 TTS Cache Status:`, {
        interviewId: interviewId || "N/A",
        inCache: wasInCache,
        willUseCache: !!interviewId,
        cacheSize: ttsInstanceCache.size,
      });

      const tts = interviewId ? getTTSInstance(interviewId) : createTTSStream();

      let chunkCount = 0;
      let totalBytes = 0;
      let firstChunkTime = null;
      let hasError = false;

      tts.speakStream(text, (chunk) => {
        if (hasError) return;

        if (!chunk) {
          // ✅ Clear timeout on success
          clearTimeout(ttsTimeout);

          // Stream ended
          const totalTime = Date.now() - startTime;
          console.log(
            `✅ TTS complete: ${totalBytes}B in ${chunkCount} chunks (${totalTime}ms total, first chunk: ${firstChunkTime ? firstChunkTime + "ms" : "N/A"})`,
          );
          socket.emit("tts_end");
          resolve();
          return;
        }

        try {
          // ✅ Clear timeout on first chunk (connection established)
          if (chunkCount === 0) {
            clearTimeout(ttsTimeout);
          }

          const buf = Buffer.isBuffer(chunk)
            ? chunk
            : typeof chunk === "string"
              ? Buffer.from(chunk, "base64")
              : Buffer.from(chunk);

          totalBytes += buf.length;
          chunkCount++;

          // Track first chunk time
          if (chunkCount === 1) {
            firstChunkTime = Date.now() - startTime;
            console.log(`🎵 First chunk ready in ${firstChunkTime}ms`);
          }

          // ============================================================
          // OPTIMIZATION: Emit immediately - NO batching, NO delays
          // ============================================================
          if (socket.connected) {
            socket.emit("tts_audio", { audio: buf.toString("base64") });
          }

          // Reduced logging overhead (every 20 chunks instead of 10)
          if (chunkCount % 20 === 0) {
            console.log(
              `📊 TTS progress: ${chunkCount} chunks, ${totalBytes} bytes`,
            );
          }
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
        console.log(
          `🔄 Retrying TTS after error (attempt ${retryCount + 1}/${MAX_RETRIES})`,
        );
        resolve(streamTTSToClient(socket, text, interviewId, retryCount + 1));
      } else {
        reject(error);
      }
    }
  });
}

module.exports = { initInterviewSocket };
