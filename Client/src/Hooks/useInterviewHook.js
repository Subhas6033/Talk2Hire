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
const NOISE_GATE_RMS = 0.01;

// ─────────────────────────────────────────────────────────────────────────────
// MODULE-LEVEL ROOM SINGLETON
//
// THE CORE PROBLEM THIS SOLVES:
// React (even without StrictMode) can instantiate useInterview multiple times
// before one unmounts. Each instance has its own `livekitRoomRef`. When the
// livekit_token fires and is received by both instances simultaneously, both
// see livekitRoomRef.current === null and both call joinLiveKitRoom, creating
// two Room objects connecting with the same identity. LiveKit's server boots
// the first connection when the second arrives (duplicate identity eviction),
// destroying the working room and detaching the mobile video track.
//
// SOLUTION: Store the Room and join promise at MODULE level. All hook instances
// share the same singleton. Only one Room is ever created per page load.
// Reset only happens on explicit cleanup (page navigation away).
// ─────────────────────────────────────────────────────────────────────────────
let _room = null; // The single Room instance for this page
let _joinPromise = null; // The in-flight room.connect() promise
let _joinResolvers = []; // Callbacks waiting for room to be ready

function _onRoomReady(cb) {
  if (_room) {
    cb(_room);
    return;
  }
  _joinResolvers.push(cb);
}

function _resolveRoom(room) {
  _room = room;
  const cbs = _joinResolvers.splice(0);
  cbs.forEach((cb) => cb(room));
}

function _resetSingleton() {
  console.log("[LK-SINGLETON] Reset");
  _room = null;
  _joinPromise = null;
  _joinResolvers = [];
}

function getRMS(input) {
  let sum = 0;
  for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
  return Math.sqrt(sum / input.length);
}

