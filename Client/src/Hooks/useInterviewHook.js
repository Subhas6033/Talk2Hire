import { useEffect, useRef, useCallback } from "react";
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

const AUDIO_CONFIG = {
  SAMPLE_RATE: 48000,
};

export const useInterview = (interviewId, userId, cameraStream) => {
  const dispatch = useDispatch();
  const interview = useSelector((state) => state.interview);

  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioRecording = useAudioRecording(socketRef, interviewId, userId);
  const micStreamRef = useRef(null);
  const micProcessorRef = useRef(null);
  const currentSourceRef = useRef(null);
  const recordingTimerRef = useRef(null);

  const playbackQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const isListeningRef = useRef(false);
  const canListenRef = useRef(false);
  const hasStartedRef = useRef(false);
  const serverReadyRef = useRef(false);
  const ttsStreamActiveRef = useRef(false);
  const micStreamingActiveRef = useRef(false);

  // ── FIX: Audio recording init guard — only call ONCE ever ──────────────────
  // The original code had useEffect([audioRecording]) which re-ran every render
  // because audioRecording is a new object each time. This caused the
  // "⚠️ Audio context already initialized" spam.
  const audioRecordingInitRef = useRef(false);
  useEffect(() => {
    if (audioRecordingInitRef.current) return;
    audioRecordingInitRef.current = true;

    const initAudio = async () => {
      try {
        await audioRecording.initializeAudioRecording();
        console.log("✅ Audio recording initialized (once)");
      } catch (error) {
        console.error("❌ Failed to init audio recording:", error);
        audioRecordingInitRef.current = false; // allow retry on error
      }
    };
    initAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps — runs once only

  useEffect(() => {
    isPlayingRef.current = interview.isPlaying;
    isListeningRef.current = interview.isListening;
    canListenRef.current = interview.canListen;
    serverReadyRef.current = interview.serverReady;
    ttsStreamActiveRef.current = interview.ttsStreamActive;
    micStreamingActiveRef.current = interview.micStreamingActive;
  }, [interview]);

  // ── Pre-warm AudioContext on mount ─────────────────────────────────────────
  const audioCtxInitRef = useRef(false);
  useEffect(() => {
    if (audioCtxInitRef.current) return;
    audioCtxInitRef.current = true;

    const initAudioContext = async () => {
      if (audioCtxRef.current) return;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
        latencyHint: "interactive",
      });

      audioCtxRef.current = audioCtx;

      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      console.log("✅ AudioContext pre-warmed:", {
        state: audioCtx.state,
        sampleRate: audioCtx.sampleRate,
      });
    };

    const handleUserGesture = () => {
      if (!audioCtxRef.current) {
        initAudioContext();
      } else if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
    };

    initAudioContext();
    document.addEventListener("click", handleUserGesture, { once: true });

    return () => {
      document.removeEventListener("click", handleUserGesture);
      // Do NOT close the AudioContext here — cleanup is handled by InterviewLive
      // Closing it here on re-renders was breaking TTS playback
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps — runs once only

  // ── Recording timer ─────────────────────────────────────────────────────────
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

  // ── base64 → ArrayBuffer ────────────────────────────────────────────────────
  const base64ToArrayBuffer = useCallback((base64) => {
    base64 = base64.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }, []);

  // ── Playback ────────────────────────────────────────────────────────────────
  const playNextChunk = useCallback(async () => {
    if (playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      dispatch(setIsPlaying(false));
      return;
    }

    const audioCtx = audioCtxRef.current;
    if (!audioCtx) {
      console.error("❌ No AudioContext for playback");
      return;
    }

    if (audioCtx.state === "suspended") {
      try {
        await audioCtx.resume();
        console.log("✅ AudioContext resumed for playback");
      } catch (e) {
        console.error("❌ Failed to resume AudioContext:", e);
      }
    }

    if (audioCtx.state === "closed") {
      console.error("❌ AudioContext is closed — cannot play TTS");
      return;
    }

    isPlayingRef.current = true;
    dispatch(setIsPlaying(true));

    const buffer = playbackQueueRef.current.shift();

    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (_) {}
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    currentSourceRef.current = source;

    if (audioRecording.connectTTSAudio) {
      try {
        audioRecording.connectTTSAudio(buffer);
      } catch (_) {}
    }

    source.onended = () => {
      isPlayingRef.current = false;
      dispatch(setIsPlaying(false));
      currentSourceRef.current = null;

      if (playbackQueueRef.current.length > 0) {
        playNextChunk();
      }
    };

    source.start(0);
  }, [dispatch, audioRecording]);

  const handleTtsAudio = useCallback(
    async (data) => {
      try {
        let base64Audio;
        if (typeof data === "string") {
          base64Audio = data;
        } else if (data?.audio) {
          base64Audio = data.audio;
        } else {
          console.warn("⚠️ TTS audio event has no audio data:", data);
          return;
        }

        if (!base64Audio || base64Audio.length === 0) return;

        const audioCtx = audioCtxRef.current;
        if (!audioCtx) {
          console.error("❌ No AudioContext when TTS audio arrived");
          return;
        }

        if (audioCtx.state === "closed") {
          console.error("❌ AudioContext closed — TTS chunk dropped");
          return;
        }

        if (audioCtx.state === "suspended") {
          await audioCtx.resume();
        }

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

        playbackQueueRef.current.push(audioBuffer);
        dispatch(disableListening());

        if (!isPlayingRef.current) {
          playNextChunk();
        }
      } catch (err) {
        console.error("❌ TTS playback error:", err);
      }
    },
    [dispatch, playNextChunk, base64ToArrayBuffer],
  );

  const handleTtsEnd = useCallback(() => {
    dispatch(setTtsStreamActive(false));

    if (playbackQueueRef.current.length > 0 && !isPlayingRef.current) {
      playNextChunk();
    }
  }, [dispatch, playNextChunk]);

  // ── Microphone streaming ────────────────────────────────────────────────────
  const startMicStreaming = useCallback(
    async (existingStream = null) => {
      if (micStreamRef.current) {
        console.log("🎤 Mic already streaming — skipping duplicate call");
        return;
      }

      if (!socketRef.current?.connected) {
        console.error("❌ Socket not connected, cannot start mic streaming");
        return;
      }

      try {
        let stream = existingStream;

        if (stream) {
          console.log("🎤 Reusing pre-acquired microphone stream");
        } else {
          console.log("🎤 Requesting new microphone access");
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
              channelCount: 1,
            },
          });
          console.log("✅ Microphone access granted");
        }

        micStreamRef.current = stream;
        dispatch(setMicPermissionGranted(true));

        const audioCtx = audioCtxRef.current;
        if (!audioCtx) {
          console.error("❌ No AudioContext when starting mic");
          return;
        }

        if (audioCtx.state === "suspended") {
          await audioCtx.resume();
        }

        // ScriptProcessor for PCM → Deepgram (STT)
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        micProcessorRef.current = processor;

        source.connect(processor);
        processor.connect(audioCtx.destination);

        if (audioRecording.connectMicrophoneAudio) {
          await audioRecording.connectMicrophoneAudio(stream);
          console.log("🔗 Microphone connected to audio recording mix");
        }

        dispatch(setMicStreamingActive(true));
        console.log("✅ Mic streaming started");

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

        console.log("🎤 ScriptProcessor connected — STT streaming active");
      } catch (err) {
        console.error("❌ Microphone error:", err);
        alert("Microphone access denied or unavailable.");
      }
    },
    [dispatch, audioRecording],
  );

  const handleQuestion = useCallback(
    (payload) => {
      const questionText =
        typeof payload === "string" ? payload : payload?.question || "";
      dispatch(setCurrentQuestion(questionText));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      playbackQueueRef.current = [];
    },
    [dispatch],
  );

  const handleNextQuestion = useCallback(
    (payload) => {
      dispatch(receiveNextQuestion(payload));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      playbackQueueRef.current = [];
    },
    [dispatch],
  );

  const handleIdlePrompt = useCallback(
    ({ text }) => {
      dispatch(setIdlePrompt(text));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
      playbackQueueRef.current = [];
    },
    [dispatch],
  );

  const handleTranscriptReceived = useCallback(
    ({ text }) => {
      dispatch(setUserText(text));
      dispatch(disableListening());
    },
    [dispatch],
  );

  const handleInterviewComplete = useCallback(
    (data) => {
      dispatch(completeInterview({ totalQuestions: data.totalQuestions }));
      dispatch(setMicStreamingActive(false));
    },
    [dispatch],
  );

  const handleInterimTranscript = useCallback(
    (data) => {
      dispatch(setUserText(data.text));
    },
    [dispatch],
  );

  /**
   * autoStartInterview — call ONCE from InterviewLive after client_ready.
   * Accepts existingMicStream from setup phase to avoid double getUserMedia.
   *
   * NOTE: The hasStartedRef guard here prevents double-calls within the same
   * hook instance. InterviewLive also has its own socketInitializedRef guard
   * to prevent this from being called at all on re-renders.
   */
  const autoStartInterview = useCallback(
    async (existingMicStream = null) => {
      if (hasStartedRef.current) {
        console.log("⚠️ autoStartInterview: already started, skipping");
        return;
      }
      hasStartedRef.current = true;

      try {
        console.log("🚀 autoStartInterview: beginning mic setup");

        if (audioCtxRef.current?.state === "suspended") {
          await audioCtxRef.current.resume();
        }

        await startMicStreaming(existingMicStream);
        console.log("✅ Mic setup complete");

        if (!serverReadyRef.current) {
          console.error("❌ Server not ready after mic setup");
          hasStartedRef.current = false;
          return;
        }

        if (!socketRef.current?.connected) {
          console.error("❌ Socket disconnected after mic setup");
          hasStartedRef.current = false;
          return;
        }

        dispatch(setHasStarted(true));
        console.log("✅ autoStartInterview complete — interview is live");
      } catch (error) {
        console.error("❌ autoStartInterview error:", error);
        hasStartedRef.current = false;
        dispatch(setHasStarted(false));
        alert("Failed to start interview: " + error.message);
      }
    },
    [dispatch, startMicStreaming],
  );

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
