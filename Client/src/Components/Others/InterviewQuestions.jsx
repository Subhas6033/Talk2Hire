import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { Button, CameraCheck } from "../index";
import { Card } from "../Common/Card";

const SOCKET_URL = "http://localhost:3000";

// Audio buffering configuration for smooth playback
const AUDIO_CONFIG = {
  MIN_BUFFER_SIZE: 3, // Minimum chunks to buffer before starting playback
  SAMPLE_RATE: 48000,
  RECOGNITION_DELAY: 1500, // Delay before enabling recognition after audio ends
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
  const audioBufferingRef = useRef(false);

  // Recognition control refs
  const canListenRef = useRef(false);
  const isListeningRef = useRef(false);
  const recognitionRef = useRef(null);

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

  // Prevent multiple simultaneous recognition starts
  const recognitionStartingRef = useRef(false);

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

  /* 🎤 STOP SPEECH RECOGNITION */
  const stopRecognition = useCallback(() => {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
      isListeningRef.current = false;
      setIsListening(false);
      console.log("🛑 Speech recognition stopped");
    } catch (e) {
      if (!e.message.includes("stop")) {
        console.log("⚠️ Stop recognition error:", e.message);
      }
    }
  }, []);

  /* 🎤 START SPEECH RECOGNITION */
  const startRecognition = useCallback(() => {
    if (recognitionStartingRef.current) {
      console.log("🚫 Recognition start already in progress");
      return;
    }

    console.log("🎤 startRecognition() called");
    console.log("📊 State check:", {
      hasRecognition: !!recognitionRef.current,
      hasStarted: hasStartedRef.current,
      canListen: canListenRef.current,
      isListening: isListeningRef.current,
      isPlaying: isPlayingRef.current,
      ttsStreamActive: ttsStreamActiveRef.current,
      audioBuffering: audioBufferingRef.current,
    });

    // Guard conditions
    if (!recognitionRef.current) {
      console.log("🚫 No recognition object");
      return;
    }

    if (!hasStartedRef.current) {
      console.log("🚫 Interview not started");
      return;
    }

    if (isCleaningUpRef.current) {
      console.log("🚫 Cleanup in progress");
      return;
    }

    if (!canListenRef.current) {
      console.log("🚫 Not allowed to listen");
      return;
    }

    if (isPlayingRef.current || audioBufferingRef.current) {
      console.log("🚫 Audio is playing or buffering");
      return;
    }

    if (ttsStreamActiveRef.current) {
      console.log("🚫 TTS stream is active");
      return;
    }

    if (isListeningRef.current) {
      console.log("🎤 Already listening");
      return;
    }

    // Attempt to start
    recognitionStartingRef.current = true;

    try {
      recognitionRef.current.start();
      isListeningRef.current = true;
      setIsListening(true);
      console.log("✅ Speech recognition started successfully");
    } catch (e) {
      if (e.message.includes("already started")) {
        console.log("🎤 Recognition already running");
        isListeningRef.current = true;
        setIsListening(true);
      } else {
        console.error("❌ Error starting recognition:", e.message);
        isListeningRef.current = false;
        setIsListening(false);
      }
    } finally {
      setTimeout(() => {
        recognitionStartingRef.current = false;
      }, 100);
    }
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
        audioBuffering: audioBufferingRef.current,
        queueLength: audioQueueRef.current.length,
      });

      if (
        hasStartedRef.current &&
        !isPlayingRef.current &&
        !ttsStreamActiveRef.current &&
        !audioBufferingRef.current &&
        audioQueueRef.current.length === 0
      ) {
        console.log(
          "✅ All conditions met - enabling canListen and starting recognition"
        );
        canListenRef.current = true;

        // Start recognition after a brief delay
        setTimeout(() => {
          startRecognition();
        }, 200);
      } else {
        console.log("❌ Conditions not met for enabling recognition");
      }
    }, AUDIO_CONFIG.RECOGNITION_DELAY);
  }, [clearRecognitionTimeout, startRecognition]);

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
      console.log("🎤 ✅ SpeechRecognition STARTED - Listening...");
      isListeningRef.current = true;
      setIsListening(true);
      recognitionStartingRef.current = false;
    };

    recognition.onend = () => {
      console.log("🎤 SpeechRecognition ENDED");
      isListeningRef.current = false;
      setIsListening(false);
      recognitionStartingRef.current = false;

      if (isCleaningUpRef.current) {
        console.log("🚫 Cleanup in progress, not restarting");
        return;
      }

      if (
        canListenRef.current &&
        !isPlayingRef.current &&
        hasStartedRef.current &&
        !ttsStreamActiveRef.current &&
        !audioBufferingRef.current
      ) {
        console.log("🔄 Auto-restarting recognition in 300ms...");
        setTimeout(() => startRecognition(), 300);
      }
    };

    recognition.onerror = (e) => {
      console.error("🎤 Recognition error:", e.error);
      isListeningRef.current = false;
      setIsListening(false);
      recognitionStartingRef.current = false;

      if (
        e.error === "aborted" ||
        e.error === "no-speech" ||
        e.error === "audio-capture"
      ) {
        console.log("🚫 Not restarting due to:", e.error);
        return;
      }

      if (isCleaningUpRef.current) return;

      if (
        canListenRef.current &&
        !isPlayingRef.current &&
        hasStartedRef.current &&
        !ttsStreamActiveRef.current
      ) {
        console.log("🔄 Retrying after error in 1000ms...");
        setTimeout(() => startRecognition(), 1000);
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

        // Disable listening while processing
        canListenRef.current = false;
        stopRecognition();
        clearRecognitionTimeout();

        if (socketRef.current?.connected) {
          console.log("📤 Sending transcript to server");
          socketRef.current.emit("final_transcript", { text });
        }
      }
    };

    recognitionRef.current = recognition;
    console.log("✅ Speech recognition initialized");

    return () => {
      isCleaningUpRef.current = true;
      clearRecognitionTimeout();
      recognitionStartingRef.current = false;
      try {
        recognition.abort();
      } catch (e) {
        // Ignore
      }
      console.log("🎤 Recognition cleaned up");
    };
  }, [clearRecognitionTimeout, stopRecognition, startRecognition]);

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

  /* 🔊 TTS AUDIO PLAYBACK - PRODUCTION GRADE */
  const playNextChunk = useCallback(async () => {
    const audioCtx = audioCtxRef.current;
    if (!audioCtx) {
      console.error("❌ No AudioContext available");
      isPlayingRef.current = false;
      setIsPlaying(false);
      audioBufferingRef.current = false;
      return;
    }

    // Check if queue is empty
    if (audioQueueRef.current.length === 0) {
      console.log("✅ Audio queue empty");

      // Check if TTS stream is complete
      if (!ttsStreamActiveRef.current) {
        console.log("✅ TTS stream complete - ALL AUDIO FINISHED");
        isPlayingRef.current = false;
        setIsPlaying(false);
        audioBufferingRef.current = false;

        // Enable recognition after delay
        console.log("🎤 Enabling recognition after audio completion");
        enableRecognitionAfterDelay();
      } else {
        // TTS still streaming, wait for more chunks
        console.log("⏳ TTS stream active - waiting for more chunks");
        isPlayingRef.current = false;
        setIsPlaying(false);
        audioBufferingRef.current = true; // Keep buffering flag active
      }
      return;
    }

    try {
      isPlayingRef.current = true;
      setIsPlaying(true);
      audioBufferingRef.current = false;

      // Ensure recognition is stopped
      if (isListeningRef.current) {
        console.log("🛑 Stopping recognition for audio playback");
        stopRecognition();
      }

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

        // Immediately play next chunk if available
        if (audioQueueRef.current.length > 0) {
          console.log("▶️ Playing next chunk immediately...");
          playNextChunk();
        } else {
          // Queue empty after playback
          console.log("🔊 Queue empty after playback");
          if (!ttsStreamActiveRef.current) {
            console.log("✅ TTS complete - all audio finished");
            isPlayingRef.current = false;
            setIsPlaying(false);
            audioBufferingRef.current = false;
            enableRecognitionAfterDelay();
          } else {
            console.log("⏳ TTS still streaming - entering buffering state");
            isPlayingRef.current = false;
            setIsPlaying(false);
            audioBufferingRef.current = true;
          }
        }
      };

      source.start(0);
      console.log("▶️ Audio chunk started");
    } catch (error) {
      console.error("❌ Error playing audio:", error);
      isPlayingRef.current = false;
      setIsPlaying(false);
      audioBufferingRef.current = false;
      currentSourceRef.current = null;
      enableRecognitionAfterDelay();
    }
  }, [stopRecognition, enableRecognitionAfterDelay]);

  /* 🔊 START BUFFERED PLAYBACK */
  const startBufferedPlayback = useCallback(() => {
    if (isPlayingRef.current || audioBufferingRef.current === false) {
      return; // Already playing or not in buffering state
    }

    const queueLength = audioQueueRef.current.length;
    console.log(
      `🎵 Checking buffer: ${queueLength} chunks, min required: ${AUDIO_CONFIG.MIN_BUFFER_SIZE}`
    );

    if (queueLength >= AUDIO_CONFIG.MIN_BUFFER_SIZE) {
      console.log("✅ Buffer threshold met - starting playback");
      audioBufferingRef.current = false;
      playNextChunk();
    } else if (!ttsStreamActiveRef.current && queueLength > 0) {
      // TTS ended but we have some chunks - play immediately
      console.log("✅ TTS ended with remaining chunks - starting playback");
      audioBufferingRef.current = false;
      playNextChunk();
    }
  }, [playNextChunk]);

  /* 🎤 MIC STREAMING */
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

      // Don't allow listening until we receive the first question
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
        // CRITICAL: Set hasStartedRef BEFORE emitting ready_for_question
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
      console.log(
        `📡 Socket event: "${eventName}"`,
        args.length > 0 ? args : ""
      );
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

      // Reset state for new question
      ttsStreamActiveRef.current = true;
      audioBufferingRef.current = true;
      canListenRef.current = false;

      stopRecognition();
      clearRecognitionTimeout();

      handleQuestion(data);
    });

    socket.on("next_question", (data) => {
      console.log("📨 Received 'next_question' event:", data);

      // Reset state for new question
      ttsStreamActiveRef.current = true;
      audioBufferingRef.current = true;
      canListenRef.current = false;

      stopRecognition();
      clearRecognitionTimeout();

      handleQuestion(data);
      setUserText("");
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

      // Mark TTS stream as active
      ttsStreamActiveRef.current = true;

      // Disable listening
      canListenRef.current = false;
      if (isListeningRef.current) {
        stopRecognition();
      }
      clearRecognitionTimeout();

      // Add to queue
      audioQueueRef.current.push(arrayBuffer);
      console.log(`📦 Queue size: ${audioQueueRef.current.length}`);

      // Start buffered playback if conditions are met
      startBufferedPlayback();
    });

    socket.on("tts_end", () => {
      console.log("🔔 TTS stream ended");

      // Mark TTS stream as complete
      ttsStreamActiveRef.current = false;

      // If we're buffering and have chunks, start playing
      if (audioBufferingRef.current && audioQueueRef.current.length > 0) {
        console.log("✅ TTS ended during buffering - starting playback");
        audioBufferingRef.current = false;
        playNextChunk();
      } else if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
        // No audio in queue and not playing - enable recognition
        console.log("✅ TTS ended with empty queue - enabling recognition");
        audioBufferingRef.current = false;
        enableRecognitionAfterDelay();
      } else {
        console.log("⏳ TTS ended but audio still playing");
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
      alert(
        `Interview error: ${error.message || "Unknown error"}. Please refresh and try again.`
      );
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
      recognitionStartingRef.current = false;
      audioBufferingRef.current = false;

      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
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
    stopRecognition,
    clearRecognitionTimeout,
    handleQuestion,
    playNextChunk,
    enableRecognitionAfterDelay,
    startBufferedPlayback,
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
