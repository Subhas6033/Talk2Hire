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
import useAudioRecording from "./useAudioRecording";

const AUDIO_CONFIG = {
  MIN_BUFFER_SIZE: 3,
  SAMPLE_RATE: 48000,
  RECOGNITION_DELAY: 2000,
  MAX_RECOGNITION_WAIT: 5000,
};

export const useInterview = (interviewId, userId, cameraStream) => {
  const dispatch = useDispatch();
  const interview = useSelector((state) => state.interview);

  // Refs
  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioRecording = useAudioRecording(socketRef, interviewId, userId);
  const micStreamRef = useRef(null);
  const micProcessorRef = useRef(null);
  const currentSourceRef = useRef(null);
  const recognitionTimeoutRef = useRef(null);
  const recordingTimerRef = useRef(null);

  // Audio queue stored ONLY in ref
  const audioQueueRef = useRef([]);

  // Track if we're waiting for more audio chunks
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

  // ✅ FIX: Initialize AudioContext with user gesture
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
          `🔊 AudioContext initialized at ${AUDIO_CONFIG.SAMPLE_RATE}Hz`,
        );
      }
    };

    // Initialize on user interaction
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

  // Auto-start when server is ready
  useEffect(() => {
    if (
      interview.serverReady &&
      !interview.hasStarted &&
      !interview.isInitializing
    ) {
      console.log("🎯 Server ready detected - auto-starting interview");

      const timer = setTimeout(() => {
        autoStartInterview();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [interview.serverReady, interview.hasStarted, interview.isInitializing]);

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

  const enableRecognitionAfterDelay = useCallback(() => {
    console.log("⏰ enableRecognitionAfterDelay called");
    clearRecognitionTimeout();

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

        if (timeSinceLastChunk < AUDIO_CONFIG.MAX_RECOGNITION_WAIT) {
          setTimeout(() => enableRecognitionAfterDelay(), 1000);
        } else {
          console.warn("⚠️ Recognition wait timeout - forcing enable");
          dispatch(enableListening());
        }
      }
    }, AUDIO_CONFIG.RECOGNITION_DELAY);
  }, [clearRecognitionTimeout, shouldEnableRecognition, dispatch]);

  // Safe base64 → ArrayBuffer converter
  const base64ToArrayBuffer = (base64) => {
    // Replace URL-safe chars
    base64 = base64.replace(/-/g, "+").replace(/_/g, "/");

    // Pad with '='
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
  };

  // ✅ FIXED: Play the next chunk in the queue
  const playNextChunk = useCallback(async () => {
    if (audioQueueRef.current.length === 0 || !audioCtxRef.current) {
      isPlayingRef.current = false;
      dispatch(setIsPlaying(false));
      console.log("⏹️ No more audio to play");
      return;
    }

    const audioCtx = audioCtxRef.current;

    // Resume AudioContext if suspended
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
      console.log("🔊 AudioContext resumed for playback");
    }

    isPlayingRef.current = true;
    dispatch(setIsPlaying(true));

    const buffer = audioQueueRef.current.shift();

    // ✅ FIX: Stop previous source if still playing
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {
        // Already stopped
      }
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);

    // ✅ FIX: Store current source
    currentSourceRef.current = source;

    // ✅ FIX: Connect to audio recording for mixed audio
    if (audioRecording.connectTTSAudio) {
      try {
        audioRecording.connectTTSAudio(buffer);
      } catch (err) {
        console.warn("⚠️ Could not connect TTS to recording:", err);
      }
    }

    source.onended = () => {
      isPlayingRef.current = false;
      dispatch(setIsPlaying(false));
      currentSourceRef.current = null;

      console.log(
        `✅ Audio chunk finished (${audioQueueRef.current.length} remaining)`,
      );

      if (audioQueueRef.current.length > 0) {
        playNextChunk(); // Play next queued chunk
      } else {
        console.log("✅ All audio played, enabling recognition");
        // Enable recognition after TTS ends
        enableRecognitionAfterDelay();
      }
    };

    source.start(0);
    console.log(
      `🔊 Playing TTS audio chunk (${audioQueueRef.current.length} remaining in queue)`,
    );
  }, [dispatch, enableRecognitionAfterDelay, audioRecording]);

  const getAudioContext = async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (
        window.AudioContext || window.webkitAudioContext
      )({
        sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
      });
      console.log("🔊 AudioContext created");
    }

    if (audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
      console.log("🔊 AudioContext resumed");
    }

    return audioCtxRef.current;
  };

  // ✅ FIXED: Handle incoming TTS audio with better error handling
  const handleTtsAudio = useCallback(
    async (data) => {
      try {
        console.log("🔊 Received TTS audio data:", {
          hasAudio: !!data?.audio,
          dataType: typeof data,
          audioType: typeof data?.audio,
          audioLength: data?.audio?.length,
        });

        // ✅ FIX: Handle both formats (object with audio property OR direct string)
        let base64Audio;
        if (typeof data === "string") {
          // Direct base64 string
          base64Audio = data;
          console.log("📦 TTS data is direct base64 string");
        } else if (data && data.audio) {
          // Object with audio property
          base64Audio = data.audio;
          console.log("📦 TTS data has audio property");
        } else {
          console.warn("⚠️ Invalid TTS audio data format:", data);
          return;
        }

        if (!base64Audio || base64Audio.length === 0) {
          console.warn("⚠️ Empty audio data received");
          return;
        }

        // ✅ FIX: Update last chunk received time
        lastChunkReceivedTimeRef.current = Date.now();

        const audioCtx = await getAudioContext();

        // Convert Base64 → ArrayBuffer
        const arrayBuffer = base64ToArrayBuffer(base64Audio);
        console.log(`✅ Decoded ${arrayBuffer.byteLength} bytes from base64`);

        // Decode raw PCM 16-bit LE into Float32Array
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

        // Push to queue
        audioQueueRef.current.push(audioBuffer);
        console.log(
          `📦 TTS audio queued (queue size: ${audioQueueRef.current.length}, duration: ${audioBuffer.duration.toFixed(2)}s)`,
        );

        // ✅ FIX: Disable listening while TTS is active
        dispatch(disableListening());

        // Play immediately if not already playing
        if (!isPlayingRef.current) {
          console.log("▶️ Starting playback immediately");
          playNextChunk();
        } else {
          console.log("⏸️ Audio already playing, chunk queued");
        }
      } catch (err) {
        console.error("❌ TTS playback error:", err);
        console.error("Error stack:", err.stack);
      }
    },
    [dispatch, playNextChunk],
  );

  // Handle TTS stream end
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
      console.log("⏳ Audio playing, will enable recognition when done");
    }
  }, [dispatch, playNextChunk, enableRecognitionAfterDelay]);

  // ✅ FIXED: Start microphone streaming with audio recording connection
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

      const audioCtx = await getAudioContext();

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;

      source.connect(processor);
      processor.connect(audioCtx.destination);

      // ✅ FIX: Connect microphone to audio recording
      if (audioRecording.connectMicrophoneAudio) {
        await audioRecording.connectMicrophoneAudio(stream);
        console.log("✅ Microphone connected to audio recording");
      }

      dispatch(setMicStreamingActive(true));

      let audioChunksSent = 0;
      processor.onaudioprocess = (e) => {
        if (!micStreamingActiveRef.current) return;

        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);

        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // ✅ FIX: Only send audio when listening is enabled
        if (
          socketRef.current?.connected &&
          isListeningRef.current &&
          canListenRef.current
        ) {
          socketRef.current.emit("user_audio_chunk", pcm16.buffer);
          audioChunksSent++;

          if (audioChunksSent % 50 === 0) {
            console.log(`🎤 Sent ${audioChunksSent} audio chunks to STT`);
          }
        }
      };

      console.log("🎤 Mic streaming started");
    } catch (err) {
      console.error("❌ Microphone error:", err);
      alert(
        "Microphone access denied or unavailable. Please allow access and try again.",
      );
    }
  }, [dispatch, audioRecording]);

  // Event Handlers
  const handleQuestion = useCallback(
    (payload) => {
      const questionText =
        typeof payload === "string" ? payload : payload?.question || "";

      console.log("❓ Question received:", questionText.substring(0, 100));
      dispatch(setCurrentQuestion(questionText));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      dispatch(clearAudioQueue());
      clearRecognitionTimeout();
      audioQueueRef.current = [];
      waitingForMoreChunksRef.current = false;
    },
    [dispatch, clearRecognitionTimeout],
  );

  const handleNextQuestion = useCallback(
    (payload) => {
      console.log("📨 Next question received:", payload);
      dispatch(receiveNextQuestion(payload));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      dispatch(clearAudioQueue());
      clearRecognitionTimeout();
      audioQueueRef.current = [];
      waitingForMoreChunksRef.current = false;
    },
    [dispatch, clearRecognitionTimeout],
  );

  const handleIdlePrompt = useCallback(
    ({ text }) => {
      console.log("⏰ Idle prompt received:", text);
      dispatch(setIdlePrompt(text));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      dispatch(clearAudioQueue());
      clearRecognitionTimeout();
      audioQueueRef.current = [];
      waitingForMoreChunksRef.current = false;
    },
    [dispatch, clearRecognitionTimeout],
  );

  const handleTranscriptReceived = useCallback(
    ({ text }) => {
      console.log("📝 Final transcript received:", text);
      dispatch(setUserText(text));
      dispatch(disableListening());
    },
    [dispatch],
  );

  const handleFinalAnswer = useCallback(
    (text) => {
      console.log("✅ Final answer:", text);
      dispatch(receiveFinalAnswer(text));
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

  const handleInterviewComplete = useCallback(
    (data) => {
      console.log("🎉 Interview complete:", data);
      dispatch(completeInterview({ totalQuestions: data.totalQuestions }));
      dispatch(setMicStreamingActive(false));
    },
    [dispatch],
  );

  const handleInterimTranscript = useCallback(
    (data) => {
      console.log("💬 Interim transcript:", data.text);
      dispatch(setUserText(data.text));
    },
    [dispatch],
  );

  const autoStartInterview = useCallback(async () => {
    if (hasStartedRef.current) {
      console.log("🚫 Already started");
      return;
    }

    try {
      console.log("🚀 Auto-starting interview...");
      console.log("📊 Current state:", {
        serverReady: serverReadyRef.current,
        hasStarted: hasStartedRef.current,
        isInitializing: interview.isInitializing,
      });

      if (audioCtxRef.current?.state === "suspended") {
        await audioCtxRef.current.resume();
        console.log("🔊 AudioContext resumed");
      }

      console.log("🎤 Starting microphone...");
      await startMicStreaming();
      console.log("✅ Microphone started");

      if (!serverReadyRef.current) {
        console.error("❌ Server not ready");
        return;
      }

      if (!socketRef.current?.connected) {
        console.error("❌ Socket not connected");
        return;
      }

      console.log("✅ All prerequisites met, setting hasStarted flag");
      dispatch(setHasStarted(true));

      await new Promise((resolve) => setTimeout(resolve, 300));

      console.log("📤 Emitting ready_for_question event");
      socketRef.current.emit("ready_for_question");
      console.log("✅ ready_for_question emitted successfully");
    } catch (error) {
      console.error("❌ Auto-start error:", error);
      dispatch(setHasStarted(false));
      alert("Failed to start interview: " + error.message);
    }
  }, [dispatch, startMicStreaming, interview.isInitializing]);

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
