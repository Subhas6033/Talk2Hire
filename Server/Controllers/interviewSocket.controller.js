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
  });

  const interviewSessions = new Map();

  function getOrCreateSession(interviewId) {
    if (!interviewSessions.has(interviewId)) {
      console.log(`🆕 Creating new session for interview: ${interviewId}`);
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
      });
    }
    return interviewSessions.get(interviewId);
  }

  function cleanupSession(interviewId) {
    console.log(`🧹 Cleaning up session: ${interviewId}`);
    interviewSessions.delete(interviewId);
  }

  io.on("connection", async (socket) => {
    const { interviewId, userId } = socket.handshake.query;

    if (!interviewId || !userId) {
      socket.emit("error", { message: "Missing interview or user ID" });
      return socket.disconnect();
    }

    // ✅ Every socket joins the interview room immediately on connect
    // This ensures both desktop and mobile receive room broadcasts
    socket.join(`interview_${interviewId}`);
    console.log(`✅ Socket ${socket.id} joined room: interview_${interviewId}`);

    const session = getOrCreateSession(interviewId);
    const { videoUploads, audioUploads } = session;

    // Interview state
    let currentOrder = 1;
    let isProcessing = false;
    let firstQuestionSent = false;
    let firstQuestion = null;
    let deepgramConnection = null;
    let isListeningActive = false;
    let awaitingRepeatResponse = false;
    let currentQuestionText = "";

    const MAX_QUESTIONS = 10;
    const MAX_FACE_VIOLATIONS = 1;
    const FACE_DETECTION_THROTTLE_MS = 250;
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

      console.log("✅ First question ready:", {
        questionId: firstQuestion.id,
        questionText: firstQuestion.question.substring(0, 50) + "...",
      });

      console.log("✅ ✅ ✅ Initialization complete!");
      console.log("📝 Registering all socket event handlers...");

      // ══════════════════════════════════════════════════════════════
      // SECONDARY CAMERA EVENTS
      // ══════════════════════════════════════════════════════════════

      socket.on("secondary_camera_connected", (data) => {
        console.log("📱 Secondary camera connected:", {
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

        console.log("✅ Secondary camera status updated in session");

        // ✅ FIX: Emit "secondary_camera_ready" (what the desktop listens for)
        // to ALL clients in the room — desktop receives this and starts interview
        io.to(`interview_${interviewId}`).emit("secondary_camera_ready", {
          interviewId: data.interviewId,
          timestamp: Date.now(),
          message: "Mobile camera connected and ready",
        });

        console.log(
          `📤 Emitted 'secondary_camera_ready' to room: interview_${interviewId}`,
        );

        // Also keep backward-compat status broadcast
        io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
          connected: true,
          metadata: session.secondaryCameraMetadata,
        });
      });

      socket.on("secondary_camera_disconnected", (data) => {
        console.log("📱 Secondary camera disconnected:", {
          interviewId: data.interviewId,
          userId: data.userId,
        });

        session.secondaryCameraConnected = false;

        io.to(`interview_${interviewId}`).emit("secondary_camera_status", {
          connected: false,
        });

        console.log("⚠️ Secondary camera disconnected from session");
      });

      // ══════════════════════════════════════════════════════════════
      // VIDEO RECORDING EVENTS
      // ══════════════════════════════════════════════════════════════

      socket.on("video_recording_start", async (data) => {
        const { videoType, totalChunks, metadata } = data;

        console.log("🎥 Video recording start request received:", {
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

          if (videoUploads[videoType]) {
            console.log(
              `♻️ Video session already exists for ${videoType}, reusing:`,
              { videoId: videoUploads[videoType].videoId },
            );
            socket.emit("video_recording_ready", {
              videoType,
              videoId: videoUploads[videoType].videoId,
              message: "Reconnected to existing video session",
            });
            return;
          }

          console.log("📝 Creating video record in database...");

          const videoId = await InterviewVideo.create({
            interviewId,
            userId,
            videoType,
            originalFilename: `${videoType}_${Date.now()}.webm`,
            fileSize: 0,
            totalChunks: totalChunks || 0,
            duration: null,
          });

          console.log(`✅ Video record created with ID: ${videoId}`);

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
          console.log(`✅ Emitted video_recording_ready:`, responseData);

          if (videoType === "secondary_camera") {
            console.log("📱 Secondary camera recording session created:", {
              videoId,
              interviewId,
              userId,
            });
          }
        } catch (error) {
          console.error("❌ Error starting video recording:", error);
          socket.emit("video_recording_error", {
            videoType,
            error: error.message,
          });
        }
      });

      socket.on("video_chunk", async (data) => {
        const { videoType, chunkNumber, chunkData, isLastChunk } = data;

        if (chunkNumber === 1 || chunkNumber % 10 === 0 || isLastChunk) {
          console.log(`📦 Received ${videoType} chunk:`, {
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
                  `✅ ${videoType} chunk ${chunkNumber} uploaded (${result.progress}%)`,
                );
              }

              if (isLastChunk && videoInfo.totalChunks === 0) {
                videoInfo.totalChunks = chunkNumber;
              }
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

        console.log(`🎬 Video recording stopped: ${videoType}`, {
          totalChunks,
        });

        try {
          const videoInfo = videoUploads[videoType];

          if (!videoInfo || !videoInfo.videoId) {
            console.warn(`⚠️ No video session found for ${videoType}`);
            return;
          }

          if (totalChunks && totalChunks > 0) {
            videoInfo.totalChunks = totalChunks;
          }

          console.log(`🎬 Finalizing ${videoType}...`, {
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

          console.log(`✅ ${videoType} finalized:`, result.ftpUrl);

          if (videoType === "secondary_camera") {
            console.log("📱 Secondary camera recording finalized:", {
              videoId: videoInfo.videoId,
              ftpUrl: result.ftpUrl,
            });
          }
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

      // ══════════════════════════════════════════════════════════════
      // AUDIO RECORDING EVENTS
      // ══════════════════════════════════════════════════════════════

      socket.on("audio_recording_start", async (data) => {
        const { audioType, metadata } = data;

        console.log("🎙️ Audio recording start request:", {
          socketId: socket.id,
          audioType,
          interviewId,
          userId,
        });

        try {
          if (audioUploads[audioType]) {
            console.log(
              `♻️ Audio session already exists for ${audioType}, reusing`,
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

          console.log(`✅ Audio record created with ID: ${audioId}`);

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

          console.log(`✅ Emitted audio_recording_ready`);
        } catch (error) {
          console.error("❌ Error starting audio recording:", error);
          socket.emit("audio_recording_error", {
            audioType,
            error: error.message,
          });
        }
      });

      socket.on("audio_chunk", async (data) => {
        const { audioType, chunkNumber, chunkData } = data;

        if (chunkNumber === 1 || chunkNumber % 10 === 0) {
          console.log(`🎵 Received audio chunk:`, {
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

          let chunkBuffer;
          if (typeof chunkData === "string") {
            chunkBuffer = Buffer.from(chunkData, "base64");
          } else if (Buffer.isBuffer(chunkData)) {
            chunkBuffer = chunkData;
          } else {
            chunkBuffer = Buffer.from(chunkData);
          }

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
                  `✅ Audio chunk ${chunkNumber} uploaded for ${audioType} (${result.progress}%)`,
                );
              }
            })
            .catch((error) => {
              console.error(
                `❌ Audio chunk upload failed for ${audioType}:`,
                error,
              );
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

        console.log(`🎵 Audio recording stopped: ${audioType}`, {
          totalChunks,
        });

        try {
          const audioInfo = audioUploads[audioType];

          if (!audioInfo || !audioInfo.audioId) {
            console.warn(`⚠️ No audio session found for ${audioType}`);
            return;
          }

          if (totalChunks && totalChunks > 0) {
            audioInfo.totalChunks = totalChunks;
          }

          console.log(`🎵 Finalizing audio ${audioType}...`, {
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

          console.log(`✅ Audio ${audioType} finalized:`, result.ftpUrl);
        } catch (error) {
          console.error(`❌ Error finalizing audio:`, error);
          socket.emit("audio_processing_error", {
            audioType,
            error: error.message,
          });
        }
      });

      // ══════════════════════════════════════════════════════════════
      // INTERVIEW FLOW HELPERS
      // ══════════════════════════════════════════════════════════════

      async function handleIdle() {
        console.log("⏰ Handling idle timeout");

        if (deepgramConnection) {
          deepgramConnection.pauseIdleDetection();
        }

        if (awaitingRepeatResponse) {
          console.log(
            "⏭️ No response to repeat prompt, moving to next question",
          );
          awaitingRepeatResponse = false;
          isListeningActive = false;
          socket.emit("listening_disabled");
          await moveToNextQuestion();
        } else {
          console.log("❓ First idle - asking if user wants to repeat");
          awaitingRepeatResponse = true;
          isListeningActive = false;
          socket.emit("listening_disabled");

          const promptText = "Can I repeat the question?";
          socket.emit("idle_prompt", { text: promptText });
          await new Promise((resolve) => setTimeout(resolve, 200));
          await streamTTSToClient(socket, promptText);
          await new Promise((resolve) => setTimeout(resolve, 1500));

          isListeningActive = true;
          socket.emit("listening_enabled");

          if (deepgramConnection) {
            deepgramConnection.resumeIdleDetection();
          }
        }
      }

      async function moveToNextQuestion() {
        if (isProcessing) {
          console.log("⚠️ Already processing, ignoring");
          return;
        }

        isProcessing = true;
        console.log("⏭️ Moving to next question...");

        try {
          if (currentOrder >= MAX_QUESTIONS) {
            console.log("🎉 Interview complete! Reached maximum questions.");
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
          await new Promise((resolve) => setTimeout(resolve, 200));
          await streamTTSToClient(socket, nextQuestionText);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await new Promise((resolve) => setTimeout(resolve, 500));

          await startDeepgramConnection();
          isListeningActive = true;
          socket.emit("listening_enabled");
          isProcessing = false;

          console.log("✅ Moved to next question successfully");
        } catch (error) {
          console.error("❌ Error moving to next question:", error);
          socket.emit("error", { message: "Error loading next question" });
          isProcessing = false;
        }
      }

      async function endInterview() {
        console.log("🏁 Ending interview...");

        try {
          socket.emit("interview_complete", {
            message: "Interview completed successfully!",
            totalQuestions: currentOrder,
          });

          isListeningActive = false;
          socket.emit("listening_disabled");

          if (deepgramConnection) {
            try {
              deepgramConnection.finish();
            } catch (e) {
              console.error("Error closing Deepgram:", e);
            }
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

          console.log("🔄 Starting automatic evaluation...");

          evaluateInterview(interviewId)
            .then((results) => {
              console.log("✅ Evaluation completed:", {
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

              console.log("🎬 Triggering global media merger...");

              mergeInterviewMedia(interviewId, {
                layout: "picture-in-picture",
                screenPosition: "bottom-right",
                screenSize: 0.25,
                deleteChunksAfter: true,
                generatePreview: true,
              })
                .then((mergeResult) => {
                  console.log("✅ Media merge complete:", {
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
                  console.error("❌ Media merge failed:", mergeError);
                  socket.emit("media_merge_error", {
                    message: "Video processing failed. Please contact support.",
                    error: mergeError.message,
                  });
                });

              cleanupSession(interviewId);
            })
            .catch((error) => {
              console.error("❌ Evaluation failed:", error);
              socket.emit("evaluation_error", {
                message: "Evaluation failed. Please try again later.",
              });
            });

          isProcessing = false;
        } catch (error) {
          console.error("❌ Error ending interview:", error);
          isProcessing = false;
        }
      }

      function startDeepgramConnection() {
        if (deepgramConnection) {
          console.log("⚠️ Closing existing Deepgram connection");
          try {
            deepgramConnection.finish();
          } catch (e) {
            console.error("Error closing old connection:", e);
          }
          deepgramConnection = null;
        }

        return new Promise((resolve) => {
          setTimeout(() => {
            console.log("🎤 Creating new Deepgram connection...");
            const sttSession = createSTTSession();
            let hasReceivedTranscript = false;

            deepgramConnection = sttSession.startLiveTranscription({
              onTranscript: async (transcript) => {
                console.log("📝 Deepgram final transcript:", transcript);

                if (!transcript || transcript.trim() === "") return;
                if (!isListeningActive) return;
                if (isProcessing) return;
                if (hasReceivedTranscript) return;

                hasReceivedTranscript = true;
                isListeningActive = false;
                console.log("🛑 Listening disabled after transcript");

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
                console.error("❌ Deepgram STT error:", error);
                if (error.message?.includes("timeout")) {
                  socket.emit("error", {
                    message: "Unable to start speech recognition",
                  });
                }
                isListeningActive = false;
              },

              onClose: () => {
                console.log("🔌 Deepgram STT connection closed");
                deepgramConnection = null;
              },

              onIdle: async () => {
                if (isListeningActive && !isProcessing) {
                  await handleIdle();
                }
              },
            });

            console.log("✅ Deepgram connection created");
            resolve(deepgramConnection);
          }, 300);
        });
      }

      async function handleRepeatResponse(transcript) {
        console.log("💬 Handling repeat response:", transcript);
        const lowerTranscript = transcript.toLowerCase().trim();

        if (
          lowerTranscript.includes("yes") ||
          lowerTranscript.includes("yeah") ||
          lowerTranscript.includes("sure") ||
          lowerTranscript.includes("repeat") ||
          lowerTranscript.includes("again")
        ) {
          console.log("🔄 User wants to repeat");
          awaitingRepeatResponse = false;

          socket.emit("question", { question: currentQuestionText });
          await new Promise((resolve) => setTimeout(resolve, 200));
          await streamTTSToClient(socket, currentQuestionText);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await new Promise((resolve) => setTimeout(resolve, 500));

          await startDeepgramConnection();
          isListeningActive = true;
          socket.emit("listening_enabled");
          isProcessing = false;
        } else if (
          lowerTranscript.includes("no") ||
          lowerTranscript.includes("nope") ||
          lowerTranscript.includes("next") ||
          lowerTranscript.includes("skip")
        ) {
          console.log("⏭️ User wants next question");
          awaitingRepeatResponse = false;
          await moveToNextQuestion();
        } else {
          console.log("❓ Unclear response, asking again");
          const clarificationText =
            "I didn't understand. Would you like me to repeat the question? Please say yes or no.";

          socket.emit("idle_prompt", { text: clarificationText });
          await new Promise((resolve) => setTimeout(resolve, 200));
          await streamTTSToClient(socket, clarificationText);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await new Promise((resolve) => setTimeout(resolve, 500));

          await startDeepgramConnection();
          isListeningActive = true;
          socket.emit("listening_enabled");
          isProcessing = false;
        }
      }

      async function processUserTranscript(text) {
        if (isProcessing) {
          console.log("⚠️ Already processing, ignoring transcript");
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
            console.error("❌ Current question not found:", currentOrder);
            socket.emit("error", { message: "Question not found" });
            isProcessing = false;
            return;
          }

          await Interview.saveAnswer({
            interviewId,
            questionId: currentQuestion.id,
            answer: text,
          });

          if (currentOrder >= MAX_QUESTIONS) {
            await endInterview();
            return;
          }

          const nextOrder = currentOrder + 1;
          let nextQuestion = await Interview.getQuestionByOrder(
            interviewId,
            nextOrder,
          );

          if (!nextQuestion) {
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

            nextQuestion = await Interview.getQuestionByOrder(
              interviewId,
              nextOrder,
            );
          } else {
            console.log(
              "✅ Next question already exists, using cached version",
            );
          }

          currentOrder = nextOrder;
          currentQuestionText = nextQuestion.question;

          socket.emit("next_question", { question: nextQuestion.question });
          await new Promise((resolve) => setTimeout(resolve, 200));
          await streamTTSToClient(socket, nextQuestion.question);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await new Promise((resolve) => setTimeout(resolve, 500));

          await startDeepgramConnection();
          isListeningActive = true;
          socket.emit("listening_enabled");
          isProcessing = false;

          console.log("🎉 Question cycle complete");
        } catch (error) {
          console.error("❌ Error in processUserTranscript:", error);
          isProcessing = false;
          isListeningActive = false;
        }
      }

      // ══════════════════════════════════════════════════════════════
      // INTERVIEW QUESTION FLOW
      // ══════════════════════════════════════════════════════════════

      socket.on("ready_for_question", async () => {
        console.log("🎯 'ready_for_question' event received!");

        if (firstQuestionSent) {
          console.log("⚠️ First question already sent, ignoring");
          return;
        }
        if (isProcessing) {
          console.log("⚠️ Already processing, ignoring ready_for_question");
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
          console.log("✅ 'question' event emitted");

          await new Promise((resolve) => setTimeout(resolve, 200));
          await streamTTSToClient(socket, firstQuestion.question);
          console.log("✅ First question TTS done");

          await new Promise((resolve) => setTimeout(resolve, 1000));
          await new Promise((resolve) => setTimeout(resolve, 500));

          await startDeepgramConnection();
          isListeningActive = true;
          socket.emit("listening_enabled");
          console.log("✅ Listening enabled");

          isProcessing = false;
        } catch (error) {
          console.error("❌ Error in ready_for_question handler:", error);
          socket.emit("error", { message: "Error loading question" });
          isProcessing = false;
          firstQuestionSent = false;
        }
      });

      // ══════════════════════════════════════════════════════════════
      // HOLISTIC DETECTION
      // ══════════════════════════════════════════════════════════════

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
        if (now - lastHolisticTime < FACE_DETECTION_THROTTLE_MS) return;
        lastHolisticTime = now;

        if (Math.random() < 0.1) {
          console.log(`🧍 Holistic detection:`, {
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
              `⚠️ NO FACE - Violation ${faceViolationCount}/${MAX_FACE_VIOLATIONS}`,
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

            if (faceViolationCount >= MAX_FACE_VIOLATIONS) {
              console.log("❌ TERMINATING: No face detected");

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
            console.log(`❌ TERMINATING: Multiple faces (${faceCount})`);

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
            if (faceViolationCount > 0) {
              if (faceViolationTimeout) clearTimeout(faceViolationTimeout);

              faceViolationTimeout = setTimeout(() => {
                if (faceViolationCount > 0) {
                  console.log(
                    `✅ Face violation count reset (was ${faceViolationCount})`,
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
          console.error("❌ Error processing holistic detection:", error);
          socket.emit("error", { message: "Error processing detection" });
        }
      });

      // ══════════════════════════════════════════════════════════════
      // AUDIO STREAMING (Deepgram)
      // ══════════════════════════════════════════════════════════════

      socket.on("user_audio_chunk", (audioData) => {
        if (!isListeningActive) return;

        if (!deepgramConnection) {
          console.log("⚠️ No Deepgram connection available");
          return;
        }

        const sent = deepgramConnection.send(audioData);
        if (!sent) {
          const state = deepgramConnection.getReadyState();
          console.log("⚠️ Failed to send audio. State:", state);
        }
      });

      // ══════════════════════════════════════════════════════════════
      // DISCONNECT
      // ══════════════════════════════════════════════════════════════

      socket.on("disconnect", (reason) => {
        console.log("⚠️ Interview socket disconnected:", {
          socketId: socket.id,
          interviewId,
          reason,
        });

        if (deepgramConnection) {
          try {
            deepgramConnection.finish();
          } catch (error) {
            console.error("❌ Error closing Deepgram:", error);
          }
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

        console.log(
          `💾 Persistent session preserved for interview ${interviewId}`,
        );
      });

      socket.on("error", (error) => {
        console.error("❌ Socket error:", error);
      });

      console.log("✅ All event listeners registered");

      // ✅ Emit server_ready after short delay
      setTimeout(() => {
        socket.emit("server_ready");
        console.log("📤 Emitted 'server_ready' signal to client");
      }, 100);
    } catch (error) {
      console.error("❌ FATAL: Error during initialization:", error);
      socket.emit("error", { message: "Failed to initialize interview" });
      socket.disconnect();
    }
  });

  io.on("error", (error) => {
    console.error("❌ Socket.IO server error:", error);
  });

  console.log("🔌 Socket.IO interview server ready");
}

async function streamTTSToClient(socket, text) {
  return new Promise((resolve, reject) => {
    console.log("🎤 TTS for:", text.substring(0, 50) + "...");

    try {
      const tts = createTTSStream();
      let chunkCount = 0;
      let totalBytes = 0;
      let hasError = false;

      tts.speakStream(text, (chunk) => {
        if (hasError) return;

        if (!chunk) {
          console.log(`✅ TTS done — ${totalBytes}B in ${chunkCount} chunks`);
          socket.emit("tts_end");
          resolve();
          return;
        }

        try {
          let base64Chunk;
          if (Buffer.isBuffer(chunk)) {
            base64Chunk = chunk.toString("base64");
          } else if (typeof chunk === "string") {
            base64Chunk = chunk;
          } else {
            base64Chunk = Buffer.from(chunk).toString("base64");
          }

          socket.emit("tts_audio", { audio: base64Chunk });
          chunkCount++;
          totalBytes += chunk.length;
        } catch (error) {
          console.error("❌ Error sending TTS chunk:", error);
          hasError = true;
          reject(error);
        }
      });
    } catch (error) {
      console.error("❌ Error creating TTS stream:", error);
      reject(error);
    }
  });
}

module.exports = { initInterviewSocket };
