import { useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  setStatus,
  setServerReady,
  setHasStarted,
  setIsInitializing,
  setIsPlaying,
  enableListening,
  disableListening,
  setTtsStreamActive,
  incrementAudioQueue,
  decrementAudioQueue,
  clearAudioQueue,
  setMicStreamingActive,
  setMicPermissionGranted,
  setCurrentQuestion,
  receiveNextQuestion,
  setUserText,
  receiveFinalAnswer,
  setIdlePrompt,
  startRecording,
  updateRecordingDuration,
  stopRecording,
  completeInterview,
  initializeInterview,
} from "../API/interviewApi";

const AUDIO_CONFIG = {
  MIN_BUFFER_SIZE: 3,
  SAMPLE_RATE: 48000,
  RECOGNITION_DELAY: 2000,
  MAX_RECOGNITION_WAIT: 5000, // ✅ NEW: Max time to wait for recognition
};

export const useInterview = (interviewId, userId, cameraStream) => {
  const dispatch = useDispatch();
  const interview = useSelector((state) => state.interview);

  // Refs
  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const micProcessorRef = useRef(null);
  const currentSourceRef = useRef(null);
  const recognitionTimeoutRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const isCleaningUpRef = useRef(false);

  // Audio queue stored ONLY in ref
  const audioQueueRef = useRef([]);

  // ✅ NEW: Track if we're waiting for more audio chunks
  const waitingForMoreChunksRef = useRef(false);
  const lastChunkReceivedTimeRef = useRef(null);

  // State sync refs
  const isPlayingRef = useRef(false);
  const isListeningRef = useRef(false);
  const canListenRef = useRef(false);
  const hasStartedRef = useRef(false);
  const serverReadyRef = useRef(false);
  const ttsStreamActiveRef = useRef(false);
  const micStreamingActiveRef = useRef(false);

  // Sync Redux to refs
  useEffect(() => {
    isPlayingRef.current = interview.isPlaying;
    isListeningRef.current = interview.isListening;
    canListenRef.current = interview.canListen;
    hasStartedRef.current = interview.hasStarted;
    serverReadyRef.current = interview.serverReady;
    ttsStreamActiveRef.current = interview.ttsStreamActive;
    micStreamingActiveRef.current = interview.micStreamingActive;
  }, [interview]);

  // Initialize AudioContext
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

  // Recording timer
  useEffect(() => {
    if (!interview.isInitializing && interview.status === "live") {
      dispatch(startRecording());

      recordingTimerRef.current = setInterval(() => {
        dispatch(updateRecordingDuration());
      }, 1000);

      return () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
        dispatch(stopRecording());
      };
    }
  }, [interview.isInitializing, interview.status, dispatch]);

  // ✅ IMPROVED: Clear recognition timeout
  const clearRecognitionTimeout = useCallback(() => {
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
      console.log("🧹 Recognition timeout cleared");
    }
  }, []);

  // ✅ IMPROVED: Check if we should enable recognition
  const shouldEnableRecognition = useCallback(() => {
    const shouldEnable =
      hasStartedRef.current &&
      !isPlayingRef.current &&
      !ttsStreamActiveRef.current &&
      audioQueueRef.current.length === 0 &&
      !waitingForMoreChunksRef.current;

    console.log("🎤 shouldEnableRecognition:", {
      hasStarted: hasStartedRef.current,
      isPlaying: isPlayingRef.current,
      ttsActive: ttsStreamActiveRef.current,
      queueLen: audioQueueRef.current.length,
      waitingForChunks: waitingForMoreChunksRef.current,
      result: shouldEnable,
    });

    return shouldEnable;
  }, []);

  // ✅ IMPROVED: Enable recognition with safety checks
  const enableRecognitionAfterDelay = useCallback(() => {
    console.log("⏰ enableRecognitionAfterDelay called");
    clearRecognitionTimeout();

    // ✅ NEW: Check if we recently received a chunk (might get more soon)
    const timeSinceLastChunk =
      Date.now() - (lastChunkReceivedTimeRef.current || 0);

    if (timeSinceLastChunk < 1000 && ttsStreamActiveRef.current) {
      console.log("⏳ Recently received chunk, waiting a bit more...");
      waitingForMoreChunksRef.current = true;

      setTimeout(() => {
        waitingForMoreChunksRef.current = false;
        enableRecognitionAfterDelay();
      }, 1000);
      return;
    }

    console.log(`⏰ Setting ${AUDIO_CONFIG.RECOGNITION_DELAY}ms timeout`);
    recognitionTimeoutRef.current = setTimeout(() => {
      console.log("🎤 Timeout fired - checking conditions");

      if (shouldEnableRecognition()) {
        console.log("✅ Enabling listening");
        dispatch(enableListening());
      } else {
        console.log("❌ Conditions not met, checking again in 1s");

        // ✅ NEW: Retry after a short delay (max 5 seconds total)
        if (timeSinceLastChunk < AUDIO_CONFIG.MAX_RECOGNITION_WAIT) {
          setTimeout(() => enableRecognitionAfterDelay(), 1000);
        } else {
          console.warn("⚠️ Recognition wait timeout - forcing enable");
          dispatch(enableListening());
        }
      }
    }, AUDIO_CONFIG.RECOGNITION_DELAY);
  }, [clearRecognitionTimeout, shouldEnableRecognition, dispatch]);

  // ✅ IMPROVED: Play next chunk with better state management
  const playNextChunk = useCallback(async () => {
    const audioCtx = audioCtxRef.current;
    if (!audioCtx) {
      console.error("❌ No AudioContext");
      dispatch(setIsPlaying(false));
      return;
    }

    // ✅ NEW: If queue is empty but TTS is active, wait a bit
    if (audioQueueRef.current.length === 0) {
      if (ttsStreamActiveRef.current) {
        console.log("⏳ Queue empty but TTS active - waiting for more chunks");
        waitingForMoreChunksRef.current = true;

        // Wait up to 2 seconds for more chunks
        setTimeout(() => {
          if (audioQueueRef.current.length > 0) {
            console.log("✅ Received more chunks - continuing playback");
            playNextChunk();
          } else {
            console.log("⏳ No more chunks received - ending playback");
            waitingForMoreChunksRef.current = false;
            dispatch(setIsPlaying(false));

            if (!ttsStreamActiveRef.current) {
              enableRecognitionAfterDelay();
            }
          }
        }, 2000);
        return;
      }

      console.log("✅ Audio queue empty and TTS complete");
      dispatch(setIsPlaying(false));
      waitingForMoreChunksRef.current = false;
      enableRecognitionAfterDelay();
      return;
    }

    try {
      dispatch(setIsPlaying(true));
      dispatch(disableListening());
      waitingForMoreChunksRef.current = false;

      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const buffer = audioQueueRef.current.shift();
      dispatch(decrementAudioQueue());

      console.log("🔊 Playing chunk, queue:", audioQueueRef.current.length);

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
      console.log("▶️ Chunk started");
    } catch (error) {
      console.error("❌ Audio playback error:", error);
      dispatch(setIsPlaying(false));
      currentSourceRef.current = null;
      waitingForMoreChunksRef.current = false;

      if (audioQueueRef.current.length > 0) {
        setTimeout(() => playNextChunk(), 100);
      } else if (!ttsStreamActiveRef.current) {
        enableRecognitionAfterDelay();
      }
    }
  }, [dispatch, enableRecognitionAfterDelay]);

  // Microphone streaming
  const startMicStreaming = useCallback(async () => {
    if (micStreamRef.current) {
      console.log("🎤 Mic already streaming");
      return;
    }

    try {
      console.log("🎤 Requesting microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
          channelCount: 1,
        },
      });

      micStreamRef.current = stream;
      dispatch(setMicPermissionGranted(true));
      console.log("✅ Microphone granted");

      const audioCtx = audioCtxRef.current;
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;

      source.connect(processor);
      processor.connect(audioCtx.destination);

      dispatch(setMicStreamingActive(true));

      processor.onaudioprocess = (e) => {
        if (!micStreamingActiveRef.current) return;

        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);

        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        if (
          socketRef.current?.connected &&
          isListeningRef.current &&
          canListenRef.current
        ) {
          socketRef.current.emit("user_audio_chunk", pcm16.buffer);
        }
      };

      console.log("🎤 Streaming started");
    } catch (error) {
      console.error("❌ Microphone error:", error);
      alert("Microphone access denied. Please allow and try again.");
    }
  }, [dispatch]);

  // Event Handlers
  const handleQuestion = useCallback(
    (payload) => {
      const questionText =
        typeof payload === "string" ? payload : payload?.question || "";

      console.log("❓ Question:", questionText);
      dispatch(setCurrentQuestion(questionText));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      dispatch(clearAudioQueue());
      clearRecognitionTimeout();
      audioQueueRef.current = [];
      waitingForMoreChunksRef.current = false;
    },
    [dispatch, clearRecognitionTimeout]
  );

  const handleNextQuestion = useCallback(
    (payload) => {
      console.log("📨 Next question:", payload);
      dispatch(receiveNextQuestion(payload));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      dispatch(clearAudioQueue());
      clearRecognitionTimeout();
      audioQueueRef.current = [];
      waitingForMoreChunksRef.current = false;
    },
    [dispatch, clearRecognitionTimeout]
  );

  const handleIdlePrompt = useCallback(
    ({ text }) => {
      console.log("⏰ Idle prompt:", text);
      dispatch(setIdlePrompt(text));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      dispatch(clearAudioQueue());
      clearRecognitionTimeout();
      audioQueueRef.current = [];
      waitingForMoreChunksRef.current = false;
    },
    [dispatch, clearRecognitionTimeout]
  );

  const handleTranscriptReceived = useCallback(
    ({ text }) => {
      console.log("📝 Transcript:", text);
      dispatch(setUserText(text));
      dispatch(disableListening());
    },
    [dispatch]
  );

  const handleFinalAnswer = useCallback(
    (text) => {
      console.log("✅ Final answer:", text);
      dispatch(receiveFinalAnswer(text));
    },
    [dispatch]
  );

  // ✅ IMPROVED: Handle TTS audio with chunk timing
  const handleTtsAudio = useCallback(
    (chunk) => {
      if (!chunk) {
        console.log("⚠️ Empty chunk");
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
        console.error("❌ Unknown chunk format:", typeof chunk);
        return;
      }

      if (arrayBuffer.byteLength === 0) {
        console.log("⚠️ Empty buffer");
        return;
      }

      console.log("🔊 Audio chunk:", arrayBuffer.byteLength, "bytes");

      // ✅ NEW: Track when we received this chunk
      lastChunkReceivedTimeRef.current = Date.now();

      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      clearRecognitionTimeout();

      audioQueueRef.current.push(arrayBuffer);
      dispatch(incrementAudioQueue());

      console.log(`📦 Queue: ${audioQueueRef.current.length}`);

      if (!isPlayingRef.current) {
        if (
          audioQueueRef.current.length >= AUDIO_CONFIG.MIN_BUFFER_SIZE ||
          audioQueueRef.current.length === 1
        ) {
          console.log("✅ Starting playback");
          playNextChunk();
        } else {
          console.log(
            `⏳ Buffering (${audioQueueRef.current.length}/${AUDIO_CONFIG.MIN_BUFFER_SIZE})`
          );
        }
      }
    },
    [dispatch, clearRecognitionTimeout, playNextChunk]
  );

  // ✅ IMPROVED: Handle TTS end with better synchronization
  const handleTtsEnd = useCallback(() => {
    console.log("🔔 TTS stream ended");
    dispatch(setTtsStreamActive(false));
    waitingForMoreChunksRef.current = false;

    const hasAudio = audioQueueRef.current.length > 0;

    console.log("🔔 TTS end:", {
      isPlaying: isPlayingRef.current,
      queueLen: audioQueueRef.current.length,
      hasAudio,
    });

    if (hasAudio && !isPlayingRef.current) {
      console.log("✅ Playing remaining chunks");
      playNextChunk();
    } else if (!hasAudio && !isPlayingRef.current) {
      console.log("✅ No audio, enabling recognition");
      enableRecognitionAfterDelay();
    } else {
      console.log("⏳ Audio playing, will enable when done");
    }
  }, [dispatch, playNextChunk, enableRecognitionAfterDelay]);

  const handleInterviewComplete = useCallback(
    (data) => {
      console.log("🎉 Complete:", data);
      dispatch(completeInterview({ totalQuestions: data.totalQuestions }));
      dispatch(setMicStreamingActive(false));
    },
    [dispatch]
  );

  // Auto-start interview
  const autoStartInterview = useCallback(async () => {
    if (hasStartedRef.current) {
      console.log("🚫 Already started");
      return;
    }

    try {
      console.log("🚀 Auto-starting...");

      if (audioCtxRef.current?.state === "suspended") {
        await audioCtxRef.current.resume();
        console.log("🔊 AudioContext resumed");
      }

      await startMicStreaming();

      console.log("⏳ Waiting for server...");

      if (!serverReadyRef.current) {
        let waitTime = 0;
        const maxWait = 10000;
        const checkInterval = 100;

        while (!serverReadyRef.current && waitTime < maxWait) {
          await new Promise((resolve) => setTimeout(resolve, checkInterval));
          waitTime += checkInterval;
        }

        if (!serverReadyRef.current) {
          console.error("❌ Server timeout");
          dispatch(setIsInitializing(false));
          alert("Server timeout. Please refresh.");
          return;
        }
      }

      console.log("✅ Server ready");

      if (socketRef.current?.connected) {
        dispatch(setHasStarted(true));
        console.log("✅ Interview started");
        socketRef.current.emit("ready_for_question");
      } else {
        console.error("⚠️ Not connected");
        dispatch(setIsInitializing(false));
        alert("Connection error. Please refresh.");
      }
    } catch (error) {
      console.error("❌ Start error:", error);
      dispatch(setHasStarted(false));
      dispatch(setIsInitializing(false));
    }
  }, [dispatch, startMicStreaming]);

  return {
    ...interview,
    socketRef,
    audioCtxRef,
    micStreamRef,
    handleQuestion,
    handleNextQuestion,
    handleIdlePrompt,
    handleTranscriptReceived,
    handleFinalAnswer,
    handleTtsAudio,
    handleTtsEnd,
    handleInterviewComplete,
    playNextChunk,
    startMicStreaming,
    autoStartInterview,
    enableRecognitionAfterDelay,
    setStatus: (status) => dispatch(setStatus(status)),
    setServerReady: (ready) => dispatch(setServerReady(ready)),
    setHasStarted: (started) => dispatch(setHasStarted(started)),
    setIsInitializing: (init) => dispatch(setIsInitializing(init)),
    enableListening: () => dispatch(enableListening()),
    disableListening: () => dispatch(disableListening()),
    setMicStreamingActive: (active) => dispatch(setMicStreamingActive(active)),
    initializeInterview: (data) => dispatch(initializeInterview(data)),
  };
};
