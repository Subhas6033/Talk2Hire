const { Server } = require("socket.io");
const { Interview } = require("../Models/interview.models.js");
const { validateAnswer } = require("../Service/answervalidations.service.js");
const { generateNextQuestionWithAI } = require("../Service/ai.service.js");
const { createTTSStream } = require("../Service/tts.service.js");

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
    let isInitialized = false;

    // ⚡ CRITICAL: Register ALL event listeners IMMEDIATELY (before any async work)
    socket.onAny((eventName, ...args) => {
      if (eventName !== "user_audio_chunk") {
        console.log(`📡 Server received event: "${eventName}"`, args);
      }
    });

    // Handle ready_for_question event - REGISTER IMMEDIATELY
    socket.on("ready_for_question", async () => {
      console.log("🎯 'ready_for_question' event received!");

      // Wait for initialization to complete
      if (!isInitialized) {
        console.log("⏳ Waiting for initialization to complete...");
        // Wait up to 5 seconds for initialization
        for (let i = 0; i < 50; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (isInitialized) break;
        }
      }

      if (!isInitialized) {
        console.error("❌ Initialization timeout");
        socket.emit("error", { message: "Server initialization timeout" });
        return;
      }

      if (!firstQuestion) {
        console.error("❌ No first question available");
        socket.emit("error", { message: "No question available" });
        return;
      }

      if (firstQuestionSent) {
        console.log("⚠️ First question already sent, ignoring");
        return;
      }

      if (isProcessing) {
        console.log("⚠️ Already processing, ignoring ready_for_question");
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

        await new Promise((resolve) => setTimeout(resolve, 200));

        console.log("🔊 Starting TTS stream for first question");
        await streamTTSToClient(socket, firstQuestion.question);

        console.log("✅ First question fully sent (text + audio)");
        isProcessing = false;
      } catch (error) {
        console.error("❌ Error in ready_for_question handler:", error);
        console.error("Error stack:", error.stack);
        socket.emit("error", { message: "Error loading question" });
        isProcessing = false;
        firstQuestionSent = false;
      }
    });

    // Handle final transcript from user - REGISTER IMMEDIATELY
    socket.on("final_transcript", async ({ text }) => {
      console.log("🎯 'final_transcript' event received!");

      if (!isInitialized) {
        console.log("⚠️ Not initialized yet, ignoring transcript");
        return;
      }

      if (!text || text.trim() === "") {
        console.log("⚠️ Empty transcript received");
        return;
      }

      if (isProcessing) {
        console.log("⚠️ Already processing, ignoring transcript");
        return;
      }

      isProcessing = true;
      console.log("📝 User transcript received:", text);

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

        await new Promise((resolve) => setTimeout(resolve, 200));

        console.log("🔊 Starting TTS stream for next question");
        await streamTTSToClient(socket, nextQuestionText);

        console.log("✅ Next question fully sent");
        isProcessing = false;
      } catch (error) {
        console.error("❌ Error processing transcript:", error);
        console.error("Error stack:", error.stack);
        socket.emit("error", { message: "Error processing your answer" });
        isProcessing = false;
      }
    });

    // Handle user audio chunks
    socket.on("user_audio_chunk", () => {
      // Silent
    });

    // Handle disconnect
    socket.on("disconnect", (reason) => {
      console.log("⚠️ Interview socket disconnected:", {
        socketId: socket.id,
        interviewId,
        reason,
      });
      isProcessing = false;
    });

    // Handle errors
    socket.on("error", (error) => {
      console.error("❌ Socket error:", error);
    });

    console.log("✅ All event listeners registered");

    // NOW do the async initialization work
    (async () => {
      try {
        console.log("📥 Starting initialization...");
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

        // Mark as initialized
        isInitialized = true;
        console.log("✅ ✅ ✅ Initialization complete - ready for questions!");
      } catch (error) {
        console.error("❌ FATAL: Error during initialization:", error);
        console.error("Error stack:", error.stack);
        socket.emit("error", { message: "Failed to initialize interview" });
        socket.disconnect();
      }
    })();
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
