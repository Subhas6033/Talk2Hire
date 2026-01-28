// controllers/interview.socket.js
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

    if (!interviewId || !userId) {
      console.error("❌ Missing interviewId or userId");
      return socket.disconnect();
    }

    console.log("✅ Socket connected:", {
      socketId: socket.id,
      interviewId,
      userId,
    });

    // Create TTS instance per connection
    const tts = createTTSStream();
    let currentOrder = 1;

    try {
      // Get or create first question
      const firstQuestion = await Interview.getQuestionByOrder(
        interviewId,
        currentOrder
      );

      if (!firstQuestion) {
        console.error("❌ No first question found for interview:", interviewId);
        socket.emit("error", {
          message: "Interview not found or has no questions",
        });
        return socket.disconnect();
      }

      console.log("📝 First question loaded:", firstQuestion.question);

      // Handle ready_for_question event
      socket.on("ready_for_question", async () => {
        console.log("📨 Client ready for question");

        try {
          // Send question text immediately
          const questionData = { question: firstQuestion.question };
          console.log("📤 Emitting question:", questionData);
          socket.emit("question", questionData);

          // Stream TTS audio
          console.log("🔊 Starting TTS stream for first question");
          console.log(
            "🔊 Question text:",
            firstQuestion.question.substring(0, 100) + "..."
          );

          tts.speakStream(firstQuestion.question, (chunk) => {
            if (!chunk) {
              console.log("✅ TTS stream ended for first question");
              socket.emit("tts_end");
              return;
            }

            console.log("📤 Sending audio chunk:", chunk.length, "bytes");
            socket.emit("tts_audio", chunk);
          });
        } catch (error) {
          console.error("❌ Error in ready_for_question:", error);
          socket.emit("error", { message: "Error loading question" });
        }
      });

      // Handle final transcript from user
      socket.on("final_transcript", async ({ text }) => {
        if (!text || text.trim() === "") {
          console.log("⚠️ Empty transcript received");
          return;
        }

        console.log("📝 User transcript received:", text);

        try {
          // Get current question
          const currentQuestion = await Interview.getQuestionByOrder(
            interviewId,
            currentOrder
          );

          if (!currentQuestion) {
            console.error("❌ Current question not found:", currentOrder);
            return;
          }

          // Save user's answer
          console.log("💾 Saving answer for question:", currentQuestion.id);
          await Interview.saveAnswer({
            interviewId,
            questionId: currentQuestion.id,
            answer: text,
          });

          // Validate answer
          const validation = validateAnswer(text);
          console.log("✅ Answer validated:", validation);

          // Generate next question with AI
          console.log("🤖 Generating next question with AI...");
          const nextQuestionText = await generateNextQuestionWithAI({
            answer: text,
            weak: validation.status !== "strong",
            previousQuestion: currentQuestion.question,
            interviewId,
          });

          console.log("✅ Next question generated:", nextQuestionText);

          // Increment order
          currentOrder++;

          // Save next question
          await Interview.saveQuestion({
            interviewId,
            question: nextQuestionText,
            questionOrder: currentOrder,
          });

          console.log("💾 Next question saved with order:", currentOrder);

          // Send next question text immediately
          const nextQuestionData = { question: nextQuestionText };
          console.log("📤 Emitting next_question:", nextQuestionData);
          socket.emit("next_question", nextQuestionData);

          // Stream TTS for next question
          console.log("🔊 Starting TTS stream for next question");
          console.log(
            "🔊 Question text:",
            nextQuestionText.substring(0, 100) + "..."
          );

          tts.speakStream(nextQuestionText, (chunk) => {
            if (!chunk) {
              console.log("✅ TTS stream ended for next question");
              socket.emit("tts_end");
              return;
            }

            console.log("📤 Sending audio chunk:", chunk.length, "bytes");
            socket.emit("tts_audio", chunk);
          });
        } catch (error) {
          console.error("❌ Error processing transcript:", error);
          socket.emit("error", { message: "Error processing your answer" });
        }
      });

      // Handle user audio chunks (for potential STT processing)
      socket.on("user_audio_chunk", (audioData) => {
        // This can be used for real-time STT if needed
        // For now, we're relying on browser's SpeechRecognition
        // console.log("🎤 Received audio chunk:", audioData.byteLength, "bytes");
      });

      // Handle disconnect
      socket.on("disconnect", (reason) => {
        console.log("⚠️ Interview socket disconnected:", {
          socketId: socket.id,
          interviewId,
          reason,
        });
      });

      // Handle errors
      socket.on("error", (error) => {
        console.error("❌ Socket error:", error);
      });
    } catch (error) {
      console.error("❌ Error initializing interview socket:", error);
      socket.emit("error", { message: "Error initializing interview" });
      socket.disconnect();
    }
  });

  // Global error handler
  io.on("error", (error) => {
    console.error("❌ Socket.IO server error:", error);
  });

  console.log("🔌 Socket.IO interview server ready");
}

module.exports = { initInterviewSocket };
