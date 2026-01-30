const { Server } = require("socket.io");
const { Interview } = require("../Models/interview.models.js");
const { validateAnswer } = require("../Service/answervalidations.service.js");
const { generateNextQuestionWithAI } = require("../Service/ai.service.js");
const { createTTSStream } = require("../Service/tts.service.js");
const { createSTTSession } = require("../Service/stt.service.js");

function initInterviewSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", async (socket) => {
    const { interviewId, userId } = socket.handshake.query;

    console.log("🔌 New socket connection attempt:", {
      socketId: socket.id,
      interviewId,
      userId,
    });

    if (!interviewId || !userId) {
      console.error("❌ Missing interviewId or userId");
      socket.emit("error", { message: "Missing interview or user ID" });
      return socket.disconnect();
    }

    let currentOrder = 1;
    let isProcessing = false;
    let firstQuestionSent = false;
    let firstQuestion = null;
    let deepgramConnection = null;
    let isListeningActive = false;

    // ⚡ INITIALIZE IMMEDIATELY (synchronously block until complete)
    console.log("📥 Starting IMMEDIATE initialization...");

    try {
      console.log("📥 Verifying interview session:", interviewId);
      const session = await Interview.getSessionById(interviewId);
      console.log("✅ Interview session verified:", session.id);

      console.log("📥 Checking for existing first question...");
      firstQuestion = await Interview.getQuestionByOrder(
        interviewId,
        currentOrder
      );

      if (!firstQuestion) {
        console.log(
          "⚠️ No first question found, generating default first question..."
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
          currentOrder
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

      // Function to start Deepgram connection
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

        console.log("🎤 Creating new Deepgram connection...");
        const sttSession = createSTTSession();

        let hasReceivedTranscript = false;

        deepgramConnection = sttSession.startLiveTranscription({
          onTranscript: async (transcript, data) => {
            console.log("📝 Deepgram final transcript received:", transcript);

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

            // Prevent duplicate processing
            if (hasReceivedTranscript) {
              console.log("⚠️ Already received transcript, ignoring duplicate");
              return;
            }

            hasReceivedTranscript = true;

            // Stop listening while processing
            isListeningActive = false;
            console.log("🛑 Listening disabled after receiving transcript");

            // Notify client that transcript was received
            socket.emit("transcript_received", { text: transcript });

            // Close the current Deepgram connection
            if (deepgramConnection) {
              try {
                deepgramConnection.finish();
              } catch (e) {
                console.error("Error finishing connection:", e);
              }
              deepgramConnection = null;
            }

            // Process the transcript
            await processUserTranscript(transcript);
          },

          onInterim: (transcript, data) => {
            // Send interim results to client for real-time feedback
            if (transcript && transcript.trim()) {
              socket.emit("interim_transcript", { text: transcript });
            }
          },

          onError: (error) => {
            console.error("❌ Deepgram STT error:", error);

            // Check if connection ever opened
            if (error.message?.includes("timeout")) {
              console.error("🚫 Connection never opened - not retrying");
              socket.emit("error", {
                message: "Unable to start speech recognition",
              });
              isListeningActive = false;
              return;
            }

            // Don't auto-retry, let user manually restart if needed
            isListeningActive = false;
          },

          onClose: () => {
            console.log("🔌 Deepgram STT connection closed");
            deepgramConnection = null;
          },
        });

        console.log("✅ Deepgram connection created");
        return deepgramConnection;
      }

      console.log("✅ Deepgram STT ready to start");

      // NOW register event listeners AFTER initialization is complete
      socket.onAny((eventName, ...args) => {
        if (eventName !== "user_audio_chunk") {
          console.log(`📡 Server received event: "${eventName}"`, args);
        }
      });

      // Handle ready_for_question event
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
          const questionData = { question: firstQuestion.question };
          console.log("📤 Emitting 'question' event");

          socket.emit("question", questionData);
          console.log("✅ 'question' event emitted successfully");

          // Small delay to ensure client receives text before audio
          await new Promise((resolve) => setTimeout(resolve, 200));

          console.log("🔊 Starting TTS stream for first question");
          await streamTTSToClient(socket, firstQuestion.question);

          console.log("✅ First question fully sent (text + audio)");

          // Wait a bit for client to finish playing audio
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Start fresh Deepgram connection for listening
          console.log("🎤 Starting Deepgram connection for listening...");
          startDeepgramConnection();

          // Enable listening after question is complete
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

      // Handle user audio chunks - send to Deepgram
      socket.on("user_audio_chunk", (audioData) => {
        // Only process if listening is active
        if (!isListeningActive) {
          return;
        }

        if (!deepgramConnection) {
          console.log("⚠️ No Deepgram connection available");
          return;
        }

        // Send audio to Deepgram
        const sent = deepgramConnection.send(audioData);

        if (!sent) {
          const state = deepgramConnection.getReadyState();
          console.log("⚠️ Failed to send audio. Connection state:", state);
        }
      });

      // Process user transcript function
      async function processUserTranscript(text) {
        if (isProcessing) {
          console.log("⚠️ Already processing, ignoring transcript");
          return;
        }

        isProcessing = true;
        console.log("📝 Processing user transcript:", text);

        try {
          const currentQuestion = await Interview.getQuestionByOrder(
            interviewId,
            currentOrder
          );

          if (!currentQuestion) {
            console.error("❌ Current question not found:", currentOrder);
            socket.emit("error", { message: "Question not found" });
            isProcessing = false;
            return;
          }

          console.log("💾 Saving answer for question:", currentQuestion.id);
          await Interview.saveAnswer({
            interviewId,
            questionId: currentQuestion.id,
            answer: text,
          });

          const validation = validateAnswer(text);
          console.log("✅ Answer validated:", validation);

          console.log("🤖 Generating next question with AI...");
          const nextQuestionText = await generateNextQuestionWithAI({
            answer: text,
            questionOrder: currentOrder + 1,
            previousQuestion: currentQuestion.question,
          });

          console.log(
            "✅ Next question generated:",
            nextQuestionText.substring(0, 50) + "..."
          );

          currentOrder++;

          const nextQuestionId = await Interview.saveQuestion({
            interviewId,
            question: nextQuestionText,
            questionOrder: currentOrder,
          });

          console.log("💾 Next question saved:", {
            id: nextQuestionId,
            order: currentOrder,
          });

          const nextQuestionData = { question: nextQuestionText };
          console.log("📤 Emitting 'next_question' event");
          socket.emit("next_question", nextQuestionData);

          // Small delay to ensure client receives text before audio
          await new Promise((resolve) => setTimeout(resolve, 200));

          console.log("🔊 Starting TTS stream for next question");
          await streamTTSToClient(socket, nextQuestionText);

          console.log("✅ Next question fully sent");

          // Wait a bit for client to finish playing audio
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Start fresh Deepgram connection for next answer
          console.log("🎤 Starting Deepgram connection for next answer...");
          startDeepgramConnection();

          // Enable listening for next answer
          isListeningActive = true;
          socket.emit("listening_enabled");
          console.log("✅ Listening enabled for next response");

          isProcessing = false;
        } catch (error) {
          console.error("❌ Error processing transcript:", error);
          console.error("Error stack:", error.stack);
          socket.emit("error", { message: "Error processing your answer" });
          isProcessing = false;
          // Don't re-enable listening on error, let user refresh
        }
      }

      // Handle disconnect
      socket.on("disconnect", (reason) => {
        console.log("⚠️ Interview socket disconnected:", {
          socketId: socket.id,
          interviewId,
          reason,
        });

        // Clean up Deepgram connection
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
      });

      // Handle errors
      socket.on("error", (error) => {
        console.error("❌ Socket error:", error);
      });

      console.log("✅ All event listeners registered and ready");

      // Emit ready signal to client
      socket.emit("server_ready");
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
      text.substring(0, 50) + "..."
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
            `✅ TTS stream complete. Total: ${totalBytes} bytes in ${chunkCount} chunks`
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
              `📤 Sent chunk #${chunkCount}, ${totalBytes} bytes total`
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
