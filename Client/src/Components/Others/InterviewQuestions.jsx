import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Button } from "../index";
import { Card } from "../Common/Card";

const SOCKET_URL = "http://localhost:3000";

const InterviewQuestions = ({ interviewId, userId, onCancel }) => {
  const [status, setStatus] = useState("connecting");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [serverText, setServerText] = useState("");
  const [userText, setUserText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const canListenRef = useRef(false);
  const hasStartedRef = useRef(false); // NEW: Ref version for immediate access

  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);
  const recognitionRef = useRef(null);
  const micStreamRef = useRef(null);
  const micProcessorRef = useRef(null);

  /* 🔊 AUDIO CONTEXT INIT */
  useEffect(() => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000,
    });
    audioCtxRef.current = audioCtx;
    console.log("🔊 AudioContext initialized at 48kHz");

    return () => {
      if (audioCtx.state !== "closed") {
        audioCtx.close();
      }
    };
  }, []);

  /* 🎤 START SPEECH RECOGNITION - HELPER FUNCTION */
  const startRecognition = () => {
    if (!recognitionRef.current) {
      console.log("🚫 No recognition object available");
      return;
    }

    if (!hasStartedRef.current) {
      console.log("🚫 Interview not started yet");
      return;
    }

    if (!canListenRef.current) {
      console.log("🚫 Not allowed to listen (audio playing or waiting)");
      return;
    }

    if (isListening) {
      console.log("🎤 Already listening, skipping start");
      return;
    }

    try {
      recognitionRef.current.start();
      console.log("✅ Speech recognition started successfully");
    } catch (e) {
      if (e.message.includes("already started")) {
        console.log("🎤 Recognition already running");
      } else {
        console.error("❌ Error starting recognition:", e.message);
      }
    }
  };

  /* 🎤 STOP SPEECH RECOGNITION - HELPER FUNCTION */
  const stopRecognition = () => {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
      console.log("🛑 Speech recognition stopped");
    } catch (e) {
      console.log("Stop recognition error:", e.message);
    }
  };

  /* 🎤 SPEECH RECOGNITION INIT */
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error("❌ SpeechRecognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      console.log("🎤 SpeechRecognition STARTED");
      setIsListening(true);
    };

    recognition.onend = () => {
      console.log("🎤 SpeechRecognition ENDED");
      setIsListening(false);

      // Auto-restart only if conditions are met
      if (
        canListenRef.current &&
        !isPlayingRef.current &&
        hasStartedRef.current
      ) {
        console.log("🔄 Auto-restarting recognition...");
        setTimeout(() => startRecognition(), 100);
      } else {
        console.log("🚫 Not restarting - conditions not met:", {
          canListen: canListenRef.current,
          isPlaying: isPlayingRef.current,
          hasStarted: hasStartedRef.current,
        });
      }
    };

    recognition.onerror = (e) => {
      console.error("🎤 Recognition error:", e.error);
      setIsListening(false);

      // Don't restart on certain errors
      if (e.error === "aborted" || e.error === "no-speech") {
        console.log("🚫 Not restarting due to:", e.error);
        return;
      }

      // Retry on other errors if allowed
      if (
        canListenRef.current &&
        !isPlayingRef.current &&
        hasStartedRef.current
      ) {
        console.log("🔄 Retrying after error...");
        setTimeout(() => startRecognition(), 500);
      }
    };

    recognition.onresult = (e) => {
      const lastResult = e.results[e.results.length - 1];
      if (lastResult.isFinal) {
        const text = lastResult[0].transcript.trim();
        console.log("📝 User said:", text);

        if (!text) {
          console.log("⚠️ Empty transcript, ignoring");
          return;
        }

        setUserText(text);

        // Stop listening after getting answer
        canListenRef.current = false;
        stopRecognition();

        if (socketRef.current?.connected) {
          console.log("📤 Sending transcript to server");
          socketRef.current.emit("final_transcript", { text });
        }
      }
    };

    recognitionRef.current = recognition;
    console.log("✅ Speech recognition initialized");

    return () => {
      try {
        recognition.abort();
      } catch (e) {
        console.log("Recognition cleanup error:", e.message);
      }
      console.log("🎤 Recognition cleaned up");
    };
  }, []); // Empty deps - only initialize once

  /* 📝 HANDLE QUESTIONS */
  function handleQuestion(payload) {
    let questionText = "";
    if (typeof payload === "string") {
      questionText = payload;
    } else if (payload?.question) {
      questionText = payload.question;
    }

    console.log("❓ Received question:", questionText);
    setCurrentQuestion(questionText);
    setServerText(questionText);
  }

  /* 🔊 START INTERVIEW */
  const unlockAudio = async () => {
    if (hasStartedRef.current) return;

    try {
      // Set BOTH state and ref
      setHasStarted(true);
      hasStartedRef.current = true;
      console.log("🚀 Starting interview");

      // Resume AudioContext
      if (audioCtxRef.current?.state === "suspended") {
        await audioCtxRef.current.resume();
        console.log("🔊 AudioContext resumed");
      }

      // Start mic access
      await startMicStreaming();

      // Don't start listening yet - wait for first question
      canListenRef.current = false;
      console.log("⏳ Waiting for first question audio");

      // Emit ready signal
      if (socketRef.current?.connected) {
        console.log("📤 Emitting ready_for_question");
        socketRef.current.emit("ready_for_question");
      } else {
        console.log("⏳ Waiting for socket connection...");
        socketRef.current?.once("connect", () => {
          console.log("📤 Socket connected, emitting ready_for_question");
          socketRef.current.emit("ready_for_question");
        });
      }
    } catch (error) {
      console.error("❌ Error starting interview:", error);
      setHasStarted(false);
      hasStartedRef.current = false;
    }
  };

  /* 🔊 TTS AUDIO PLAYBACK */
  const playNextChunk = async () => {
    const audioCtx = audioCtxRef.current;
    if (!audioCtx) {
      console.error("❌ No AudioContext available");
      isPlayingRef.current = false;
      setIsPlaying(false);
      return;
    }

    if (audioQueueRef.current.length === 0) {
      console.log("✅ Audio queue empty, playback complete");
      isPlayingRef.current = false;
      setIsPlaying(false);

      // NOW enable listening and start recognition
      console.log("🎤 Enabling speech recognition after audio");
      canListenRef.current = true;

      // Give a small delay to ensure audio is fully stopped
      setTimeout(() => {
        console.log("🎤 Attempting to start recognition after delay");
        startRecognition();
      }, 300);

      return;
    }

    try {
      isPlayingRef.current = true;
      setIsPlaying(true);

      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const buffer = audioQueueRef.current.shift();

      // Ensure proper alignment for 16-bit PCM
      const byteLength = buffer.byteLength - (buffer.byteLength % 2);
      const alignedBuffer = buffer.slice(0, byteLength);

      // Convert PCM16 to Float32
      const pcm16 = new Int16Array(alignedBuffer);
      const pcm32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        pcm32[i] = pcm16[i] / 32768.0;
      }

      // Create audio buffer at 48000 Hz
      const audioBuffer = audioCtx.createBuffer(1, pcm32.length, 48000);
      audioBuffer.copyToChannel(pcm32, 0);

      // Create source and play
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      source.onended = () => {
        console.log("🔊 Chunk finished playing");

        // Continue playing if more chunks exist
        if (audioQueueRef.current.length > 0) {
          playNextChunk();
        } else {
          // All chunks done
          isPlayingRef.current = false;
          setIsPlaying(false);
          console.log("🔊 All audio chunks played");

          // Enable listening
          console.log("🎤 Enabling speech recognition after all audio");
          canListenRef.current = true;

          // Give a small delay before starting
          setTimeout(() => {
            console.log("🎤 Attempting to start recognition after delay");
            startRecognition();
          }, 300);
        }
      };

      source.start(0);
      console.log("▶️ Playing audio chunk");
    } catch (error) {
      console.error("❌ Error playing audio:", error);
      isPlayingRef.current = false;
      setIsPlaying(false);

      // Try to recover by enabling listening
      canListenRef.current = true;
      setTimeout(() => startRecognition(), 300);
    }
  };

  /* 🎤 MIC STREAMING */
  const startMicStreaming = async () => {
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
          sampleRate: 48000,
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

        if (socketRef.current?.connected) {
          socketRef.current.emit("user_audio_chunk", pcm16.buffer);
        }
      };

      console.log("🎤 Mic streaming started");
    } catch (error) {
      console.error("❌ Microphone access error:", error);
    }
  };

  /* 🔌 SOCKET.IO */
  useEffect(() => {
    console.log("🔌 Initializing socket connection...");
    const socket = io(SOCKET_URL, {
      query: { interviewId, userId },
      transports: ["websocket"],
      path: "/socket.io",
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      setStatus("live");
    });

    socket.on("question", (data) => {
      console.log("📨 Received 'question' event:", data);
      handleQuestion(data);
    });

    socket.on("next_question", (data) => {
      console.log("📨 Received 'next_question' event:", data);
      handleQuestion(data);
      setUserText(""); // Clear previous answer
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

      // IMPORTANT: Disable listening and stop recognition when audio arrives
      canListenRef.current = false;
      stopRecognition();

      audioQueueRef.current.push(arrayBuffer);

      if (!isPlayingRef.current) {
        console.log("▶️ Starting audio playback");
        playNextChunk();
      }
    });

    socket.on("tts_end", () => {
      console.log("🔔 TTS stream ended");
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
    });

    return () => {
      console.log("🧹 Cleaning up socket and resources...");

      canListenRef.current = false;
      hasStartedRef.current = false;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          console.log("Recognition cleanup error:", e.message);
        }
      }

      if (micProcessorRef.current) {
        try {
          micProcessorRef.current.disconnect();
        } catch (e) {
          console.log("Processor cleanup error:", e.message);
        }
      }

      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      socket.disconnect();
      console.log("🔌 Socket disconnected and cleaned up");
    };
  }, [interviewId, userId]);

  return (
    <section className="space-y-4">
      {!hasStarted && (
        <div className="flex justify-center">
          <Button onClick={unlockAudio} disabled={status !== "live"}>
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
            {/* {serverText && (
              <p className="text-sm text-blue-600 dark:text-blue-400">
                <strong>Question:</strong> {serverText}
              </p>
            )} */}
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
