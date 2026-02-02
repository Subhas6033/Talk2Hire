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
  setAudioQueueLength,
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
  RECOGNITION_DELAY: 2000, // Increased to 2 seconds for safer timing
};

export const useInterview = (interviewId, userId, cameraStream) => {
  const dispatch = useDispatch();

  // Select state from Redux
  const interview = useSelector((state) => state.interview);

  // Refs for non-Redux state
  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const micProcessorRef = useRef(null);
  const currentSourceRef = useRef(null);
  const recognitionTimeoutRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const isCleaningUpRef = useRef(false);

  // Store audio buffers ONLY in ref (not Redux)
  const audioQueueRef = useRef([]);

  // Internal refs to track state for audio processing
  const isPlayingRef = useRef(false);
  const isListeningRef = useRef(false);
  const canListenRef = useRef(false);
  const hasStartedRef = useRef(false);
  const serverReadyRef = useRef(false);
  const ttsStreamActiveRef = useRef(false);
  const micStreamingActiveRef = useRef(false);

  // Sync Redux state to refs (needed for audio processing callbacks)
  useEffect(() => {
    isPlayingRef.current = interview.isPlaying;
    isListeningRef.current = interview.isListening;
    canListenRef.current = interview.canListen;
    hasStartedRef.current = interview.hasStarted;
    serverReadyRef.current = interview.serverReady;
    ttsStreamActiveRef.current = interview.ttsStreamActive;
    micStreamingActiveRef.current = interview.micStreamingActive;
  }, [interview]);

  // ============================================================================
  // AUDIO CONTEXT INITIALIZATION
  // ============================================================================

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

  // ============================================================================
  // RECORDING TIMER
  // ============================================================================

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

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const clearRecognitionTimeout = useCallback(() => {
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
      console.log("🧹 Recognition timeout cleared");
    }
  }, []);

  const shouldEnableRecognition = useCallback(() => {
    const shouldEnable =
      hasStartedRef.current &&
      !isPlayingRef.current &&
      !ttsStreamActiveRef.current &&
      audioQueueRef.current.length === 0;

    console.log("🎤 Check shouldEnableRecognition:", {
      hasStarted: hasStartedRef.current,
      isPlaying: isPlayingRef.current,
      ttsStreamActive: ttsStreamActiveRef.current,
      queueLength: audioQueueRef.current.length,
      shouldEnable,
    });

    return shouldEnable;
  }, []);

  const enableRecognitionAfterDelay = useCallback(() => {
    console.log("⏰ enableRecognitionAfterDelay called");
    clearRecognitionTimeout();

    console.log(`⏰ Setting ${AUDIO_CONFIG.RECOGNITION_DELAY}ms timeout`);
    recognitionTimeoutRef.current = setTimeout(() => {
      console.log("🎤 ⏰ Timeout fired - checking conditions");

      if (shouldEnableRecognition()) {
        console.log("✅ All conditions met - enabling listening");
        dispatch(enableListening());
      } else {
        console.log("❌ Conditions not met for enabling recognition:", {
          hasStarted: hasStartedRef.current,
          isPlaying: isPlayingRef.current,
          ttsStreamActive: ttsStreamActiveRef.current,
          queueLength: audioQueueRef.current.length,
        });
      }
    }, AUDIO_CONFIG.RECOGNITION_DELAY);
  }, [clearRecognitionTimeout, shouldEnableRecognition, dispatch]);

  // ============================================================================
  // AUDIO PLAYBACK
  // ============================================================================

  const playNextChunk = useCallback(async () => {
    const audioCtx = audioCtxRef.current;
    if (!audioCtx) {
      console.error("❌ No AudioContext available");
      dispatch(setIsPlaying(false));
      return;
    }

    if (audioQueueRef.current.length === 0) {
      console.log("✅ Audio queue empty");
      dispatch(setIsPlaying(false));

      // CRITICAL FIX: Only enable recognition if TTS stream is also complete
      if (!ttsStreamActiveRef.current) {
        console.log(
          "✅ TTS stream complete - ALL AUDIO FINISHED - enabling recognition after delay"
        );
        enableRecognitionAfterDelay();
      } else {
        console.log("⏳ TTS stream still active - waiting for more chunks");
      }
      return;
    }

    try {
      dispatch(setIsPlaying(true));
      dispatch(disableListening());

      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const buffer = audioQueueRef.current.shift();
      dispatch(decrementAudioQueue());

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
      dispatch(setIsPlaying(false));
      currentSourceRef.current = null;

      if (audioQueueRef.current.length > 0) {
        setTimeout(() => playNextChunk(), 100);
      } else if (!ttsStreamActiveRef.current) {
        enableRecognitionAfterDelay();
      }
    }
  }, [dispatch, enableRecognitionAfterDelay]);

  // ============================================================================
  // MICROPHONE STREAMING
  // ============================================================================

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
      dispatch(setMicPermissionGranted(true));
      console.log("✅ Microphone access granted");

      const audioCtx = audioCtxRef.current;
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;

      source.connect(processor);
      processor.connect(audioCtx.destination);

      dispatch(setMicStreamingActive(true));

      processor.onaudioprocess = (e) => {
        if (!micStreamingActiveRef.current) {
          return;
        }

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

      console.log("🎤 Mic streaming started");
    } catch (error) {
      console.error("❌ Microphone access error:", error);
      alert(
        "Microphone access denied. Please allow microphone access and try again."
      );
    }
  }, [dispatch]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleQuestion = useCallback(
    (payload) => {
      let questionText = "";
      if (typeof payload === "string") {
        questionText = payload;
      } else if (payload?.question) {
        questionText = payload.question;
      }

      console.log("❓ Received question:", questionText);
      dispatch(setCurrentQuestion(questionText));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      dispatch(clearAudioQueue());
      clearRecognitionTimeout();
      audioQueueRef.current = [];
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
    },
    [dispatch, clearRecognitionTimeout]
  );

  const handleIdlePrompt = useCallback(
    ({ text }) => {
      console.log("⏰ Received idle prompt:", text);
      dispatch(setIdlePrompt(text));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      dispatch(clearAudioQueue());
      clearRecognitionTimeout();
      audioQueueRef.current = [];
    },
    [dispatch, clearRecognitionTimeout]
  );

  const handleTranscriptReceived = useCallback(
    ({ text }) => {
      console.log("📝 Transcript received from server:", text);
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

  const handleTtsAudio = useCallback(
    (chunk) => {
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

      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      clearRecognitionTimeout();

      // Store buffer in ref, only update Redux count
      audioQueueRef.current.push(arrayBuffer);
      dispatch(incrementAudioQueue());

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
    },
    [dispatch, clearRecognitionTimeout, playNextChunk]
  );

  const handleTtsEnd = useCallback(() => {
    console.log("🔔 TTS stream ended");
    dispatch(setTtsStreamActive(false));

    // CRITICAL FIX: Check both playing state AND queue
    const hasRemainingAudio = audioQueueRef.current.length > 0;

    console.log("🔔 TTS end status:", {
      isPlaying: isPlayingRef.current,
      queueLength: audioQueueRef.current.length,
      hasRemainingAudio,
    });

    if (hasRemainingAudio && !isPlayingRef.current) {
      console.log("✅ TTS ended - playing remaining chunks");
      playNextChunk();
    } else if (!hasRemainingAudio && !isPlayingRef.current) {
      console.log(
        "✅ TTS ended with empty queue and no playback - enabling recognition after delay"
      );
      enableRecognitionAfterDelay();
    } else {
      console.log(
        "⏳ TTS ended but audio still playing - will enable recognition when playback finishes"
      );
    }
  }, [dispatch, playNextChunk, enableRecognitionAfterDelay]);

  const handleInterviewComplete = useCallback(
    (data) => {
      console.log("🎉 Interview completed:", data);
      dispatch(completeInterview({ totalQuestions: data.totalQuestions }));
      dispatch(setMicStreamingActive(false));
    },
    [dispatch]
  );

  // ============================================================================
  // AUTO START INTERVIEW
  // ============================================================================

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
          dispatch(setIsInitializing(false));
          alert("Server initialization timeout. Please refresh and try again.");
          return;
        }
      }

      console.log("✅ Server ready, requesting first question");

      if (socketRef.current?.connected) {
        dispatch(setHasStarted(true));
        console.log("✅ Interview started");

        socketRef.current.emit("ready_for_question");
      } else {
        console.error("⚠️ Socket not connected");
        dispatch(setIsInitializing(false));
        alert("Connection error. Please refresh and try again.");
      }
    } catch (error) {
      console.error("❌ Error starting interview:", error);
      dispatch(setHasStarted(false));
      dispatch(setIsInitializing(false));
    }
  }, [dispatch, startMicStreaming]);

  // ============================================================================
  // RETURN INTERFACE
  // ============================================================================

  return {
    // State
    ...interview,

    // Refs
    socketRef,
    audioCtxRef,
    micStreamRef,

    // Actions
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

    // Dispatch helpers
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
