import { useEffect, useRef, useState, useCallback } from "react";
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

const MIC_SAMPLE_RATE = 48000;

export const useInterview = (interviewId, userId, cameraStream) => {
  const dispatch = useDispatch();
  const interview = useSelector((s) => s.interview);

  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioCtxInitRef = useRef(false);
  const recordingTimerRef = useRef(null);

  const audioRecording = useAudioRecording(socketRef, interviewId, userId);

  const livekitRoomRef = useRef(null);
  const livekitTokenRef = useRef(null);
  const livekitUrlRef = useRef(null);
  const localAudioTrackRef = useRef(null);
  // Single promise ref — prevents duplicate join races
  const lkJoinPromiseRef = useRef(null);
  // Resolve fn so handleLiveKitToken can unblock autoStartInterview
  const lkReadyResolveRef = useRef(null);
  const lkReadyPromiseRef = useRef(
    new Promise((resolve) => {
      // Will be resolved once the room is actually connected
    }),
  );

  const isPlayingRef = useRef(false);
  const isListeningRef = useRef(false);
  const canListenRef = useRef(false);
  const hasStartedRef = useRef(false);
  const serverReadyRef = useRef(false);
  const ttsStreamActiveRef = useRef(false);
  const micStreamingActiveRef = useRef(false);

  // Keep refs in sync with Redux state so closures always see current values
  useEffect(() => {
    isPlayingRef.current = interview.isPlaying;
    isListeningRef.current = interview.isListening;
    canListenRef.current = interview.canListen;
    serverReadyRef.current = interview.serverReady;
    ttsStreamActiveRef.current = interview.ttsStreamActive;
    micStreamingActiveRef.current = interview.micStreamingActive;
  }, [interview]);

  const micStreamRef = useRef(null);
  const micProcessorRef = useRef(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // Create the "lkReady" promise once on mount so autoStartInterview can await it
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    lkReadyPromiseRef.current = new Promise((resolve) => {
      lkReadyResolveRef.current = resolve;
    });
    // If a room was somehow already connected before this effect (shouldn't happen
    // but be safe) resolve immediately.
    if (livekitRoomRef.current) lkReadyResolveRef.current?.();
  }, []); // eslint-disable-line

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIO CONTEXT — 48 kHz to match Deepgram STT + TTS sample rate
  // ═══════════════════════════════════════════════════════════════════════════
  const ensureAudioContext = useCallback(async () => {
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      if (audioCtxRef.current.state === "suspended")
        await audioCtxRef.current.resume();
      return audioCtxRef.current;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: MIC_SAMPLE_RATE,
      latencyHint: "interactive",
    });
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    await audioRecording.setAudioContext(ctx);
    console.log("✅ Mic AudioContext ready:", ctx.state, ctx.sampleRate + "Hz");
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
  // TTS — isolated 48 kHz AudioContext, WAV-wrapped linear16 chunks
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
      const base64 =
        typeof data === "string"
          ? data
          : typeof data?.audio === "string"
            ? data.audio
            : null;
      if (base64?.length) enqueueTTSChunk(base64);
    },
    [enqueueTTSChunk],
  );

  const handleTtsEnd = useCallback(
    (onDone) => {
      dispatch(setTtsStreamActive(false));
      flushTTS(onDone);
    },
    [dispatch, flushTTS],
  );

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
  // LIVEKIT — join + publish mic
  // ═══════════════════════════════════════════════════════════════════════════
  const joinLiveKitRoom = useCallback(async (url, token) => {
    // If already connected or a join is in flight, return existing promise
    if (livekitRoomRef.current) return livekitRoomRef.current;
    if (lkJoinPromiseRef.current) return lkJoinPromiseRef.current;

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

      room.on(RoomEvent.Connected, () => {
        console.log("🏠 LiveKit connected:", room.name);
        livekitRoomRef.current = room;
        lkJoinPromiseRef.current = null;
        // Unblock autoStartInterview which may be awaiting lkReadyPromise
        lkReadyResolveRef.current?.();
      });

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

      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          console.log(`🔊 Remote audio from: ${participant.identity}`);
          const el = track.attach();
          el.style.display = "none";
          document.body.appendChild(el);
        }
      });

      await room.connect(url, token);
      // RoomEvent.Connected fires above and sets livekitRoomRef + resolves lkReady
      return room;
    };

    lkJoinPromiseRef.current = doJoin();
    return lkJoinPromiseRef.current;
  }, []);

  // ─── Publish microphone via LiveKit ────────────────────────────────────────
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
      });
      localAudioTrackRef.current = track;
      await room.localParticipant.publishTrack(track);
      console.log("🎤 LiveKit mic published");

      const micTrack = track.mediaStreamTrack;
      const micStream = new MediaStream([micTrack]);
      const ctx = await ensureAudioContext();
      const source = ctx.createMediaStreamSource(micStream);

      // 2048 samples ≈ 43 ms at 48 kHz — lower latency than 4096
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      micProcessorRef.current = processor;
      source.connect(processor);
      processor.connect(ctx.destination);

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

      console.log("🎤 PCM tap active at", ctx.sampleRate + "Hz → Deepgram");

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

  // ─── Socket PCM fallback when LiveKit room never connects ──────────────────
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
              channelCount: 1,
            },
          }));

        micStreamRef.current = stream;
        dispatch(setMicPermissionGranted(true));

        const ctx = await ensureAudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(2048, 1, 1);
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

        console.log("✅ Socket mic PCM fallback at", ctx.sampleRate + "Hz");
      } catch (err) {
        console.error("❌ Socket mic fallback error:", err);
      }
    },
    [dispatch, audioRecording, ensureAudioContext],
  );

  // ─── Start mic — prefer LiveKit, fall back to socket PCM ──────────────────
  const startMicStreaming = useCallback(
    async (existingStream = null) => {
      // If the room is already up, publish immediately
      if (livekitRoomRef.current) {
        await publishLiveKitMic();
        return;
      }

      // If a join is in flight, wait for it (up to 5 s) then publish
      if (lkJoinPromiseRef.current) {
        try {
          await Promise.race([
            lkJoinPromiseRef.current,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("LiveKit join timeout")), 5000),
            ),
          ]);
          if (livekitRoomRef.current) {
            await publishLiveKitMic();
            return;
          }
        } catch (_) {
          // fall through to fallback
        }
      }

      // Wait for lkReadyPromise — this resolves once RoomEvent.Connected fires
      try {
        await Promise.race([
          lkReadyPromiseRef.current,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("LiveKit ready timeout")), 5000),
          ),
        ]);
        if (livekitRoomRef.current) {
          await publishLiveKitMic();
          return;
        }
      } catch (_) {
        // fall through
      }

      // True fallback — LiveKit never connected
      console.warn("⚠️ LiveKit room not ready — using socket PCM fallback");
      await startSocketMicFallback(existingStream);
    },
    [publishLiveKitMic, startSocketMicFallback],
  );

  // ─── autoStartInterview ────────────────────────────────────────────────────
  const autoStartInterview = useCallback(
    async (existingMicStream = null) => {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;
      try {
        await ensureAudioContext();

        // If token already arrived, kick off the join now
        if (
          livekitTokenRef.current &&
          livekitUrlRef.current &&
          !livekitRoomRef.current &&
          !lkJoinPromiseRef.current
        ) {
          joinLiveKitRoom(livekitUrlRef.current, livekitTokenRef.current).catch(
            console.error,
          );
        }

        // Start mic — startMicStreaming waits internally for LiveKit to connect
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

  // ─── handleLiveKitToken — called when socket receives livekit_token ────────
  const handleLiveKitToken = useCallback(
    async ({ token, url }) => {
      const resolvedToken = await Promise.resolve(token);
      if (
        typeof resolvedToken !== "string" ||
        !resolvedToken.startsWith("ey")
      ) {
        console.error(
          "❌ Invalid LiveKit token:",
          typeof resolvedToken,
          String(resolvedToken).slice(0, 40),
        );
        return;
      }
      livekitTokenRef.current = resolvedToken;
      livekitUrlRef.current = url;
      // Kick off join immediately — don't wait for autoStartInterview to call it
      if (!livekitRoomRef.current && !lkJoinPromiseRef.current) {
        joinLiveKitRoom(url, resolvedToken).catch(console.error);
      }
    },
    [joinLiveKitRoom],
  );

  // ─── cleanup ───────────────────────────────────────────────────────────────
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
