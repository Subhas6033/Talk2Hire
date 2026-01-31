import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { Button } from "../index";
import { Card } from "../Common/Card";

const SOCKET_URL = import.meta.env.VITE_WS_URL;

// Audio buffering configuration for smooth playback
const AUDIO_CONFIG = {
  MIN_BUFFER_SIZE: 3,
  SAMPLE_RATE: 48000,
  RECOGNITION_DELAY: 1500,
};

const InterviewQuestions = ({
  interviewId,
  userId,
  cameraStream,
  onCancel,
}) => {
  const [status, setStatus] = useState("connecting");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [serverText, setServerText] = useState("");
  const [userText, setUserText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [idlePrompt, setIdlePrompt] = useState("");
  const [recordingDuration, setRecordingDuration] = useState("00:00");

  // Recording timer
  const recordingStartTimeRef = useRef(null);
  const recordingTimerRef = useRef(null);

  // Format seconds to MM:SS
  const formatDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, []);

  // Start recording timer when interview starts
  useEffect(() => {
    if (!isInitializing && status === "live") {
      recordingStartTimeRef.current = Date.now();

      recordingTimerRef.current = setInterval(() => {
        if (recordingStartTimeRef.current) {
          const elapsed = Math.floor(
            (Date.now() - recordingStartTimeRef.current) / 1000
          );
          setRecordingDuration(formatDuration(elapsed));
        }
      }, 1000);

      return () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
      };
    }
  }, [isInitializing, status, formatDuration]);

  // Log camera stream on mount
  useEffect(() => {
    console.log("📹 InterviewQuestions mounted with cameraStream:", {
      hasStream: !!cameraStream,
      streamActive: cameraStream?.active,
      tracks: cameraStream?.getTracks().length,
    });
  }, []);

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
    // ✅ Clear idle prompt when new question arrives
    setIdlePrompt("");
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
  const autoStartInterview = useCallback(async () => {
    if (hasStartedRef.current) {
      console.log("🚫 Interview already started");
      return;
    }

    try {
      console.log("🚀 Auto-starting interview...");

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
          setIsInitializing(false);
          alert("Server initialization timeout. Please refresh and try again.");
          return;
        }
      }

      console.log("✅ Server ready, requesting first question");

      if (socketRef.current?.connected) {
        hasStartedRef.current = true;
        setIsInitializing(false);
        console.log("✅ hasStartedRef set to TRUE");

        socketRef.current.emit("ready_for_question");
      } else {
        console.error("⚠️ Socket not connected");
        setIsInitializing(false);
        alert("Connection error. Please refresh and try again.");
      }
    } catch (error) {
      console.error("❌ Error starting interview:", error);
      hasStartedRef.current = false;
      setIsInitializing(false);
    }
  }, [startMicStreaming]);

  /* 🎥 SET CAMERA STREAM TO VIDEO */
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      console.log("📹 Setting camera stream to video element");
      videoRef.current.srcObject = cameraStream;

      // Ensure video plays
      videoRef.current.play().catch((err) => {
        console.error("❌ Error playing video:", err);
      });
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

      // Auto-start interview immediately when server is ready
      if (!hasStartedRef.current) {
        console.log("🚀 Auto-starting interview...");
        autoStartInterview();
      }
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

    // ✅ NEW: Handle idle prompt
    socket.on("idle_prompt", ({ text }) => {
      console.log("⏰ Received idle prompt:", text);

      ttsStreamActiveRef.current = true;
      disableListening();
      clearRecognitionTimeout();
      audioQueueRef.current = [];

      setIdlePrompt(text);
    });

    // Handle transcript received from server
    socket.on("transcript_received", ({ text }) => {
      console.log("📝 Transcript received from server:", text);
      setUserText(text);
      disableListening();
      // ✅ Clear idle prompt when user responds
      setIdlePrompt("");
    });

    // Handle listening enabled signal from server
    socket.on("listening_enabled", () => {
      console.log("✅ Server enabled listening");
      enableListening();
    });

    // ✅ NEW: Handle listening disabled signal from server
    socket.on("listening_disabled", () => {
      console.log("🛑 Server disabled listening");
      disableListening();
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
      setIdlePrompt("");

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
      setIsInitializing(false);
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

      // Clear recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }

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
    enableListening,
    autoStartInterview,
  ]);

  return (
    <section className=" p-4 md:p-6">
      <div className="max-w-350 mx-auto h-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 h-full">
          {/* Main Interview Section */}
          <div className="lg:col-span-8 flex flex-col">
            <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800">
              {/* Clean Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                        isPlaying
                          ? "bg-blue-600"
                          : isListening
                            ? "bg-emerald-600"
                            : "bg-gray-700"
                      }`}
                    >
                      {isPlaying ? (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" />
                        </svg>
                      ) : isListening ? (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Interview Assistant
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isPlaying
                        ? "Speaking"
                        : isListening
                          ? "Listening"
                          : "Standby"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Simple status indicators */}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isPlaying
                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        isPlaying ? "bg-blue-600 animate-pulse" : "bg-gray-400"
                      }`}
                    />
                    Audio
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isListening
                        ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        isListening
                          ? "bg-emerald-600 animate-pulse"
                          : "bg-gray-400"
                      }`}
                    />
                    Mic
                  </div>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col p-6 bg-white dark:bg-gray-900">
                {/* Connection States */}
                {status === "connecting" && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-3 border-gray-200 dark:border-gray-700 border-t-blue-600 rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Connecting to server
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Please wait...
                    </p>
                  </div>
                )}

                {status === "live" && isInitializing && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-3 border-gray-200 dark:border-gray-700 border-t-indigo-600 rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Starting interview
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Setting up your session...
                    </p>
                  </div>
                )}

                {status === "live" && !currentQuestion && !isInitializing && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-3 border-gray-200 dark:border-gray-700 border-t-purple-600 rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Loading question
                    </p>
                  </div>
                )}

                {/* Active Interview */}
                {status === "live" && currentQuestion && (
                  <div className="flex-1 flex flex-col justify-center space-y-6">
                    {/* Idle Prompt Display */}
                    {idlePrompt && (
                      <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <svg
                            className="w-5 h-5 text-amber-600 dark:text-amber-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                            Waiting for Response
                          </span>
                        </div>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          {idlePrompt}
                        </p>
                      </div>
                    )}

                    {/* Question */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            Q
                          </span>
                        </div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Question
                        </span>
                      </div>
                      <p className="text-lg md:text-xl text-gray-900 dark:text-gray-100 leading-relaxed">
                        {currentQuestion}
                      </p>
                    </div>

                    {/* Listening Indicator */}
                    {isListening && (
                      <div className="flex items-center gap-2 justify-center pt-4">
                        <div className="flex gap-1">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className="w-1.5 h-1.5 bg-emerald-600 dark:bg-emerald-500 rounded-full animate-bounce"
                              style={{ animationDelay: `${i * 0.1}s` }}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          Listening to your response
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Error States */}
                {status === "error" && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center mb-4">
                      <svg
                        className="w-6 h-6 text-red-600 dark:text-red-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Connection error
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Please refresh and try again
                    </p>
                  </div>
                )}

                {status === "disconnected" && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mb-4">
                      <svg
                        className="w-6 h-6 text-amber-600 dark:text-amber-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Disconnected
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Reconnecting...
                    </p>
                  </div>
                )}
              </div>

              {/* User Response Section */}
              {!isInitializing && userText && (
                <div className="border-t border-gray-200 dark:border-gray-800 p-6 bg-gray-50 dark:bg-gray-900/50">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          A
                        </span>
                      </div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Your Answer
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pl-8">
                      {userText}
                    </p>
                  </div>
                </div>
              )}

              {/* Footer */}
              {!isInitializing && (
                <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-4 bg-white dark:bg-gray-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      Interview active
                    </div>
                    <Button
                      variant="secondary"
                      onClick={onCancel}
                      className="text-xs px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      End Interview
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Camera Section - 4 columns */}
          {cameraStream && (
            <div className="lg:col-span-4 flex flex-col">
              <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Video Preview
                    </h3>
                  </div>
                </div>

                {/* Video Container */}
                <div className="flex-1 p-6 bg-white dark:bg-gray-900 flex items-center">
                  <div className="relative w-full aspect-4/3 bg-gray-900 rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />
                    {/* Recording badge */}
                    <div className="absolute top-3 left-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-md">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs font-medium text-white">
                          REC
                        </span>
                        <span className="text-xs font-mono text-white/80">
                          {recordingDuration}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-4 h-4 text-gray-400 shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Recording for analysis and evaluation
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default InterviewQuestions;
