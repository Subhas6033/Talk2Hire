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

const SCHEDULE_AHEAD_TIME = 0.05;

export const useInterview = (interviewId, userId, cameraStream) => {
  const dispatch = useDispatch();
  const interview = useSelector((state) => state.interview);

  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioRecording = useAudioRecording(socketRef, interviewId, userId);
  const micStreamRef = useRef(null);
  const micProcessorRef = useRef(null);
  const recordingTimerRef = useRef(null);

  // TTS playback state
  const pendingBuffersRef = useRef([]);
  const nextChunkAtRef = useRef(0);
  const scheduleTimerRef = useRef(null);
  const activeSourcesRef = useRef([]);
  const ttsStreamDoneRef = useRef(false);

  const isPlayingRef = useRef(false);
  const isListeningRef = useRef(false);
  const canListenRef = useRef(false);
  const hasStartedRef = useRef(false);
  const serverReadyRef = useRef(false);
  const ttsStreamActiveRef = useRef(false);
  const micStreamingActiveRef = useRef(false);

  // One-time init guards
  const audioCtxInitRef = useRef(false);

  // Sync redux → refs
  useEffect(() => {
    isPlayingRef.current = interview.isPlaying;
    isListeningRef.current = interview.isListening;
    canListenRef.current = interview.canListen;
    serverReadyRef.current = interview.serverReady;
    ttsStreamActiveRef.current = interview.ttsStreamActive;
    micStreamingActiveRef.current = interview.micStreamingActive;
  }, [interview]);

  // ── Create ONE AudioContext and share it with the recording hook ───────────
  // ROOT-CAUSE FIX: Previously useInterviewHook and useAudioRecording each
  // created their own AudioContext. Two independent contexts have independent
  // clocks — you cannot schedule audio on one and have the other play it in
  // sync. Now we create the context here and hand it to the recording hook via
  // setAudioContext(), so both share a single clock.
  useEffect(() => {
    if (audioCtxInitRef.current) return;
    audioCtxInitRef.current = true;

    const initAudioContext = async () => {
      if (audioCtxRef.current) return;

      const ctx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
        latencyHint: "interactive",
      });
      audioCtxRef.current = ctx;

      if (ctx.state === "suspended") await ctx.resume();
      console.log("✅ AudioContext ready:", ctx.state, ctx.sampleRate + "Hz");

      // Share the context with the recording hook immediately
      await audioRecording.setAudioContext(ctx);
      console.log("✅ Shared AudioContext handed to audioRecording");
    };

    const resumeOnGesture = () => {
      if (!audioCtxRef.current) {
        initAudioContext();
      } else if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
    };

    initAudioContext();
    document.addEventListener("click", resumeOnGesture, { once: true });
    return () => document.removeEventListener("click", resumeOnGesture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recording timer
  useEffect(() => {
    if (!interview.isInitializing && interview.status === "live") {
      dispatch(startRecording());
      recordingTimerRef.current = setInterval(
        () => dispatch(updateRecordingDuration()),
        1000,
      );
      return () => {
        clearInterval(recordingTimerRef.current);
        dispatch(stopRecording());
      };
    }
  }, [interview.isInitializing, interview.status, dispatch]);

  // base64 → ArrayBuffer
  const base64ToArrayBuffer = useCallback((base64) => {
    base64 = base64.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }, []);

  // ============================================================================
  // TTS SCHEDULER
  // ============================================================================

  const stopScheduler = useCallback(() => {
    if (scheduleTimerRef.current) {
      clearInterval(scheduleTimerRef.current);
      scheduleTimerRef.current = null;
    }
  }, []);

  const stopAllSources = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (_) {}
    });
    activeSourcesRef.current = [];
  }, []);

  /**
   * Scheduler tick — runs every 25ms.
   *
   * ROOT-CAUSE FIX: We now pass the source NODE (not the buffer) to
   * connectTTSAudio. The recording hook simply taps into the already-started
   * node — same clock, same start time, zero latency, zero drift.
   */
  const scheduleTick = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === "closed") return;

    const now = ctx.currentTime;

    while (pendingBuffersRef.current.length > 0) {
      const buf = pendingBuffersRef.current[0];
      if (nextChunkAtRef.current > now + SCHEDULE_AHEAD_TIME) break;

      pendingBuffersRef.current.shift();

      const startAt = Math.max(nextChunkAtRef.current, now + 0.001);

      // ── Speaker source ────────────────────────────────────────────────────
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(ctx.destination);
      source.start(startAt);

      // ── Recording mix — ROOT-CAUSE FIX ────────────────────────────────────
      // Pass the source NODE. The recording hook connects it to its gain node.
      // Same object, same clock, same start time. No second source, no drift.
      if (audioRecording.connectTTSAudio) {
        try {
          audioRecording.connectTTSAudio(source);
        } catch (_) {}
      }

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(
          (s) => s !== source,
        );
        if (
          activeSourcesRef.current.length === 0 &&
          pendingBuffersRef.current.length === 0 &&
          ttsStreamDoneRef.current
        ) {
          isPlayingRef.current = false;
          dispatch(setIsPlaying(false));
          stopScheduler();
          console.log("✅ TTS playback complete");
        }
      };

      activeSourcesRef.current.push(source);
      nextChunkAtRef.current = startAt + buf.duration;
    }
  }, [dispatch, audioRecording, stopScheduler]);

  const startScheduler = useCallback(() => {
    if (scheduleTimerRef.current) return;
    console.log("🎵 TTS scheduler started");
    scheduleTimerRef.current = setInterval(scheduleTick, 25);
  }, [scheduleTick]);

  const resetTtsState = useCallback(() => {
    stopScheduler();
    stopAllSources();
    pendingBuffersRef.current = [];
    nextChunkAtRef.current = 0;
    ttsStreamDoneRef.current = false;
    isPlayingRef.current = false;
    dispatch(setIsPlaying(false));
  }, [stopScheduler, stopAllSources, dispatch]);

  // Handle incoming TTS audio chunk
  const handleTtsAudio = useCallback(
    async (data) => {
      try {
        let base64Audio;
        if (typeof data === "string") {
          base64Audio = data;
        } else if (data?.audio) {
          base64Audio = data.audio;
        } else {
          console.warn("⚠️ TTS audio chunk has no audio:", data);
          return;
        }
        if (!base64Audio || base64Audio.length === 0) return;

        const ctx = audioCtxRef.current;
        if (!ctx) {
          console.error("❌ No AudioContext for TTS chunk");
          return;
        }
        if (ctx.state === "closed") {
          console.error("❌ AudioContext closed");
          return;
        }
        if (ctx.state === "suspended") await ctx.resume();

        // Decode: base64 → PCM int16 → float32 AudioBuffer
        const arrayBuffer = base64ToArrayBuffer(base64Audio);
        const numSamples = arrayBuffer.byteLength / 2;
        const audioBuffer = ctx.createBuffer(
          1,
          numSamples,
          AUDIO_CONFIG.SAMPLE_RATE,
        );
        const channelData = audioBuffer.getChannelData(0);
        const dataView = new DataView(arrayBuffer);
        for (let i = 0; i < numSamples; i++) {
          channelData[i] = dataView.getInt16(i * 2, true) / 32768;
        }

        // Silence detection
        let maxAmplitude = 0;
        for (let i = 0; i < channelData.length; i++) {
          const abs = Math.abs(channelData[i]);
          if (abs > maxAmplitude) maxAmplitude = abs;
        }
        if (maxAmplitude < 0.001) return;

        if (pendingBuffersRef.current.length === 0 && !isPlayingRef.current) {
          nextChunkAtRef.current = ctx.currentTime + 0.01;
          isPlayingRef.current = true;
          dispatch(setIsPlaying(true));
          dispatch(disableListening());
          startScheduler();
        }

        pendingBuffersRef.current.push(audioBuffer);
      } catch (err) {
        console.error("❌ TTS handleTtsAudio error:", err);
      }
    },
    [dispatch, base64ToArrayBuffer, startScheduler],
  );

  const handleTtsEnd = useCallback(() => {
    dispatch(setTtsStreamActive(false));
    ttsStreamDoneRef.current = true;
    if (
      pendingBuffersRef.current.length === 0 &&
      activeSourcesRef.current.length === 0
    ) {
      isPlayingRef.current = false;
      dispatch(setIsPlaying(false));
      stopScheduler();
    }
  }, [dispatch, stopScheduler]);

  const handleQuestion = useCallback(
    (payload) => {
      const questionText =
        typeof payload === "string" ? payload : payload?.question || "";
      resetTtsState();
      dispatch(setCurrentQuestion(questionText));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
    },
    [dispatch, resetTtsState],
  );

  const handleNextQuestion = useCallback(
    (payload) => {
      resetTtsState();
      dispatch(receiveNextQuestion(payload));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
    },
    [dispatch, resetTtsState],
  );

  const handleIdlePrompt = useCallback(
    ({ text }) => {
      resetTtsState();
      dispatch(setIdlePrompt(text));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
    },
    [dispatch, resetTtsState],
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
    (data) => dispatch(setUserText(data.text)),
    [dispatch],
  );

  // Microphone streaming
  const startMicStreaming = useCallback(
    async (existingStream = null) => {
      if (micStreamRef.current) {
        console.log("🎤 Mic already streaming — skipping");
        return;
      }
      if (!socketRef.current?.connected) {
        console.error("❌ Socket not connected, cannot start mic");
        return;
      }

      try {
        let stream = existingStream;
        if (stream) {
          console.log("🎤 Reusing pre-acquired mic stream");
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
              channelCount: 1,
            },
          });
        }

        micStreamRef.current = stream;
        dispatch(setMicPermissionGranted(true));

        const ctx = audioCtxRef.current;
        if (!ctx) {
          console.error("❌ No AudioContext for mic");
          return;
        }
        if (ctx.state === "suspended") await ctx.resume();

        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        micProcessorRef.current = processor;

        source.connect(processor);
        processor.connect(ctx.destination);

        if (audioRecording.connectMicrophoneAudio) {
          await audioRecording.connectMicrophoneAudio(stream);
          console.log("🔗 Mic connected to recording mix");
        }

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

        console.log("✅ Mic streaming active — STT ready");
      } catch (err) {
        console.error("❌ Mic error:", err);
        alert("Microphone access denied or unavailable.");
      }
    },
    [dispatch, audioRecording],
  );

  const autoStartInterview = useCallback(
    async (existingMicStream = null) => {
      if (hasStartedRef.current) {
        console.log("⚠️ autoStartInterview: already started, skipping");
        return;
      }
      hasStartedRef.current = true;

      try {
        if (audioCtxRef.current?.state === "suspended")
          await audioCtxRef.current.resume();

        await startMicStreaming(existingMicStream);

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

        dispatch(setHasStarted(true));
        console.log("✅ Interview started");
      } catch (err) {
        console.error("❌ autoStartInterview error:", err);
        hasStartedRef.current = false;
        dispatch(setHasStarted(false));
        alert("Failed to start interview: " + err.message);
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
