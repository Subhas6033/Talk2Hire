import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { Button, CameraCheck } from "../index";
import { Card } from "../Common/Card";

const SOCKET_URL = "http://localhost:3000";

// Audio buffering configuration for smooth playback
const AUDIO_CONFIG = {
  MIN_BUFFER_SIZE: 2,
  SAMPLE_RATE: 48000,
  RECOGNITION_DELAY: 1500,
};

const InterviewQuestions = ({ interviewId, userId, onCancel }) => {
  const [status, setStatus] = useState("connecting");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [serverText, setServerText] = useState("");
  const [userText, setUserText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCameraCheck, setShowCameraCheck] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);

  // Audio playback refs
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef(null);

  // Listening state refs
  const canListenRef = useRef(false);
  const isListeningRef = useRef(false);

  // Interview state refs
  const hasStartedRef = useRef(false);
  const serverReadyRef = useRef(false);

  // Timeout management
  const recognitionTimeoutRef = useRef(null);

  // Socket and mic refs
  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const micProcessorRef = useRef(null);
  const isCleaningUpRef = useRef(false);
  const videoRef = useRef(null);

  // TTS stream state
  const ttsStreamActiveRef = useRef(false);

  /* 🔊 AUDIO CONTEXT INIT */
  useEffect(() => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
    });
    audioCtxRef.current = audioCtx;
    console.log(`🔊 AudioContext initialized at ${AUDIO_CONFIG.SAMPLE_RATE}Hz`);

    return () => {
      if (audioCtx.state !== "closed") {
        audioCtx.close();
      }
    };
  }, []);

  /* 🧹 CLEAR RECOGNITION TIMEOUT */
  const clearRecognitionTimeout = useCallback(() => {
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
      console.log("🧹 Recognition timeout cleared");
    }
  }, []);

  /* 🎤 ENABLE LISTENING */
  const enableListening = useCallback(() => {
    console.log("✅ Listening enabled");
    canListenRef.current = true;
    isListeningRef.current = true;
    setIsListening(true);
  }, []);

  /* 🎤 DISABLE LISTENING */
  const disableListening = useCallback(() => {
    console.log("🛑 Listening disabled");
    canListenRef.current = false;
    isListeningRef.current = false;
    setIsListening(false);
  }, []);

  /* 🎤 ENABLE RECOGNITION AFTER DELAY */
  const enableRecognitionAfterDelay = useCallback(() => {
    console.log("⏰ enableRecognitionAfterDelay called");

    clearRecognitionTimeout();

    console.log(
      `⏰ Setting timeout to enable recognition in ${AUDIO_CONFIG.RECOGNITION_DELAY}ms`
    );

    recognitionTimeoutRef.current = setTimeout(() => {
      console.log("🎤 ⏰ Timeout fired - enabling recognition");
      console.log("📊 Final state check:", {
        canListen: canListenRef.current,
        isPlaying: isPlayingRef.current,
        hasStarted: hasStartedRef.current,
        ttsStreamActive: ttsStreamActiveRef.current,
        queueLength: audioQueueRef.current.length,
      });

      if (
        hasStartedRef.current &&
        !isPlayingRef.current &&
        !ttsStreamActiveRef.current &&
        audioQueueRef.current.length === 0
      ) {
        console.log("✅ All conditions met - enabling listening");
        enableListening();
      } else {
        console.log("❌ Conditions not met for enabling recognition");
      }
    }, AUDIO_CONFIG.RECOGNITION_DELAY);
  }, [clearRecognitionTimeout, enableListening]);

  /* 📝 HANDLE QUESTIONS */
  const handleQuestion = useCallback((payload) => {
    let questionText = "";
    if (typeof payload === "string") {
      questionText = payload;
    } else if (payload?.question) {
      questionText = payload.question;
    }

    console.log("❓ Received question:", questionText);
    setCurrentQuestion(questionText);
    setServerText(questionText);
  }, []);

  /* 🔊 TTS AUDIO PLAYBACK */
  const playNextChunk = useCallback(async () => {
    const audioCtx = audioCtxRef.current;
    if (!audioCtx) {
      console.error("❌ No AudioContext available");
      isPlayingRef.current = false;
      setIsPlaying(false);
      return;
    }

    if (audioQueueRef.current.length === 0) {
      console.log("✅ Audio queue empty");
      isPlayingRef.current = false;
      setIsPlaying(false);

      if (!ttsStreamActiveRef.current) {
        console.log("✅ TTS stream complete - ALL AUDIO FINISHED");
        enableRecognitionAfterDelay();
      } else {
        console.log("⏳ TTS stream active - waiting for more chunks");
      }
      return;
    }

    try {
      isPlayingRef.current = true;
      setIsPlaying(true);

      // Disable listening during playback
      disableListening();

      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const buffer = audioQueueRef.current.shift();
      console.log(
        "🔊 Playing chunk, queue remaining:",
        audioQueueRef.current.length
      );

      const byteLength = buffer.byteLength - (buffer.byteLength % 2);
      const alignedBuffer = buffer.slice(0, byteLength);

      const pcm16 = new Int16Array(alignedBuffer);
      const pcm32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        pcm32[i] = pcm16[i] / 32768.0;
      }

      const audioBuffer = audioCtx.createBuffer(
        1,
        pcm32.length,
        AUDIO_CONFIG.SAMPLE_RATE
      );
      audioBuffer.copyToChannel(pcm32, 0);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      currentSourceRef.current = source;

      source.onended = () => {
        currentSourceRef.current = null;
        console.log(
          "🔊 Chunk finished, remaining:",
          audioQueueRef.current.length
        );
        playNextChunk();
      };

      source.start(0);
      console.log("▶️ Audio chunk started");
    } catch (error) {
      console.error("❌ Error playing audio:", error);
      isPlayingRef.current = false;
      setIsPlaying(false);
      currentSourceRef.current = null;

      if (audioQueueRef.current.length > 0) {
        setTimeout(() => playNextChunk(), 100);
      } else if (!ttsStreamActiveRef.current) {
        enableRecognitionAfterDelay();
      }
    }
  }, [disableListening, enableRecognitionAfterDelay]);

  /* 🎤 MIC STREAMING - Only sends to server, no client-side recognition */
  const startMicStreaming = useCallback(async () => {
    if (micStreamRef.current) {
      console.log("🎤 Mic already streaming");
      return;
    }

    try {
      console.log("🎤 Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
          channelCount: 1,
        },
      });
      micStreamRef.current = stream;
      console.log("✅ Microphone access granted");

      const audioCtx = audioCtxRef.current;
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;

      source.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);

        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // CRITICAL: Only send to server when BOTH conditions are true:
        // 1. Socket is connected
        // 2. Listening is active (server has enabled it)
        if (
          socketRef.current?.connected &&
          isListeningRef.current &&
          canListenRef.current
        ) {
          socketRef.current.emit("user_audio_chunk", pcm16.buffer);
        }
      };

      console.log("🎤 Mic streaming started");
    } catch (error) {
      console.error("❌ Microphone access error:", error);
      alert(
        "Microphone access denied. Please allow microphone access and try again."
      );
    }
  }, []);

  /* 🔊 START INTERVIEW */
  const unlockAudio = useCallback(async () => {
    if (hasStartedRef.current) {
      console.log("🚫 Interview already started");
      return;
    }

    try {
      console.log("🚀 Starting interview...");

      if (audioCtxRef.current?.state === "suspended") {
        await audioCtxRef.current.resume();
        console.log("🔊 AudioContext resumed");
      }

      await startMicStreaming();

      canListenRef.current = false;
      console.log("⏳ Waiting for server to be ready...");

      if (!serverReadyRef.current) {
        console.log("⏳ Server not ready, waiting for signal...");

        let waitTime = 0;
        const maxWait = 10000;
        const checkInterval = 100;

        while (!serverReadyRef.current && waitTime < maxWait) {
          await new Promise((resolve) => setTimeout(resolve, checkInterval));
          waitTime += checkInterval;
        }

        if (!serverReadyRef.current) {
          console.error("❌ Server ready timeout");
          alert("Server initialization timeout. Please refresh and try again.");
          return;
        }
      }

      console.log("✅ Server ready, requesting first question");

      if (socketRef.current?.connected) {
        hasStartedRef.current = true;
        setHasStarted(true);
        console.log("✅ hasStartedRef set to TRUE");

        socketRef.current.emit("ready_for_question");
      } else {
        console.error("⚠️ Socket not connected");
        alert("Connection error. Please refresh and try again.");
      }
    } catch (error) {
      console.error("❌ Error starting interview:", error);
      hasStartedRef.current = false;
      setHasStarted(false);
    }
  }, [startMicStreaming]);

  /* 📹 CAMERA HANDLERS */
  const handleCameraSuccess = useCallback(
    async (stream) => {
      setCameraStream(stream);
      setShowCameraCheck(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      await unlockAudio();
    },
    [unlockAudio]
  );

  const handleStartInterview = useCallback(() => {
    setShowCameraCheck(true);
  }, []);

  /* 🎥 UPDATE VIDEO REF WHEN CAMERA STREAM CHANGES */
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  /* 🔌 SOCKET.IO */
  useEffect(() => {
    console.log("🔌 Initializing socket connection...");
    const socket = io(SOCKET_URL, {
      query: { interviewId, userId },
      transports: ["websocket"],
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.onAny((eventName, ...args) => {
      if (eventName !== "user_audio_chunk") {
        console.log(
          `📡 Socket event: "${eventName}"`,
          args.length > 0 ? args : ""
        );
      }
    });

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      setStatus("live");
    });

    socket.on("server_ready", () => {
      console.log("✅ Server ready!");
      serverReadyRef.current = true;
    });

    socket.on("question", (data) => {
      console.log("📨 Received 'question' event:", data);

      ttsStreamActiveRef.current = true;
      disableListening();
      clearRecognitionTimeout();
      audioQueueRef.current = [];

      handleQuestion(data);
    });

    socket.on("next_question", (data) => {
      console.log("📨 Received 'next_question' event:", data);

      ttsStreamActiveRef.current = true;
      disableListening();
      clearRecognitionTimeout();
      audioQueueRef.current = [];

      handleQuestion(data);
      setUserText("");
    });

    // Handle transcript received from server
    socket.on("transcript_received", ({ text }) => {
      console.log("📝 Transcript received from server:", text);
      setUserText(text);
      disableListening();
    });

    // Handle listening enabled signal from server
    socket.on("listening_enabled", () => {
      console.log("✅ Server enabled listening");
      enableListening();
    });

    socket.on("tts_audio", (chunk) => {
      if (!chunk) {
        console.log("⚠️ Received empty audio chunk");
        return;
      }

      let arrayBuffer;

      if (chunk instanceof ArrayBuffer) {
        arrayBuffer = chunk;
      } else if (chunk instanceof Uint8Array || chunk instanceof Buffer) {
        arrayBuffer = chunk.buffer.slice(
          chunk.byteOffset,
          chunk.byteOffset + chunk.byteLength
        );
      } else if (chunk.buffer) {
        arrayBuffer = chunk.buffer.slice(
          chunk.byteOffset,
          chunk.byteOffset + chunk.byteLength
        );
      } else {
        console.error("❌ Unknown audio chunk format:", typeof chunk);
        return;
      }

      if (arrayBuffer.byteLength === 0) {
        console.log("⚠️ Received empty audio buffer");
        return;
      }

      console.log("🔊 Received audio chunk:", arrayBuffer.byteLength, "bytes");

      ttsStreamActiveRef.current = true;
      disableListening();
      clearRecognitionTimeout();

      audioQueueRef.current.push(arrayBuffer);
      console.log(`📦 Queue size: ${audioQueueRef.current.length}`);

      if (!isPlayingRef.current) {
        if (
          audioQueueRef.current.length >= AUDIO_CONFIG.MIN_BUFFER_SIZE ||
          audioQueueRef.current.length === 1
        ) {
          console.log("✅ Starting playback - buffer threshold met");
          playNextChunk();
        } else {
          console.log(
            `⏳ Buffering... (${audioQueueRef.current.length}/${AUDIO_CONFIG.MIN_BUFFER_SIZE})`
          );
        }
      }
    });

    socket.on("interview_complete", (data) => {
      console.log("🎉 Interview completed:", data);
      setCurrentQuestion("Interview completed! Thank you for your time.");
      disableListening();

      alert(
        `Interview completed! You answered ${data.totalQuestions} questions.`
      );
    });

    socket.on("tts_end", () => {
      console.log("🔔 TTS stream ended");
      ttsStreamActiveRef.current = false;

      if (!isPlayingRef.current && audioQueueRef.current.length > 0) {
        console.log("✅ TTS ended - playing remaining chunks");
        playNextChunk();
      } else if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
        console.log("✅ TTS ended with empty queue - enabling recognition");
        enableRecognitionAfterDelay();
      }
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connect error:", err.message);
      setStatus("error");
    });

    socket.on("disconnect", (reason) => {
      console.log("⚠️ Socket disconnected:", reason);
      setStatus("disconnected");
    });

    socket.on("error", (error) => {
      console.error("❌ Socket error:", error);

      // Only show critical errors to user
      if (
        error.message &&
        !error.message.includes("Speech recognition") &&
        !error.message.includes("recognition error")
      ) {
        alert(
          `Interview error: ${error.message}. Please refresh and try again.`
        );
      }

      setStatus("error");
    });

    return () => {
      console.log("🧹 Cleaning up socket and resources...");
      isCleaningUpRef.current = true;

      clearRecognitionTimeout();

      canListenRef.current = false;
      hasStartedRef.current = false;
      serverReadyRef.current = false;
      ttsStreamActiveRef.current = false;

      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }

      if (micProcessorRef.current) {
        try {
          micProcessorRef.current.disconnect();
        } catch (e) {
          // Ignore
        }
      }

      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }

      socket.disconnect();
      console.log("🔌 Cleanup complete");
    };
  }, [
    interviewId,
    userId,
    cameraStream,
    disableListening,
    clearRecognitionTimeout,
    handleQuestion,
    playNextChunk,
    enableRecognitionAfterDelay,
  ]);

  return (
    <section className="space-y-4">
      <CameraCheck
        isOpen={showCameraCheck}
        onClose={() => setShowCameraCheck(false)}
        onSuccess={handleCameraSuccess}
      />

      {hasStarted && cameraStream && (
        <div className="fixed top-20 right-5 z-50 w-48 h-36 bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover mirror"
            style={{ transform: "scaleX(-1)" }}
          />
          <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white">
            You
          </div>
        </div>
      )}

      {!hasStarted && (
        <div className="flex justify-center">
          <Button onClick={handleStartInterview} disabled={status !== "live"}>
            {status === "connecting" ? "Connecting..." : "Start Interview"}
          </Button>
        </div>
      )}

      <Card>
        <div className="text-lg min-h-20 p-4">
          {status === "connecting" && (
            <p className="text-gray-400">Connecting to interview server...</p>
          )}
          {status === "live" && !currentQuestion && hasStarted && (
            <p className="text-gray-400">Loading first question...</p>
          )}
          {status === "live" && currentQuestion && (
            <p className="text-gray-900 dark:text-gray-100">
              {currentQuestion}
            </p>
          )}
          {status === "error" && (
            <p className="text-red-500">
              Connection error. Please refresh the page.
            </p>
          )}
          {status === "disconnected" && (
            <p className="text-yellow-500">Disconnected from server.</p>
          )}
        </div>

        {hasStarted && (
          <div className="px-4 pb-4 space-y-2">
            {userText && (
              <p className="text-sm text-green-600 dark:text-green-400">
                <strong>Your answer:</strong> {userText}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${isPlaying ? "bg-blue-500 animate-pulse" : "bg-gray-300"}`}
              ></span>
              <span>{isPlaying ? "Playing question..." : "Audio ready"}</span>

              <span
                className={`inline-block w-2 h-2 rounded-full ml-4 ${isListening ? "bg-green-500 animate-pulse" : "bg-gray-300"}`}
              ></span>
              <span>{isListening ? "Listening..." : "Mic standby"}</span>
            </div>
          </div>
        )}
      </Card>

      {hasStarted && (
        <Card>
          <div className="flex justify-end gap-3 p-4">
            <Button variant="secondary" onClick={onCancel}>
              End Interview
            </Button>
          </div>
        </Card>
      )}
    </section>
  );
};

export default InterviewQuestions;
