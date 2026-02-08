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
    maxHttpBufferSize: 10 * 1024 * 1024, // 10MB for video chunks
  });

  io.on("connection", async (socket) => {
    // ✅ Extract all query params at once
    const { interviewId, userId, type } = socket.handshake.query;

    console.log("🔌 New socket connection attempt:", {
      socketId: socket.id,
      interviewId,
      userId,
      type,
    });

    // ✅ Check for missing params early
    if (!interviewId || !userId) {
      console.error("❌ Missing interviewId or userId");
      socket.emit("error", { message: "Missing interview or user ID" });
      return socket.disconnect();
    }

    // ❌❌❌ SECURITY CAMERA BYPASSED - ENTIRE SECURITY CAMERA HANDLER COMMENTED OUT ❌❌❌
    /*
    // ✅ Handle security camera connections separately
    if (type === "security_camera") {
      console.log(`📱 Security camera socket connected: ${interviewId}`);

      // Join interview room for broadcasting
      socket.join(`interview_${interviewId}`);

      // Notify main interview that security camera connected
      socket.on("security_camera_connected", (data) => {
        console.log("✅ Security camera active:", data);

        // Broadcast to main interview client (NOT back to security camera)
        socket
          .to(`interview_${interviewId}`)
          .emit("security_camera_connected", {
            ...data,
            timestamp: Date.now(),
          });

        console.log(
          `📡 Broadcasted security_camera_connected to interview_${interviewId}`,
        );
      });

      // ✅ FIXED: Only broadcast to main interview client, NOT back to sender
      socket.on("security_frame_request", (data, callback) => {
        // Broadcast to main interview client only (excludes sender)
        socket.to(`interview_${interviewId}`).emit("security_frame", {
          frame: data.frame,
          timestamp: data.timestamp || Date.now(),
        });

        // ✅ Acknowledge receipt to prevent queue buildup (matches frontend callback)
        if (callback && typeof callback === "function") {
          callback();
        }
      });

      // Handle security camera disconnection
      socket.on("security_camera_disconnected", (data) => {
        console.warn("⚠️ Security camera disconnected:", data);

        // Notify main interview
        socket
          .to(`interview_${interviewId}`)
          .emit("security_camera_disconnected", {
            ...data,
            timestamp: Date.now(),
          });
      });

      socket.on("disconnect", (reason) => {
        console.log(
          `📱 Security camera socket disconnected: ${interviewId}`,
          reason,
        );

        // Notify main interview that security camera is gone
        socket
          .to(`interview_${interviewId}`)
          .emit("security_camera_disconnected", {
            interviewId,
            userId,
            timestamp: Date.now(),
            reason,
          });
      });

      // Don't continue with interview logic for security camera sockets
      return;
    }
    */
    // ❌❌❌ END OF SECURITY CAMERA HANDLER ❌❌❌

    // ✅ For main interview connections, join the interview room
    socket.join(`interview_${interviewId}`);

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

    // Video upload state
    const videoUploads = {
      primary_camera: { videoId: null, chunks: 0, totalChunks: 0 },
      // ❌ SECURITY CAMERA BYPASSED - Removed security_camera from video uploads
      // security_camera: { videoId: null, chunks: 0, totalChunks: 0 },
      screen_recording: { videoId: null, chunks: 0, totalChunks: 0 },
    };

    // Maximum questions limit
    const MAX_QUESTIONS = 10;

    // ⚡ INITIALIZE IMMEDIATELY
    console.log("📥 Starting IMMEDIATE initialization...");

    try {
      console.log("📥 Verifying interview session:", interviewId);
      const session = await Interview.getSessionById(interviewId);
      console.log("✅ Interview session verified:", session.id);

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

      // ============================================================================
      // VIDEO UPLOAD HANDLERS - Real-time chunk upload during interview
      // ============================================================================

      socket.on("video_recording_start", async (data) => {
        const { videoType, totalChunks, metadata } = data;

        console.log("🎥 Video recording started:", {
          videoType,
          totalChunks,
          metadata,
        });

        try {
          // Create video record in database
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
          };

          console.log(`✅ Video recording session created: ${videoId}`);

          socket.emit("video_recording_ready", {
            videoType,
            videoId,
            message: "Ready to receive video chunks",
          });
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

        // Don't log every chunk to reduce console spam
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

          // Convert base64 to buffer if needed
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

          // Upload chunk to FTP asynchronously (don't block the socket)
          uploadVideoChunk({
            chunkBuffer,
            videoId: videoInfo.videoId,
            chunkNumber,
            totalChunks: videoInfo.totalChunks,
            interviewId,
          })
            .then((result) => {
              videoInfo.chunks++;

              // Send progress update to client
              socket.emit("video_chunk_uploaded", {
                videoType,
                chunkNumber,
                progress: result.progress,
                checksum: result.checksum,
              });

              // Log milestone chunks
              if (chunkNumber % 10 === 0 || isLastChunk) {
                console.log(
                  `✅ Chunk ${chunkNumber} uploaded for ${videoType} (${result.progress}%)`,
                );
              }

              // If this was the last chunk, update total chunks
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

      // ✅ FIX: Finalize video immediately when recording stops
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

          // Update total chunks if provided
          if (totalChunks && totalChunks > 0) {
            videoInfo.totalChunks = totalChunks;
          }

          console.log(`🎬 Finalizing video ${videoType}...`, {
            videoId: videoInfo.videoId,
            chunksReceived: videoInfo.chunks,
            totalChunks: videoInfo.totalChunks,
          });

          // ✅ Finalize video immediately
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
        } catch (error) {
          console.error(`❌ Error finalizing video:`, error);
          socket.emit("video_processing_error", {
            videoType,
            error: error.message,
          });

          // Mark video as failed
          if (videoUploads[videoType]?.videoId) {
            await InterviewVideo.markAsFailed(
              videoUploads[videoType].videoId,
              error.message,
            );
          }
        }
      });

      socket.on("video_upload_status_request", async () => {
        try {
          const videos = await InterviewVideo.getByInterviewId(interviewId);

          const status = videos.map((v) => ({
            videoType: v.video_type,
            uploadStatus: v.upload_status,
            progress: v.upload_progress,
            chunksUploaded: v.uploaded_chunks,
            totalChunks: v.total_chunks,
          }));

          socket.emit("video_upload_status", { videos: status });
        } catch (error) {
          console.error("❌ Error getting video status:", error);
        }
      });

      // ============================================================================
      // EXISTING INTERVIEW HANDLERS - All unchanged
      // ============================================================================

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

          // ✅ FIXED: Connection is already ready after await, no need for waitForReady
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
        console.log("🏁 Ending interview and starting evaluation...");

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

          // ✅ Videos are finalized when video_recording_stop is received
          // No need for processInterviewVideos here

          // ✅ START EVALUATION IMMEDIATELY
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

      // ✅ FIX: Improved Deepgram connection management
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

        // ✅ Wait a bit before creating new connection to ensure old one is closed
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
          }, 300); // Wait 300ms before creating new connection
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

          // ✅ FIXED: Connection is already ready after await, no need for waitForReady
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

          // ✅ FIXED: Connection is already ready after await, no need for waitForReady
          isListeningActive = true;
          socket.emit("listening_enabled");

          isProcessing = false;
        }
      }

      console.log("✅ Deepgram STT ready to start");

      socket.onAny((eventName, ...args) => {
        if (eventName !== "user_audio_chunk" && eventName !== "video_chunk") {
          console.log(`📡 Server received event: "${eventName}"`, args);
        }
      });

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

          // ✅ FIXED: Connection is already ready after await, no need for waitForReady
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

      async function processUserTranscript(text) {
        if (isProcessing) {
          console.log("⚠️ Already processing, ignoring transcript");
          return;
        }

        // ✅ Set processing flag immediately
        isProcessing = true;

        // ✅ Disable listening immediately
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
          console.log("✅ Step 1 complete - Question found:", {
            id: currentQuestion.id,
            order: currentOrder,
            questionText: currentQuestion.question.substring(0, 50),
          });

          console.log("🔍 Step 2: Saving answer...");
          try {
            await Interview.saveAnswer({
              interviewId,
              questionId: currentQuestion.id,
              answer: text,
            });
            console.log("✅ Step 2 complete - Answer saved");
          } catch (saveError) {
            console.error("❌ DATABASE ERROR in Step 2:", {
              error: saveError.message,
              code: saveError.code,
            });
            throw saveError;
          }

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
          console.log(
            `🔍 Step 5: Preparing for next question (order ${nextOrder})`,
          );

          console.log("🔍 Step 6: Generating next question with AI...");
          const nextQuestionText = await generateNextQuestionWithAI({
            answer: text,
            questionOrder: nextOrder,
            previousQuestion: currentQuestion.question,
          });
          console.log(
            "✅ Step 6 complete - Next question generated:",
            nextQuestionText.substring(0, 50) + "...",
          );

          console.log("🔍 Step 7: Saving next question to database...");
          try {
            const nextQuestionId = await Interview.saveQuestion({
              interviewId,
              question: nextQuestionText,
              questionOrder: nextOrder,
              technology: null,
              difficulty: null,
            });

            console.log("✅ Step 7 complete - Next question saved:", {
              id: nextQuestionId,
              order: nextOrder,
            });

            console.log("🔍 Step 8: Incrementing question order...");
            currentOrder = nextOrder;
            currentQuestionText = nextQuestionText;
            console.log(
              `✅ Step 8 complete - Current order now: ${currentOrder}/${MAX_QUESTIONS}`,
            );
          } catch (saveError) {
            console.error("❌ DATABASE ERROR in Step 7:", {
              error: saveError.message,
              code: saveError.code,
            });
            throw saveError;
          }

          console.log("🔍 Step 9: Sending next question to client...");
          const nextQuestionData = { question: nextQuestionText };
          socket.emit("next_question", nextQuestionData);
          console.log("✅ Step 9 complete - next_question event emitted");

          console.log("🔍 Step 10: Waiting before TTS...");
          await new Promise((resolve) => setTimeout(resolve, 200));
          console.log("✅ Step 10 complete");

          console.log("🔍 Step 11: Starting TTS stream...");
          await streamTTSToClient(socket, nextQuestionText);
          console.log("✅ Step 11 complete - TTS finished");

          console.log("🔍 Step 12: Waiting for audio playback...");
          await new Promise((resolve) => setTimeout(resolve, 1500));
          console.log("✅ Step 12 complete");

          console.log("🔍 Step 13: Starting new Deepgram connection...");

          console.log(
            "⏳ Waiting 500ms before creating connection (rate limit prevention)...",
          );
          await new Promise((resolve) => setTimeout(resolve, 500));

          const connection = await startDeepgramConnection();
          console.log("✅ Step 13 complete - Deepgram connection initiated");

          console.log("🔍 Step 14: Enabling listening...");
          // ✅ FIXED: Connection is already ready after await, no need for waitForReady
          isListeningActive = true;
          socket.emit("listening_enabled");
          console.log(
            `✅ Step 14 complete - Listening enabled for question ${currentOrder}/${MAX_QUESTIONS}`,
          );

          console.log("🔍 Step 15: Resetting processing flag...");
          isProcessing = false;
          console.log("✅ Step 15 complete - Ready for next answer");

          console.log("🎉 FULL CYCLE COMPLETE - Ready for user response");
        } catch (error) {
          console.error("❌ Error in processUserTranscript:", error);
          socket.emit("error", {
            message: error.message || "Error processing your answer",
          });
          isProcessing = false;
          isListeningActive = false;

          // ✅ Emit listening_disabled to sync client state
          socket.emit("listening_disabled");
        }
      }

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
      });

      socket.on("error", (error) => {
        console.error("❌ Socket error:", error);
      });

      socket.emit("server_ready");
      console.log("✅ All event listeners registered and ready");
      console.log("📤 Emitted 'server_ready' signal to client");
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
