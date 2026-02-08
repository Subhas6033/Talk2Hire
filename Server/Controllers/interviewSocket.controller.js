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
      console.log(
        `🆕 Creating new session storage for interview: ${interviewId}`,
      );
      interviewSessions.set(interviewId, {
        videoUploads: {
          primary_camera: null,
          screen_recording: null,
        },
      });
    }
    return interviewSessions.get(interviewId);
  }

  function cleanupSession(interviewId) {
    console.log(`🧹 Cleaning up persistent session: ${interviewId}`);
    interviewSessions.delete(interviewId);
  }

  io.on("connection", async (socket) => {
    const { interviewId, userId, type } = socket.handshake.query;

    console.log("🔌 New socket connection attempt:", {
      socketId: socket.id,
      interviewId,
      userId,
      type,
      transport: socket.conn.transport.name,
    });

    if (!interviewId || !userId) {
      console.error("❌ Missing interviewId or userId");
      socket.emit("error", { message: "Missing interview or user ID" });
      return socket.disconnect();
    }

    socket.join(`interview_${interviewId}`);

    const session = getOrCreateSession(interviewId);
    const videoUploads = session.videoUploads;

    console.log(
      `📦 Using persistent video session for interview ${interviewId}:`,
      {
        hasPrimaryCameraSession: !!videoUploads.primary_camera,
        hasScreenRecordingSession: !!videoUploads.screen_recording,
      },
    );

    // Interview state
    let currentOrder = 1;
    let isProcessing = false;
    let firstQuestionSent = false;
    let firstQuestion = null;
    let deepgramConnection = null;
    let isListeningActive = false;

    // Idle detection state
    let awaitingRepeatResponse = false;
    let currentQuestionText = "";
    let idleCount = 0;

    const MAX_QUESTIONS = 10;

    console.log("📥 Starting IMMEDIATE initialization...");

    try {
      console.log("📥 Verifying interview session:", interviewId);
      const interviewSession = await Interview.getSessionById(interviewId);
      console.log("✅ Interview session verified:", interviewSession.id);

      console.log("📥 Checking for existing first question...");
      firstQuestion = await Interview.getQuestionByOrder(
        interviewId,
        currentOrder,
      );

      if (!firstQuestion) {
        console.log(
          "⚠️ No first question found, generating default first question...",
        );

        const defaultFirstQuestion =
          "Hello! Let's start with an introduction. Can you tell me about yourself, your background, and what brings you here today?";

        const questionId = await Interview.saveQuestion({
          interviewId,
          question: defaultFirstQuestion,
          questionOrder: currentOrder,
          technology: null,
          difficulty: "easy",
        });

        console.log("✅ First question generated and saved:", questionId);

        firstQuestion = await Interview.getQuestionByOrder(
          interviewId,
          currentOrder,
        );
      }

      if (!firstQuestion) {
        console.error("❌ Failed to load/create first question");
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

      // VIDEO UPLOAD HANDLERS
      socket.on("video_recording_start", async (data) => {
        const { videoType, totalChunks, metadata } = data;

        console.log("🎥 Video recording start request received:", {
          socketId: socket.id,
          socketConnected: socket.connected,
          videoType,
          totalChunks,
          metadata,
          interviewId,
          userId,
        });

        try {
          if (videoUploads[videoType]) {
            console.log(
              `♻️ Video session already exists for ${videoType}, reusing:`,
              {
                videoId: videoUploads[videoType].videoId,
                chunks: videoUploads[videoType].chunks,
              },
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
          };

          console.log(
            `📤 Emitting video_recording_ready to socket ${socket.id}`,
          );

          const responseData = {
            videoType,
            videoId,
            message: "Ready to receive video chunks",
          };

          socket.emit("video_recording_ready", responseData);

          console.log(`✅ Emitted video_recording_ready:`, responseData);
        } catch (error) {
          console.error("❌ Error starting video recording:", error);
          console.error("Error stack:", error.stack);

          socket.emit("video_recording_error", {
            videoType,
            error: error.message,
          });
        }
      });

      socket.on("video_chunk", async (data) => {
        const { videoType, chunkNumber, chunkData, isLastChunk } = data;

        if (chunkNumber === 1 || chunkNumber % 10 === 0 || isLastChunk) {
          console.log(`📦 Received video chunk:`, {
            videoType,
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
                  `✅ Chunk ${chunkNumber} uploaded for ${videoType} (${result.progress}%)`,
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
          console.error(`❌ Error processing video chunk:`, error);
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

          console.log(`🎬 Finalizing video ${videoType}...`, {
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

          console.log(`✅ Video ${videoType} finalized:`, result.ftpUrl);
          console.log(
            `🎬 Video will be automatically merged by background job`,
          );
        } catch (error) {
          console.error(`❌ Error finalizing video:`, error);
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

      // INTERVIEW HANDLERS

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
          idleCount = 0;

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

          console.log(
            "⏳ Waiting 500ms before creating connection (rate limit prevention)...",
          );
          await new Promise((resolve) => setTimeout(resolve, 500));

          const connection = await startDeepgramConnection();

          isListeningActive = true;
          socket.emit("listening_enabled");
          console.log("✅ Listening enabled for user response");

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

          // ✅ START EVALUATION ONLY
          socket.emit("evaluation_started", {
            message: "Evaluating your interview responses...",
          });

          console.log("🔄 Starting automatic evaluation...");

          evaluateInterview(interviewId)
            .then((results) => {
              console.log("✅ Evaluation completed successfully:", {
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

              // ✅ VIDEO MERGE WILL HAPPEN AUTOMATICALLY VIA BACKGROUND JOB
              console.log(
                "🎬 Videos will be merged automatically by background job",
              );

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
          console.log("⚠️ Deepgram connection already exists, closing old one");
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
              onTranscript: async (transcript, data) => {
                console.log(
                  "📝 Deepgram final transcript received:",
                  transcript,
                );

                if (!transcript || transcript.trim() === "") {
                  console.log("⚠️ Empty transcript, ignoring");
                  return;
                }

                if (!isListeningActive) {
                  console.log("🚫 Listening not active, ignoring transcript");
                  return;
                }

                if (isProcessing) {
                  console.log("⚠️ Already processing, ignoring transcript");
                  return;
                }

                if (hasReceivedTranscript) {
                  console.log(
                    "⚠️ Already received transcript, ignoring duplicate",
                  );
                  return;
                }

                hasReceivedTranscript = true;

                isListeningActive = false;
                console.log("🛑 Listening disabled after receiving transcript");

                if (deepgramConnection) {
                  deepgramConnection.pauseIdleDetection();
                }

                socket.emit("transcript_received", { text: transcript });

                if (deepgramConnection) {
                  try {
                    deepgramConnection.finish();
                    console.log(
                      "✅ Deepgram connection closed after transcript",
                    );
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

              onInterim: (transcript, data) => {
                if (transcript && transcript.trim()) {
                  socket.emit("interim_transcript", { text: transcript });
                }
              },

              onError: (error) => {
                console.error("❌ Deepgram STT error:", error);

                if (error.message?.includes("timeout")) {
                  console.error("🚫 Connection never opened - not retrying");
                  socket.emit("error", {
                    message: "Unable to start speech recognition",
                  });
                  isListeningActive = false;
                  return;
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
          idleCount = 0;

          socket.emit("question", { question: currentQuestionText });
          await new Promise((resolve) => setTimeout(resolve, 200));
          await streamTTSToClient(socket, currentQuestionText);

          await new Promise((resolve) => setTimeout(resolve, 1500));

          console.log(
            "⏳ Waiting 500ms before creating connection (rate limit prevention)...",
          );
          await new Promise((resolve) => setTimeout(resolve, 500));

          const connection = await startDeepgramConnection();

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
          idleCount = 0;

          await moveToNextQuestion();
        } else {
          console.log("❓ Unclear response, asking again");
          const clarificationText =
            "I didn't understand. Would you like me to repeat the question? Please say yes or no.";

          socket.emit("idle_prompt", { text: clarificationText });
          await new Promise((resolve) => setTimeout(resolve, 200));
          await streamTTSToClient(socket, clarificationText);

          await new Promise((resolve) => setTimeout(resolve, 1500));

          console.log(
            "⏳ Waiting 500ms before creating connection (rate limit prevention)...",
          );
          await new Promise((resolve) => setTimeout(resolve, 500));

          const connection = await startDeepgramConnection();

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

        console.log("📝 Processing user transcript:", text);
        console.log(
          `📊 Current question order: ${currentOrder}/${MAX_QUESTIONS}`,
        );

        try {
          console.log("🔍 Step 1: Fetching current question...");
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
          console.log("✅ Step 1 complete - Question found");

          console.log("🔍 Step 2: Saving answer...");
          await Interview.saveAnswer({
            interviewId,
            questionId: currentQuestion.id,
            answer: text,
          });
          console.log("✅ Step 2 complete - Answer saved");

          console.log("🔍 Step 3: Validating answer...");
          const validation = validateAnswer(text);
          console.log("✅ Step 3 complete - Validation:", validation);

          console.log("🔍 Step 4: Checking if interview should end...");
          if (currentOrder >= MAX_QUESTIONS) {
            console.log("🎉 Interview complete! Reached maximum questions.");
            await endInterview();
            return;
          }
          console.log("✅ Step 4 complete - Interview continues");

          const nextOrder = currentOrder + 1;

          console.log("🔍 Step 6: Generating next question with AI...");
          const nextQuestionText = await generateNextQuestionWithAI({
            answer: text,
            questionOrder: nextOrder,
            previousQuestion: currentQuestion.question,
          });
          console.log("✅ Step 6 complete - Next question generated");

          console.log("🔍 Step 7: Saving next question to database...");
          await Interview.saveQuestion({
            interviewId,
            question: nextQuestionText,
            questionOrder: nextOrder,
            technology: null,
            difficulty: null,
          });
          console.log("✅ Step 7 complete - Next question saved");

          currentOrder = nextOrder;
          currentQuestionText = nextQuestionText;

          console.log("🔍 Step 9: Sending next question to client...");
          socket.emit("next_question", { question: nextQuestionText });
          console.log("✅ Step 9 complete - next_question event emitted");

          await new Promise((resolve) => setTimeout(resolve, 200));

          console.log("🔍 Step 11: Starting TTS stream...");
          await streamTTSToClient(socket, nextQuestionText);
          console.log("✅ Step 11 complete - TTS finished");

          await new Promise((resolve) => setTimeout(resolve, 1500));

          console.log("🔍 Step 13: Starting new Deepgram connection...");
          await new Promise((resolve) => setTimeout(resolve, 500));

          const connection = await startDeepgramConnection();
          console.log("✅ Step 13 complete - Deepgram connection initiated");

          isListeningActive = true;
          socket.emit("listening_enabled");

          isProcessing = false;

          console.log("🎉 FULL CYCLE COMPLETE - Ready for user response");
        } catch (error) {
          console.error("❌ Error in processUserTranscript:", error);
          socket.emit("error", {
            message: error.message || "Error processing your answer",
          });
          isProcessing = false;
          isListeningActive = false;
          socket.emit("listening_disabled");
        }
      }

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
          console.error("❌ No first question available");
          socket.emit("error", { message: "No question available" });
          return;
        }

        isProcessing = true;
        firstQuestionSent = true;
        console.log("📨 Processing ready_for_question...");

        try {
          currentQuestionText = firstQuestion.question;
          const questionData = { question: firstQuestion.question };
          console.log("📤 Emitting 'question' event");

          socket.emit("question", questionData);
          console.log("✅ 'question' event emitted successfully");

          await new Promise((resolve) => setTimeout(resolve, 200));

          console.log("🔊 Starting TTS stream for first question");
          await streamTTSToClient(socket, firstQuestion.question);

          console.log("✅ First question fully sent (text + audio)");

          await new Promise((resolve) => setTimeout(resolve, 1000));

          console.log(
            "⏳ Waiting 500ms before creating connection (rate limit prevention)...",
          );
          await new Promise((resolve) => setTimeout(resolve, 500));

          console.log("🎤 Starting Deepgram connection for listening...");
          const connection = await startDeepgramConnection();

          isListeningActive = true;
          socket.emit("listening_enabled");
          console.log("✅ Listening enabled for user response");

          isProcessing = false;
        } catch (error) {
          console.error("❌ Error in ready_for_question handler:", error);
          console.error("Error stack:", error.stack);
          socket.emit("error", { message: "Error loading question" });
          isProcessing = false;
          firstQuestionSent = false;
        }
      });

      socket.on("user_audio_chunk", (audioData) => {
        if (!isListeningActive) {
          return;
        }

        if (!deepgramConnection) {
          console.log("⚠️ No Deepgram connection available");
          return;
        }

        const sent = deepgramConnection.send(audioData);

        if (!sent) {
          const state = deepgramConnection.getReadyState();
          console.log("⚠️ Failed to send audio. Connection state:", state);
        }
      });

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
            console.error("❌ Error closing Deepgram connection:", error);
          }
          deepgramConnection = null;
        }

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

      setTimeout(() => {
        socket.emit("server_ready");
        console.log("📤 Emitted 'server_ready' signal to client");
      }, 100);
    } catch (error) {
      console.error("❌ FATAL: Error during initialization:", error);
      console.error("Error stack:", error.stack);
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
    console.log(
      "🎤 Creating TTS stream for text:",
      text.substring(0, 50) + "...",
    );

    try {
      const tts = createTTSStream();
      let chunkCount = 0;
      let totalBytes = 0;
      let hasError = false;

      tts.speakStream(text, (chunk) => {
        if (hasError) {
          return;
        }

        if (!chunk) {
          console.log(
            `✅ TTS stream complete. Total: ${totalBytes} bytes in ${chunkCount} chunks`,
          );
          socket.emit("tts_end");
          resolve();
          return;
        }

        try {
          socket.emit("tts_audio", chunk);
          chunkCount++;
          totalBytes += chunk.length;

          if (chunkCount === 1 || chunkCount % 20 === 0) {
            console.log(
              `📤 Sent chunk #${chunkCount}, ${totalBytes} bytes total`,
            );
          }
        } catch (error) {
          console.error("❌ Error sending audio chunk:", error);
          hasError = true;
          reject(error);
        }
      });
    } catch (error) {
      console.error("❌ Error creating TTS stream:", error);
      console.error("Error stack:", error.stack);
      reject(error);
    }
  });
}

module.exports = { initInterviewSocket };
