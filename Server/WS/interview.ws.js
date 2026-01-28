const WebSocket = require("ws");
const { Interview } = require("../Models/interview.models");
const { evaluateAnswer } = require("../Service/evaluateAnswer.service");
const { generateNextQuestionWithAI } = require("../Service/ai.service");
const { startTTSStream } = require("../Service/tts.service");

const wss = new WebSocket.Server({ port: 8083 });

wss.on("connection", async (client, req) => {
  const params = new URLSearchParams(req.url.replace("/?", ""));
  const interviewId = params.get("interviewId");
  const userId = params.get("userId");

  if (!interviewId || !userId) {
    client.close();
    return;
  }

  let currentQuestion = await Interview.getLatestQuestion(interviewId);
  let questionOrder = currentQuestion.questionOrder;

  // 🎙️ Start Deepgram STT
  const dgSocket = new WebSocket(
    "wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true",
    {
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
    }
  );

  let finalTranscript = "";

  dgSocket.on("message", async (msg) => {
    const data = JSON.parse(msg);
    const transcript = data.channel?.alternatives?.[0]?.transcript;

    if (!transcript) return;

    if (!data.is_final) {
      client.send(JSON.stringify({ type: "partial", text: transcript }));
    }

    if (data.is_final) {
      finalTranscript += transcript + " ";

      const answer = finalTranscript.trim();
      finalTranscript = "";

      // 💾 Save answer
      await Interview.saveAnswer({
        interviewId,
        questionOrder,
        userId,
        answer,
      });

      // 🧠 Evaluate answer
      const evaluation = await evaluateAnswer(answer);

      // 🤖 Generate next question (topic-aware)
      const nextQuestion = await generateNextQuestionWithAI({
        interviewId,
        questionOrder,
        answer,
        evaluation,
      });

      questionOrder++;

      await Interview.saveQuestion({
        interviewId,
        question: nextQuestion,
        questionOrder,
      });

      // 🔊 Speak question (TTS)
      await startTTSStream(client, nextQuestion);

      client.send(
        JSON.stringify({
          type: "next_question",
          question: nextQuestion,
          questionOrder,
        })
      );
    }
  });

  client.on("message", (audio) => {
    if (dgSocket.readyState === WebSocket.OPEN) dgSocket.send(audio);
  });

  client.on("close", () => dgSocket.close());
});

console.log("🎧 Interview Engine running on ws://localhost:8083");
