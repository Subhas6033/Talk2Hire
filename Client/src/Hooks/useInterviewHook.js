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
  setIdlePrompt,
  startRecording,
  updateRecordingDuration,
  stopRecording,
  completeInterview,
  initializeInterview,
} from "../API/interviewApi";
import useAudioRecording from "./useAudioRecording";

// Audio configuration - OPTIMIZED for minimal latency
const AUDIO_CONFIG = {
  MIN_BUFFER_SIZE: 3,
  SAMPLE_RATE: 48000,
  RECOGNITION_DELAY: 300, // Reduced from 800ms — server signals when to listen
  MAX_RECOGNITION_WAIT: 2000, // Reduced from 3000ms
};

export const useInterview = (interviewId, userId, cameraStream) => {
  const dispatch = useDispatch();
  const interview = useSelector((state) => state.interview);

  // Core refs for socket, audio, and microphone management
  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioRecording = useAudioRecording(socketRef, interviewId, userId);
  const micStreamRef = useRef(null);
  const micProcessorRef = useRef(null);
  const currentSourceRef = useRef(null);
  const recognitionTimeoutRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const playbackScheduledRef = useRef(false);

  // Audio queue stored in ref to avoid re-renders
  const audioQueueRef = useRef([]);

  // Refs to track TTS streaming state
  const waitingForMoreChunksRef = useRef(false);
  const lastChunkReceivedTimeRef = useRef(null);

  // State synchronization refs to avoid stale closures
  const isPlayingRef = useRef(false);
  const isListeningRef = useRef(false);
  const canListenRef = useRef(false);
  const hasStartedRef = useRef(false);
  const serverReadyRef = useRef(false);
  const ttsStreamActiveRef = useRef(false);
  const micStreamingActiveRef = useRef(false);

  // Synchronize Redux state to refs for use in callbacks
  useEffect(() => {
    isPlayingRef.current = interview.isPlaying;
    isListeningRef.current = interview.isListening;
    canListenRef.current = interview.canListen;
    serverReadyRef.current = interview.serverReady;
    ttsStreamActiveRef.current = interview.ttsStreamActive;
    micStreamingActiveRef.current = interview.micStreamingActive;
  }, [interview]);

  // Initialize AudioContext - requires user gesture for security
  useEffect(() => {
    const initAudioContext = () => {
      if (!audioCtxRef.current) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)(
          {
            sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
          },
        );
        audioCtxRef.current = audioCtx;
        console.log(
          `✅ AudioContext initialized at ${AUDIO_CONFIG.SAMPLE_RATE}Hz`,
        );
      }
    };

    const handleInteraction = () => {
      initAudioContext();
      document.removeEventListener("click", handleInteraction);
    };
    document.addEventListener("click", handleInteraction, { once: true });

    return () => {
      if (audioCtxRef.current?.state !== "closed") {
        audioCtxRef.current?.close();
      }
    };
  }, []);

  // Recording timer - updates duration every second
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

  // Auto-start interview when server becomes ready
  useEffect(() => {
    if (
      interview.serverReady &&
      !interview.hasStarted &&
      !interview.isInitializing &&
      !hasStartedRef.current
    ) {
      console.log("🚀 Server ready detected - auto-starting interview");

      const timer = setTimeout(() => {
        autoStartInterview();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [interview.serverReady, interview.hasStarted, interview.isInitializing]);

  // Clear any pending recognition timeout
  const clearRecognitionTimeout = useCallback(() => {
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
      console.log("🔄 Recognition timeout cleared");
    }
  }, []);

  // Check if conditions are met to enable speech recognition
  const shouldEnableRecognition = useCallback(() => {
    const shouldEnable =
      hasStartedRef.current &&
      !isPlayingRef.current &&
      !ttsStreamActiveRef.current &&
      audioQueueRef.current.length === 0 &&
      !waitingForMoreChunksRef.current;

    console.log("🔍 shouldEnableRecognition check:", {
      hasStarted: hasStartedRef.current,
      isPlaying: isPlayingRef.current,
      ttsActive: ttsStreamActiveRef.current,
      queueLen: audioQueueRef.current.length,
      waitingForChunks: waitingForMoreChunksRef.current,
      result: shouldEnable,
    });

    return shouldEnable;
  }, []);

  // Enable speech recognition after a delay to ensure TTS is complete
  const enableRecognitionAfterDelay = useCallback(() => {
    console.log("⏱️ enableRecognitionAfterDelay called");
    clearRecognitionTimeout();

    const timeSinceLastChunk =
      Date.now() - (lastChunkReceivedTimeRef.current || 0);

    // Wait if we recently received a chunk and TTS is still active
    if (timeSinceLastChunk < 500 && ttsStreamActiveRef.current) {
      console.log(
        "⏳ Recently received chunk, waiting before enabling recognition",
      );
      waitingForMoreChunksRef.current = true;

      setTimeout(() => {
        waitingForMoreChunksRef.current = false;
        enableRecognitionAfterDelay();
      }, 500);
      return;
    }

    console.log(
      `⏰ Setting ${AUDIO_CONFIG.RECOGNITION_DELAY}ms recognition timeout`,
    );
    recognitionTimeoutRef.current = setTimeout(() => {
      console.log("🔔 Recognition timeout fired - checking conditions");

      if (shouldEnableRecognition()) {
        console.log("✅ Conditions met - enabling listening");
        dispatch(enableListening());
      } else {
        console.log("⚠️ Conditions not met, will check again");

        if (timeSinceLastChunk < AUDIO_CONFIG.MAX_RECOGNITION_WAIT) {
          setTimeout(() => enableRecognitionAfterDelay(), 500);
        } else {
          console.warn("⚡ Recognition wait timeout - forcing enable");
          dispatch(enableListening());
        }
      }
    }, AUDIO_CONFIG.RECOGNITION_DELAY);
  }, [clearRecognitionTimeout, shouldEnableRecognition, dispatch]);

  // Convert base64 string to ArrayBuffer for audio processing
  const base64ToArrayBuffer = useCallback((base64) => {
    // Replace URL-safe characters
    base64 = base64.replace(/-/g, "+").replace(/_/g, "/");

    // Add padding if needed
    while (base64.length % 4) {
      base64 += "=";
    }

    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }, []);

  // Get or create AudioContext
  const getAudioContext = useCallback(async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (
        window.AudioContext || window.webkitAudioContext
      )({
        sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
      });
      console.log("🎵 AudioContext created");
    }

    if (audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
      console.log("▶️ AudioContext resumed");
    }

    return audioCtxRef.current;
  }, []);

  // Play the next audio chunk in the queue
  const playNextChunk = useCallback(async () => {
    if (audioQueueRef.current.length === 0 || !audioCtxRef.current) {
      isPlayingRef.current = false;
      dispatch(setIsPlaying(false));
      console.log("🔇 No more audio to play");
      return;
    }

    const audioCtx = audioCtxRef.current;

    // Resume AudioContext if suspended (browser autoplay policy)
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
      console.log("▶️ AudioContext resumed for playback");
    }

    isPlayingRef.current = true;
    dispatch(setIsPlaying(true));

    const buffer = audioQueueRef.current.shift();

    // Stop previous audio source if still playing
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {
        // Already stopped - ignore error
      }
    }

    // Create new audio source
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    currentSourceRef.current = source;

    // Connect TTS audio to recording for mixed audio output
    if (audioRecording.connectTTSAudio) {
      try {
        audioRecording.connectTTSAudio(buffer);
      } catch (err) {
        console.warn("⚠️ Could not connect TTS to recording:", err);
      }
    }

    // Handle audio playback completion
    source.onended = () => {
      isPlayingRef.current = false;
      dispatch(setIsPlaying(false));
      currentSourceRef.current = null;

      console.log(
        `✅ Audio chunk finished (${audioQueueRef.current.length} remaining)`,
      );

      if (audioQueueRef.current.length > 0) {
        // Play next chunk in queue
        playNextChunk();
      } else {
        // All audio played - enable speech recognition
        console.log("🎤 All audio played, enabling recognition");
        enableRecognitionAfterDelay();
      }
    };

    source.start(0);
    console.log(
      `🔊 Playing TTS audio chunk (${audioQueueRef.current.length} remaining in queue)`,
    );
  }, [dispatch, enableRecognitionAfterDelay, audioRecording]);

  // OPTIMIZED: Handle incoming TTS audio with ZERO delay
  const handleTtsAudio = useCallback(
    async (data) => {
      try {
        let base64Audio;
        if (typeof data === "string") {
          base64Audio = data;
        } else if (data && data.audio) {
          base64Audio = data.audio;
        } else {
          console.warn("⚠️ Invalid TTS data format");
          return;
        }

        if (!base64Audio || base64Audio.length === 0) return;

        lastChunkReceivedTimeRef.current = Date.now();

        const audioCtx = await getAudioContext();
        const arrayBuffer = base64ToArrayBuffer(base64Audio);

        const numSamples = arrayBuffer.byteLength / 2;
        const audioBuffer = audioCtx.createBuffer(
          1,
          numSamples,
          AUDIO_CONFIG.SAMPLE_RATE,
        );

        const channelData = audioBuffer.getChannelData(0);
        const dataView = new DataView(arrayBuffer);

        for (let i = 0; i < numSamples; i++) {
          channelData[i] = dataView.getInt16(i * 2, true) / 32768;
        }

        audioQueueRef.current.push(audioBuffer);

        dispatch(disableListening());

        // OPTIMIZED: Play immediately with ZERO delay
        if (!isPlayingRef.current && !playbackScheduledRef.current) {
          playbackScheduledRef.current = true;

          // CRITICAL: Zero delay - just yield to event loop
          await Promise.resolve();

          playbackScheduledRef.current = false;

          if (audioQueueRef.current.length > 0) {
            playNextChunk();
          }
        }
      } catch (err) {
        console.error("❌ TTS playback error:", err);
      }
    },
    [dispatch, playNextChunk, getAudioContext, base64ToArrayBuffer],
  );

  // Handle TTS stream end event
  const handleTtsEnd = useCallback(() => {
    console.log("🔚 TTS stream ended");
    dispatch(setTtsStreamActive(false));
    waitingForMoreChunksRef.current = false;

    const hasAudio = audioQueueRef.current.length > 0;

    console.log("📊 TTS end state:", {
      isPlaying: isPlayingRef.current,
      queueLen: audioQueueRef.current.length,
      hasAudio,
    });

    if (hasAudio && !isPlayingRef.current) {
      console.log("▶️ Playing remaining chunks");
      playNextChunk();
    } else if (!hasAudio && !isPlayingRef.current) {
      console.log("🎤 No audio remaining, enabling recognition");
      enableRecognitionAfterDelay();
    } else {
      console.log("⏳ Audio still playing, will enable recognition when done");
    }
  }, [dispatch, playNextChunk, enableRecognitionAfterDelay]);

  // Start microphone streaming for speech recognition
  const startMicStreaming = useCallback(async () => {
    if (micStreamRef.current) {
      console.log("🎤 Mic already streaming");
      return;
    }

    if (!socketRef.current?.connected) {
      console.error("❌ Socket not connected, cannot start mic streaming");
      return;
    }

    try {
      console.log("🎤 Requesting microphone access");
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

      const audioCtx = await getAudioContext();

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;

      source.connect(processor);
      processor.connect(audioCtx.destination);

      // Connect microphone to audio recording for mixed output
      if (audioRecording.connectMicrophoneAudio) {
        await audioRecording.connectMicrophoneAudio(stream);
        console.log("🔗 Microphone connected to audio recording");
      }

      dispatch(setMicStreamingActive(true));

      let audioChunksSent = 0;

      // Process audio and send to server for speech recognition
      processor.onaudioprocess = (e) => {
        if (!micStreamingActiveRef.current) return;

        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);

        // Convert float32 to int16 PCM
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Only send audio when listening is enabled
        if (
          socketRef.current?.connected &&
          isListeningRef.current &&
          canListenRef.current
        ) {
          socketRef.current.emit("user_audio_chunk", pcm16.buffer);
          audioChunksSent++;

          if (audioChunksSent % 50 === 0) {
            console.log(`📤 Sent ${audioChunksSent} audio chunks to STT`);
          }
        }
      };

      console.log("✅ Mic streaming started");
    } catch (err) {
      console.error("❌ Microphone error:", err);
      alert(
        "Microphone access denied or unavailable. Please allow access and try again.",
      );
    }
  }, [dispatch, audioRecording, getAudioContext]);

  // Event handler for receiving new questions
  const handleQuestion = useCallback(
    (payload) => {
      const questionText =
        typeof payload === "string" ? payload : payload?.question || "";

      // OPTIMIZATION: Pre-warm AudioContext so it's ready when TTS arrives
      getAudioContext().catch((err) =>
        console.warn("⚠️ AudioContext pre-warm failed:", err),
      );

      console.log("❓ Question received:", questionText.substring(0, 100));
      dispatch(setCurrentQuestion(questionText));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      dispatch(clearAudioQueue());
      clearRecognitionTimeout();
      audioQueueRef.current = [];
      waitingForMoreChunksRef.current = false;
    },
    [dispatch, clearRecognitionTimeout, getAudioContext],
  );

  // Event handler for next question
  const handleNextQuestion = useCallback(
    (payload) => {
      // OPTIMIZATION: Pre-warm AudioContext
      getAudioContext().catch((err) =>
        console.warn("⚠️ AudioContext pre-warm failed:", err),
      );

      console.log("➡️ Next question received:", payload);
      dispatch(receiveNextQuestion(payload));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      dispatch(clearAudioQueue());
      clearRecognitionTimeout();
      audioQueueRef.current = [];
      waitingForMoreChunksRef.current = false;
    },
    [dispatch, clearRecognitionTimeout, getAudioContext],
  );

  // Event handler for idle prompts
  const handleIdlePrompt = useCallback(
    ({ text }) => {
      // OPTIMIZATION: Pre-warm AudioContext
      getAudioContext().catch((err) =>
        console.warn("⚠️ AudioContext pre-warm failed:", err),
      );

      console.log("💤 Idle prompt received:", text);
      dispatch(setIdlePrompt(text));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      dispatch(clearAudioQueue());
      clearRecognitionTimeout();
      audioQueueRef.current = [];
      waitingForMoreChunksRef.current = false;
    },
    [dispatch, clearRecognitionTimeout, getAudioContext],
  );

  // Event handler for transcript received
  const handleTranscriptReceived = useCallback(
    ({ text }) => {
      console.log("📝 Final transcript received:", text);
      dispatch(setUserText(text));
      dispatch(disableListening());
    },
    [dispatch],
  );

  // Initialize audio recording on mount
  useEffect(() => {
    const initAudio = async () => {
      try {
        await audioRecording.initializeAudioRecording();
        console.log("✅ Audio recording initialized");
      } catch (error) {
        console.error("❌ Failed to init audio recording:", error);
      }
    };

    initAudio();
  }, [audioRecording]);

  // Event handler for interview completion
  const handleInterviewComplete = useCallback(
    (data) => {
      console.log("🎉 Interview complete:", data);
      dispatch(completeInterview({ totalQuestions: data.totalQuestions }));
      dispatch(setMicStreamingActive(false));
    },
    [dispatch],
  );

  // Event handler for interim transcripts
  const handleInterimTranscript = useCallback(
    (data) => {
      console.log("📄 Interim transcript:", data.text);
      dispatch(setUserText(data.text));
    },
    [dispatch],
  );

  // Auto-start interview when all prerequisites are met
  const autoStartInterview = useCallback(async () => {
    if (hasStartedRef.current) {
      console.log("⚠️ Interview already started");
      return;
    }
    hasStartedRef.current = true;

    try {
      console.log("🚀 Auto-starting interview");
      console.log("📊 Current state:", {
        serverReady: serverReadyRef.current,
        hasStarted: hasStartedRef.current,
        isInitializing: interview.isInitializing,
      });

      // Resume AudioContext if suspended
      if (audioCtxRef.current?.state === "suspended") {
        await audioCtxRef.current.resume();
        console.log("▶️ AudioContext resumed");
      }

      // Start microphone streaming
      console.log("🎤 Starting microphone");
      await startMicStreaming();
      console.log("✅ Microphone started");

      // Verify prerequisites
      if (!serverReadyRef.current) {
        console.error("❌ Server not ready");
        hasStartedRef.current = false;
        return;
      }

      if (!socketRef.current?.connected) {
        console.error("❌ Socket not connected");
        hasStartedRef.current = false;
        return;
      }

      console.log("✅ All prerequisites met, setting hasStarted flag");
      dispatch(setHasStarted(true));

      console.log("📤 Emitting ready_for_question event");
      socketRef.current.emit("ready_for_question");
      console.log("✅ ready_for_question emitted successfully");
    } catch (error) {
      console.error("❌ Auto-start error:", error);
      hasStartedRef.current = false;
      dispatch(setHasStarted(false));
      alert("Failed to start interview: " + error.message);
    }
  }, [dispatch, startMicStreaming]);

  // Return interview state and methods
  return {
    ...interview,
    socketRef,
    audioCtxRef,
    micStreamRef,
    handleQuestion,
    handleNextQuestion,
    handleIdlePrompt,
    handleTranscriptReceived,
    handleTtsAudio,
    handleTtsEnd,
    audioRecording,
    handleInterviewComplete,
    playNextChunk,
    startMicStreaming,
    autoStartInterview,
    enableRecognitionAfterDelay,
    setLiveTranscript: handleInterimTranscript,
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