function toPCM16(input) {
  const pcm16 = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

export const useInterview = (interviewId, userId, cameraStream) => {
  const dispatch = useDispatch();
  const interview = useSelector((s) => s.interview);

  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioCtxInitRef = useRef(false);
  const recordingTimerRef = useRef(null);

  const audioRecording = useAudioRecording(socketRef, interviewId, userId);

  // Each hook instance has its own ref that POINTS TO the module singleton.
  // When _room is set, we sync it here so livekitRoomRef.current is always
  // up to date for this instance. The polling effect in InterviewLive.jsx
  // reads this ref to find the room.
  const livekitRoomRef = useRef(null);

  // lkReady: resolves when the room is connected
  const lkReadyResolveRef = useRef(null);
  const lkReadyPromiseRef = useRef(
    new Promise((resolve) => {
      lkReadyResolveRef.current = resolve;
    }),
  );

  const localAudioTrackRef = useRef(null);
  const micProcessorRef = useRef(null);
  const micStreamRef = useRef(null);

  const isPlayingRef = useRef(false);
  const isListeningRef = useRef(false);
  const canListenRef = useRef(false);
  const hasStartedRef = useRef(false);
  const serverReadyRef = useRef(false);
  const ttsStreamActiveRef = useRef(false);
  const micStreamingActiveRef = useRef(false);

  // Sync module singleton → instance ref on mount (handles case where room
  // was created by a previous instance of this hook, e.g. after StrictMode remount)
  useEffect(() => {
    console.log(
      "[LK] Hook instance mounted, syncing singleton → livekitRoomRef",
    );
    console.log("[LK] _room at mount:", _room ? "EXISTS ✅" : "null");

    if (_room) {
      livekitRoomRef.current = _room;
      lkReadyResolveRef.current?.();
      console.log("[LK] Synced existing room to new hook instance");
    }

    // Subscribe to be notified when room becomes ready
    _onRoomReady((room) => {
      livekitRoomRef.current = room;
      lkReadyResolveRef.current?.();
      console.log("[LK] Room ready callback fired — synced to livekitRoomRef");
    });
  }, []); // eslint-disable-line

  useEffect(() => {
    isPlayingRef.current = interview.isPlaying;
    isListeningRef.current = interview.isListening;
    canListenRef.current = interview.canListen;
    serverReadyRef.current = interview.serverReady;
    ttsStreamActiveRef.current = interview.ttsStreamActive;
    micStreamingActiveRef.current = interview.micStreamingActive;
  }, [interview]);

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

  // ── Audio Context ──────────────────────────────────────────────────────────
  const ensureAudioContext = useCallback(async () => {
    try {
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
      console.log("✅ AudioContext ready:", ctx.state, ctx.sampleRate + "Hz");
      return ctx;
    } catch (err) {
      console.error("❌ ensureAudioContext FAILED:", err.message);
      throw err;
    }
  }, [audioRecording]);

  useEffect(() => {
    if (audioCtxInitRef.current) return;
    audioCtxInitRef.current = true;
    ensureAudioContext().catch(console.error);
    const resume = () => ensureAudioContext().catch(console.error);
    document.addEventListener("click", resume, { once: true });
    return () => document.removeEventListener("click", resume);
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

  // ── TTS ────────────────────────────────────────────────────────────────────
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
      console.log("❓ handleQuestion:", text.slice(0, 80));
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

  // ── LiveKit Room Join ──────────────────────────────────────────────────────
  const joinLiveKitRoom = useCallback(async (url, token) => {
    console.log("🏠 [LK] joinLiveKitRoom called");
    console.log("  _room (singleton):", _room ? "EXISTS" : "null");
    console.log("  _joinPromise:", _joinPromise ? "in-flight" : "null");

    // Guard 1: Room already connected (module singleton)
    if (_room) {
      console.log("♻️ [LK] Reusing existing module-singleton room");
      livekitRoomRef.current = _room;
      lkReadyResolveRef.current?.();
      return _room;
    }

    // Guard 2: Join already in progress (module singleton promise)
    // Both hook instances will await the SAME promise instead of each creating a Room
    if (_joinPromise) {
      console.log(
        "⏳ [LK] Join already in progress (module singleton) — awaiting shared promise",
      );
      return _joinPromise;
    }

    const doJoin = async () => {
      console.log("🔧 [LK] Creating Room object...");
      const room = new Room({
        dynacast: true,
        autoSubscribe: true,
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
        console.log("🏠 ✅ [LK] Room connected!");
        console.log("  room.name:", room.name);
        console.log(
          "  remoteParticipants:",
          [...room.remoteParticipants.values()].map((p) => p.identity),
        );
        // Set module singleton — all hook instances immediately see this
        _resolveRoom(room);
        livekitRoomRef.current = room;
        lkReadyResolveRef.current?.();
        _joinPromise = null;
      });

      room.on(RoomEvent.Disconnected, (reason) => {
        console.warn("🏠 [LK] Disconnected, reason:", reason);
        // Only clear singleton if this is the current singleton room
        if (_room === room) _room = null;
        livekitRoomRef.current = null;
      });

      room.on(RoomEvent.Reconnected, () => {
        console.log("✅ [LK] Reconnected");
        _room = room;
        livekitRoomRef.current = room;
      });

      room.on(RoomEvent.LocalTrackPublished, (pub) => {
        console.log("📡 [LK] LocalTrackPublished:", pub.kind);
        socketRef.current?.emit("livekit_track_published", {
          kind: pub.kind,
          source: pub.source,
          trackSid: pub.trackSid,
        });
      });

      room.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log("👤 [LK] ParticipantConnected:", participant.identity);
        socketRef.current?.emit("livekit_participant_joined", {
          identity: participant.identity,
        });
      });

      room.on(RoomEvent.TrackPublished, (pub, participant) => {
        console.log(
          "📢 [LK] TrackPublished:",
          participant.identity,
          "kind:",
          pub.kind,
          "subscribed:",
          pub.isSubscribed,
        );
      });

      // AUDIO ONLY — Video track attachment is owned by InterviewLive.jsx
      room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
        console.log(
          "📡 [LK] TrackSubscribed:",
          participant.identity,
          "kind:",
          track.kind,
        );
        if (track.kind === Track.Kind.Audio) {
          try {
            const el = track.attach();
            el.style.display = "none";
            document.body.appendChild(el);
            console.log(
              "🔊 [LK] Remote audio attached for:",
              participant.identity,
            );
          } catch (err) {
            console.error("❌ [LK] Audio attach failed:", err.message);
          }
        }
        if (track.kind === Track.Kind.Video) {
          console.log(
            "🎥 [LK] Video track from:",
            participant.identity,
            "— deferring to InterviewLive polling effect",
          );
        }
      });

      room.on(
        RoomEvent.TrackSubscriptionFailed,
        (trackSid, participant, reason) => {
          console.error(
            "❌ [LK] TrackSubscriptionFailed:",
            participant?.identity,
            reason,
          );
        },
      );

      // Connect with 30s timeout (increased from 15s to survive region failover)
      console.log("🔌 [LK] Calling room.connect()...");
      console.log("  url:", url);
      console.log("  token (first 30):", token?.slice(0, 30));

      try {
        await Promise.race([
          room.connect(url, token),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(new Error("LiveKit room.connect() timed out after 30s")),
              30_000,
            ),
          ),
        ]);
        console.log("✅ [LK] room.connect() resolved");
        console.log(
          "  remoteParticipants:",
          [...room.remoteParticipants.values()].map((p) => p.identity),
        );
        return room;
      } catch (err) {
        console.error("❌ [LK] room.connect() FAILED:", err.message);
        if (_room === room) _room = null;
        _joinPromise = null;
        try {
          room.disconnect();
        } catch (_) {}
        throw err;
      }
    };

    _joinPromise = doJoin();
    return _joinPromise;
  }, []); // eslint-disable-line

  // ── Mic publishing ─────────────────────────────────────────────────────────
  const publishLiveKitMic = useCallback(async () => {
    const room = livekitRoomRef.current || _room;
    if (!room) {
      console.error("❌ [MIC] No room to publish mic to");
      return;
    }
    if (localAudioTrackRef.current) {
      console.log("♻️ [MIC] Already published");
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
      console.log("✅ [MIC] LiveKit mic published");

      const ctx = await ensureAudioContext();
      const source = ctx.createMediaStreamSource(
        new MediaStream([track.mediaStreamTrack]),
      );
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      micProcessorRef.current = processor;
      source.connect(processor);
      processor.connect(ctx.destination);

      processor.onaudioprocess = (e) => {
        if (
          !micStreamingActiveRef.current ||
          !isListeningRef.current ||
          !canListenRef.current
        )
          return;
        if (!socketRef.current?.connected) return;
        const input = e.inputBuffer.getChannelData(0);
        if (getRMS(input) < NOISE_GATE_RMS) return;
        socketRef.current.emit("user_audio_chunk", toPCM16(input).buffer);
      };

      if (audioRecording.connectMicrophoneAudio)
        await audioRecording.connectMicrophoneAudio(track.mediaStreamTrack);

      dispatch(setMicPermissionGranted(true));
      dispatch(setMicStreamingActive(true));
    } catch (err) {
      console.error("❌ [MIC] publishLiveKitMic failed:", err.message);
      localAudioTrackRef.current = null;
    }
  }, [audioRecording, dispatch, ensureAudioContext]);

  const startSocketMicFallback = useCallback(
    async (existingStream = null) => {
      if (micStreamRef.current) return;
      if (!socketRef.current?.connected) return;
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
          if (
            !micStreamingActiveRef.current ||
            !isListeningRef.current ||
            !canListenRef.current
          )
            return;
          if (!socketRef.current?.connected) return;
          const input = e.inputBuffer.getChannelData(0);
          if (getRMS(input) < NOISE_GATE_RMS) return;
          socketRef.current.emit("user_audio_chunk", toPCM16(input).buffer);
        };

        console.log(
          "✅ [FALLBACK] Socket mic PCM active at",
          ctx.sampleRate + "Hz",
        );
      } catch (err) {
        console.error(
          "❌ [FALLBACK] startSocketMicFallback failed:",
          err.message,
        );
      }
    },
    [dispatch, audioRecording, ensureAudioContext],
  );

  const startMicStreaming = useCallback(
    async (existingStream = null) => {
      const currentRoom = livekitRoomRef.current || _room;
      if (currentRoom) {
        await publishLiveKitMic();
        return;
      }
      if (_joinPromise) {
        try {
          await Promise.race([
            _joinPromise,
            new Promise((_, r) =>
              setTimeout(() => r(new Error("timeout")), 8_000),
            ),
          ]);
          if (livekitRoomRef.current || _room) {
            await publishLiveKitMic();
            return;
          }
        } catch (_) {}
      }
      try {
        await Promise.race([
          lkReadyPromiseRef.current,
          new Promise((_, r) =>
            setTimeout(() => r(new Error("lkReady timeout (12s)")), 12_000),
          ),
        ]);
        if (livekitRoomRef.current || _room) {
          await publishLiveKitMic();
          return;
        }
      } catch (err) {
        console.warn(
          "⚠️ [MIC] lkReady timed out — falling back to socket PCM:",
          err.message,
        );
      }
      await startSocketMicFallback(existingStream);
    },
    [publishLiveKitMic, startSocketMicFallback],
  );

  // ── autoStartInterview ─────────────────────────────────────────────────────
  const autoStartInterview = useCallback(
    async (existingMicStream = null) => {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;
      try {
        await ensureAudioContext();
        await startMicStreaming(existingMicStream);
        if (!serverReadyRef.current || !socketRef.current?.connected) {
          hasStartedRef.current = false;
          return;
        }
        dispatch(setHasStarted(true));
        console.log("✅ [START] Interview started");
      } catch (err) {
        console.error("❌ [START] autoStartInterview failed:", err.message);
        hasStartedRef.current = false;
        dispatch(setHasStarted(false));
      }
    },
    [dispatch, ensureAudioContext, startMicStreaming],
  );

  // ── handleLiveKitToken ─────────────────────────────────────────────────────
  const handleLiveKitToken = useCallback(
    async ({ token, url }) => {
      console.log("🔑 [TOKEN] handleLiveKitToken called");
      console.log("  url:", url);
      console.log("  token (first 30):", token?.slice?.(0, 30));
      console.log("  _room (singleton):", _room ? "EXISTS" : "null");
      console.log("  _joinPromise:", _joinPromise ? "in-flight" : "null");

      if (typeof token !== "string" || !token.startsWith("ey")) {
        console.error("❌ [TOKEN] Invalid token received");
        return;
      }

      // Already have a room or join in progress — do nothing
      if (_room) {
        console.log("ℹ️ [TOKEN] Room already exists — skipping join");
        livekitRoomRef.current = _room;
        lkReadyResolveRef.current?.();
        return;
      }
      if (_joinPromise) {
        console.log(
          "ℹ️ [TOKEN] Join already in progress — awaiting shared promise",
        );
        try {
          await _joinPromise;
        } catch (_) {}
        return;
      }

      // First caller wins — all subsequent calls blocked by _joinPromise guard above
      console.log("🔌 [TOKEN] Initiating joinLiveKitRoom...");
      joinLiveKitRoom(url, token).catch((err) =>
        console.error("❌ [TOKEN] joinLiveKitRoom failed:", err.message),
      );
    },
    [joinLiveKitRoom],
  );

  // ── Listening ──────────────────────────────────────────────────────────────
  const enableListeningImmediate = useCallback(() => {
    isListeningRef.current = true;
    canListenRef.current = true;
    dispatch(enableListening());
  }, [dispatch]);

  const disableListeningImmediate = useCallback(() => {
    isListeningRef.current = false;
    canListenRef.current = false;
    dispatch(disableListening());
  }, [dispatch]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      console.log("🧹 [CLEANUP] useInterview unmounting...");
      resetTTS();
      // Do NOT disconnect the room on unmount — StrictMode unmounts then remounts.
      // Room disconnection only happens when InterviewLive explicitly leaves.
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
    enableListening: enableListeningImmediate,
    disableListening: disableListeningImmediate,
    setMicStreamingActive: (v) => dispatch(setMicStreamingActive(v)),
    initializeInterview: (d) => dispatch(initializeInterview(d)),
    // Expose reset for InterviewLive cleanup on actual navigation away
    resetLiveKitSingleton: _resetSingleton,
  };
};
