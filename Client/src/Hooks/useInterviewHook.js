import { useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  AudioPresets,
} from "livekit-client";
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
import { useTTS } from "./useSpeechHook";

const AUDIO_CONFIG = { SAMPLE_RATE: 48000 };

// ─── useInterview ─────────────────────────────────────────────────────────────
export const useInterview = (interviewId, userId, cameraStream) => {
  const dispatch = useDispatch();
  const interview = useSelector((s) => s.interview);

  // ── Core refs ──────────────────────────────────────────────────────────────
  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioCtxInitRef = useRef(false);
  const recordingTimerRef = useRef(null);

  const audioRecording = useAudioRecording(socketRef, interviewId, userId);

  // ── LiveKit refs ───────────────────────────────────────────────────────────
  const livekitRoomRef = useRef(null);
  const livekitTokenRef = useRef(null);
  const livekitUrlRef = useRef(null);
  const localAudioTrackRef = useRef(null);
  const lkJoinPromiseRef = useRef(null);

  // ── State mirror refs (avoid stale closures) ──────────────────────────────
  const isPlayingRef = useRef(false);
  const isListeningRef = useRef(false);
  const canListenRef = useRef(false);
  const hasStartedRef = useRef(false);
  const serverReadyRef = useRef(false);
  const ttsStreamActiveRef = useRef(false);
  const micStreamingActiveRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = interview.isPlaying;
    isListeningRef.current = interview.isListening;
    canListenRef.current = interview.canListen;
    serverReadyRef.current = interview.serverReady;
    ttsStreamActiveRef.current = interview.ttsStreamActive;
    micStreamingActiveRef.current = interview.micStreamingActive;
  }, [interview]);

  // ── Mic fallback ref ───────────────────────────────────────────────────────
  const micStreamRef = useRef(null);
  const micProcessorRef = useRef(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIO CONTEXT
  // ═══════════════════════════════════════════════════════════════════════════
  const ensureAudioContext = useCallback(async () => {
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      if (audioCtxRef.current.state === "suspended")
        await audioCtxRef.current.resume();
      return audioCtxRef.current;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
      latencyHint: "interactive",
    });
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    await audioRecording.setAudioContext(ctx);
    console.log("✅ AudioContext ready:", ctx.state, ctx.sampleRate + "Hz");
    return ctx;
  }, [audioRecording]);

  useEffect(() => {
    if (audioCtxInitRef.current) return;
    audioCtxInitRef.current = true;
    ensureAudioContext();

    const resumeOnGesture = () => ensureAudioContext();
    document.addEventListener("click", resumeOnGesture, { once: true });
    return () => document.removeEventListener("click", resumeOnGesture);
  }, []); // eslint-disable-line

  // ── Recording timer ────────────────────────────────────────────────────────
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

  // ═══════════════════════════════════════════════════════════════════════════
  // TTS
  // useTTS manages its own isolated AudioContext for output — it is NOT
  // connected to audioCtxRef or the recording graph, which eliminates echo.
  // ═══════════════════════════════════════════════════════════════════════════
  const { enqueueTTSChunk, flushTTS, resetTTS } = useTTS({
    onPlayStart: () => {
      isPlayingRef.current = true;
      dispatch(setIsPlaying(true));
      dispatch(disableListening());
    },
    onPlayEnd: () => {
      isPlayingRef.current = false;
      dispatch(setIsPlaying(false));
    },
  });

  const handleTtsAudio = useCallback(
    (data) => {
      // No need to ensureAudioContext here — useTTS manages its own context
      const base64 = typeof data === "string" ? data : (data?.audio ?? null);
      if (base64?.length) enqueueTTSChunk(base64);
    },
    [enqueueTTSChunk],
  );

  const handleTtsEnd = useCallback(() => {
    dispatch(setTtsStreamActive(false));
    flushTTS();
  }, [dispatch, flushTTS]);

  // ── Question handlers ──────────────────────────────────────────────────────
  const handleQuestion = useCallback(
    (payload) => {
      const text =
        typeof payload === "string" ? payload : payload?.question || "";
      resetTTS();
      dispatch(setCurrentQuestion(text));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
    },
    [dispatch, resetTTS],
  );

  const handleNextQuestion = useCallback(
    (payload) => {
      resetTTS();
      dispatch(receiveNextQuestion(payload));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
    },
    [dispatch, resetTTS],
  );

  const handleIdlePrompt = useCallback(
    ({ text }) => {
      resetTTS();
      dispatch(setIdlePrompt(text));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
    },
    [dispatch, resetTTS],
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

  // ═══════════════════════════════════════════════════════════════════════════
  // LIVEKIT ROOM
  // ═══════════════════════════════════════════════════════════════════════════

  const joinLiveKitRoom = useCallback(async (url, token) => {
    if (livekitRoomRef.current) {
      console.log("♻️ Already in LiveKit room — skipping rejoin");
      return livekitRoomRef.current;
    }
    if (lkJoinPromiseRef.current) {
      return lkJoinPromiseRef.current;
    }

    livekitUrlRef.current = url;
    livekitTokenRef.current = token;

    const doJoin = async () => {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
        reconnectPolicy: {
          nextRetryDelayInMs: (ctx) => {
            if (ctx.retryCount < 3) return 300;
            if (ctx.retryCount < 6) return 1000;
            return null;
          },
        },
      });

      room.on(RoomEvent.Connected, () =>
        console.log("🏠 LiveKit connected:", room.name),
      );
      room.on(RoomEvent.Disconnected, () =>
        console.warn("🏠 LiveKit disconnected"),
      );
      room.on(RoomEvent.Reconnecting, () =>
        console.log("🔄 LiveKit reconnecting…"),
      );
      room.on(RoomEvent.Reconnected, () =>
        console.log("✅ LiveKit reconnected"),
      );

      room.on(RoomEvent.LocalTrackPublished, (pub) => {
        socketRef.current?.emit("livekit_track_published", {
          kind: pub.kind,
          source: pub.source,
          trackSid: pub.trackSid,
        });
      });

      room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
        socketRef.current?.emit("livekit_track_unpublished", {
          source: pub.source,
          trackSid: pub.trackSid,
        });
      });

      room.on(RoomEvent.ParticipantConnected, (participant) => {
        socketRef.current?.emit("livekit_participant_joined", {
          identity: participant.identity,
        });
      });

      // ── Remote track subscription ──────────────────────────────────────
      // Audio: attach to hidden <audio> so the browser plays it.
      // Video from mobile_*: forwarded via livekitRoomRef in InterviewLive
      // (InterviewLive reads room.remoteParticipants directly via RoomEvent).
      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          console.log(`🔊 Remote audio from: ${participant.identity}`);
          const el = track.attach();
          el.style.display = "none";
          document.body.appendChild(el);
        }
        // NOTE: Mobile video tracks are handled in InterviewLive.jsx by
        // listening to RoomEvent.TrackSubscribed on livekitRoomRef.current.
        // We intentionally do NOT attach them here to avoid double-attach.
      });

      await room.connect(url, token);
      livekitRoomRef.current = room;
      lkJoinPromiseRef.current = null;
      console.log("✅ Joined LiveKit room:", room.name);
      return room;
    };

    lkJoinPromiseRef.current = doJoin();
    return lkJoinPromiseRef.current;
  }, []);

  const publishLiveKitMic = useCallback(async () => {
    const room = livekitRoomRef.current;
    if (!room) {
      console.error("❌ publishLiveKitMic: Room not connected");
      return;
    }
    if (localAudioTrackRef.current) {
      console.log("♻️ Mic already published");
      return;
    }

    try {
      const track = await createLocalAudioTrack({
        ...AudioPresets.music,
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
      });
      localAudioTrackRef.current = track;
      await room.localParticipant.publishTrack(track);
      console.log("🎤 LiveKit mic published");

      // ── Tap mic for Deepgram via socket ────────────────────────────────────
      // LiveKit sends audio over WebRTC internally — it never reaches the
      // server's socket.on("user_audio_chunk") handler that feeds Deepgram.
      // We must create a WebAudio ScriptProcessor tap on the same
      // MediaStreamTrack and emit PCM16 chunks over the socket ourselves.
      const micTrack = track.mediaStreamTrack;
      const micStream = new MediaStream([micTrack]);
      const ctx = await ensureAudioContext();
      const source = ctx.createMediaStreamSource(micStream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;
      source.connect(processor);
      processor.connect(ctx.destination); // must connect to keep graph active

      processor.onaudioprocess = (e) => {
        if (!micStreamingActiveRef.current) return;
        if (!isListeningRef.current || !canListenRef.current) return;
        if (!socketRef.current?.connected) return;

        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        socketRef.current.emit("user_audio_chunk", pcm16.buffer);
      };

      console.log("🎤 PCM tap active — mic audio → Deepgram via socket");

      if (audioRecording.connectMicrophoneAudio) {
        await audioRecording.connectMicrophoneAudio(micTrack);
      }

      dispatch(setMicPermissionGranted(true));
      dispatch(setMicStreamingActive(true));
    } catch (err) {
      console.error("❌ Failed to publish LiveKit mic:", err);
      alert("Microphone access denied or unavailable.");
    }
  }, [audioRecording, dispatch, ensureAudioContext]);

  // ── Socket PCM fallback ────────────────────────────────────────────────────
  const startSocketMicFallback = useCallback(
    async (existingStream = null) => {
      if (micStreamRef.current) return;
      if (!socketRef.current?.connected) {
        console.error("❌ Socket not connected for mic fallback");
        return;
      }
      try {
        const stream =
          existingStream ||
          (await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
              channelCount: 1,
            },
          }));

        micStreamRef.current = stream;
        dispatch(setMicPermissionGranted(true));

        const ctx = await ensureAudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        micProcessorRef.current = processor;
        source.connect(processor);
        processor.connect(ctx.destination);

        if (audioRecording.connectMicrophoneAudio)
          await audioRecording.connectMicrophoneAudio(stream);

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
          )
            socketRef.current.emit("user_audio_chunk", pcm16.buffer);
        };

        console.log("✅ Socket mic PCM fallback active");
      } catch (err) {
        console.error("❌ Socket mic fallback error:", err);
      }
    },
    [dispatch, audioRecording, ensureAudioContext],
  );

  const startMicStreaming = useCallback(
    async (existingStream = null) => {
      if (livekitRoomRef.current || lkJoinPromiseRef.current) {
        await (lkJoinPromiseRef.current || Promise.resolve());
        if (livekitRoomRef.current) {
          await publishLiveKitMic();
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 300));
      if (livekitRoomRef.current) {
        await publishLiveKitMic();
      } else {
        console.warn("⚠️ LiveKit room not ready — using socket PCM fallback");
        await startSocketMicFallback(existingStream);
      }
    },
    [publishLiveKitMic, startSocketMicFallback],
  );

  const autoStartInterview = useCallback(
    async (existingMicStream = null) => {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;

      try {
        await ensureAudioContext();

        if (
          livekitTokenRef.current &&
          livekitUrlRef.current &&
          !livekitRoomRef.current
        ) {
          await joinLiveKitRoom(livekitUrlRef.current, livekitTokenRef.current);
        }

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
    [dispatch, ensureAudioContext, startMicStreaming, joinLiveKitRoom],
  );

  const handleLiveKitToken = useCallback(
    async ({ token, url }) => {
      // Resolve token in case livekit-server-sdk returns a Promise<string>
      const resolvedToken = await Promise.resolve(token);
      livekitTokenRef.current = resolvedToken;
      livekitUrlRef.current = url;
      // Guard against duplicate joins — autoStartInterview may also call joinLiveKitRoom
      if (!livekitRoomRef.current && !lkJoinPromiseRef.current) {
        joinLiveKitRoom(url, resolvedToken).catch(console.error);
      }
    },
    [joinLiveKitRoom],
  );

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      resetTTS();
      if (livekitRoomRef.current) {
        livekitRoomRef.current.disconnect();
        livekitRoomRef.current = null;
      }
    };
  }, [resetTTS]);

  return {
    ...interview,
    socketRef,
    audioCtxRef,
    micStreamRef,
    // ── Expose livekitRoomRef so InterviewLive can bind RoomEvent listeners ──
    livekitRoomRef,
    handleLiveKitToken,
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
    setStatus: (s) => dispatch(setStatus(s)),
    setServerReady: (r) => dispatch(setServerReady(r)),
    setHasStarted: (v) => dispatch(setHasStarted(v)),
    setIsInitializing: (v) => dispatch(setIsInitializing(v)),
    enableListening: () => dispatch(enableListening()),
    disableListening: () => dispatch(disableListening()),
    setMicStreamingActive: (v) => dispatch(setMicStreamingActive(v)),
    initializeInterview: (d) => dispatch(initializeInterview(d)),
  };
};
