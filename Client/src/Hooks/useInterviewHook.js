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

  const livekitRoomRef = useRef(null);
  const livekitTokenRef = useRef(null);
  const livekitUrlRef = useRef(null);
  const localAudioTrackRef = useRef(null);
  const lkJoinPromiseRef = useRef(null);
  const lkReadyResolveRef = useRef(null);
  const lkReadyPromiseRef = useRef(new Promise(() => {}));

  const isPlayingRef = useRef(false);
  const isListeningRef = useRef(false);
  const canListenRef = useRef(false);
  const hasStartedRef = useRef(false);
  const serverReadyRef = useRef(false);
  const ttsStreamActiveRef = useRef(false);
  const micStreamingActiveRef = useRef(false);
  const micStreamRef = useRef(null);
  const micProcessorRef = useRef(null);

  useEffect(() => {
    isPlayingRef.current = interview.isPlaying;
    isListeningRef.current = interview.isListening;
    canListenRef.current = interview.canListen;
    serverReadyRef.current = interview.serverReady;
    ttsStreamActiveRef.current = interview.ttsStreamActive;
    micStreamingActiveRef.current = interview.micStreamingActive;
  }, [interview]);

  // ═══════════════════════════════════════════════════════════════════════════
  // lkReady promise — resolved once room.connect() succeeds
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    lkReadyPromiseRef.current = new Promise((resolve) => {
      lkReadyResolveRef.current = resolve;
    });
    console.log("🔧 [LK] lkReady promise initialized");
    if (livekitRoomRef.current) {
      console.log(
        "🔧 [LK] Room already exists — resolving lkReady immediately",
      );
      lkReadyResolveRef.current?.();
    }
  }, []); // eslint-disable-line

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIO CONTEXT
  // ═══════════════════════════════════════════════════════════════════════════
  const ensureAudioContext = useCallback(async () => {
    try {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        if (audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
          console.log("▶️ AudioContext resumed from suspended");
        }
        return audioCtxRef.current;
      }
      const ctx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: MIC_SAMPLE_RATE,
        latencyHint: "interactive",
      });
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      await audioRecording.setAudioContext(ctx);
      console.log(
        "✅ Mic AudioContext ready:",
        ctx.state,
        ctx.sampleRate + "Hz",
      );
      return ctx;
    } catch (err) {
      console.error("❌ ensureAudioContext FAILED:", err.message, err);
      throw err;
    }
  }, [audioRecording]);

  useEffect(() => {
    if (audioCtxInitRef.current) return;
    audioCtxInitRef.current = true;
    ensureAudioContext().catch((err) =>
      console.error("❌ Initial AudioContext error:", err.message),
    );
    const resumeOnGesture = () =>
      ensureAudioContext().catch((err) =>
        console.error("❌ Gesture AudioContext error:", err.message),
      );
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
  // TTS
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
      console.log("❓ handleNextQuestion:", payload?.question?.slice(0, 80));
      resetTTS();
      dispatch(receiveNextQuestion(payload));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
    },
    [dispatch, resetTTS],
  );

  const handleIdlePrompt = useCallback(
    ({ text }) => {
      console.log("💤 handleIdlePrompt:", text?.slice(0, 80));
      resetTTS();
      dispatch(setIdlePrompt(text));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
    },
    [dispatch, resetTTS],
  );

  const handleTranscriptReceived = useCallback(
    ({ text }) => {
      console.log("📝 transcript received:", text?.slice(0, 80));
      dispatch(setUserText(text));
      dispatch(disableListening());
    },
    [dispatch],
  );

  const handleInterviewComplete = useCallback(
    (data) => {
      console.log(
        "🏁 Interview complete, totalQuestions:",
        data.totalQuestions,
      );
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
  // LIVEKIT — join room
  // ═══════════════════════════════════════════════════════════════════════════
  const joinLiveKitRoom = useCallback(async (url, token) => {
    console.log("🏠 [LK] joinLiveKitRoom called");
    console.log("  url:", url);
    console.log("  token type:", typeof token);
    console.log("  token starts with ey:", token?.startsWith?.("ey"));
    console.log("  token length:", token?.length);
    console.log("  room already exists:", !!livekitRoomRef.current);
    console.log("  join already in progress:", !!lkJoinPromiseRef.current);

    if (livekitRoomRef.current) {
      console.log("♻️ [LK] Reusing existing room");
      return livekitRoomRef.current;
    }
    if (lkJoinPromiseRef.current) {
      console.log(
        "⏳ [LK] Join already in progress, awaiting existing promise",
      );
      return lkJoinPromiseRef.current;
    }

    livekitUrlRef.current = url;
    livekitTokenRef.current = token;

    const doJoin = async () => {
      console.log("🔧 [LK] doJoin: creating Room object...");

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

      // ── Room events ───────────────────────────────────────────────────────
      room.on(RoomEvent.Connected, () => {
        console.log("🏠 ✅ [LK] RoomEvent.Connected fired!");
        console.log("  room.name:", room.name);
        console.log("  room.state:", room.state);
        console.log(
          "  remoteParticipants:",
          [...room.remoteParticipants.values()].map((p) => p.identity),
        );
        livekitRoomRef.current = room;
        lkJoinPromiseRef.current = null;
        lkReadyResolveRef.current?.();
        console.log("  lkReadyResolveRef resolved ✅");
      });

      room.on(RoomEvent.Disconnected, (reason) => {
        console.warn("🏠 [LK] Disconnected, reason:", reason);
        livekitRoomRef.current = null;
      });

      room.on(RoomEvent.Reconnecting, () =>
        console.log("🔄 [LK] Reconnecting…"),
      );

      room.on(RoomEvent.Reconnected, () => {
        console.log("✅ [LK] Reconnected");
        livekitRoomRef.current = room;
      });

      room.on(RoomEvent.LocalTrackPublished, (pub) => {
        console.log("📡 [LK] LocalTrackPublished:", pub.kind, pub.source);
        socketRef.current?.emit("livekit_track_published", {
          kind: pub.kind,
          source: pub.source,
          trackSid: pub.trackSid,
        });
      });

      room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
        console.log("📡 [LK] LocalTrackUnpublished:", pub.source);
        socketRef.current?.emit("livekit_track_unpublished", {
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

      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log("👤 [LK] ParticipantDisconnected:", participant.identity);
      });

      room.on(RoomEvent.TrackPublished, (pub, participant) => {
        console.log(
          "📢 [LK] TrackPublished:",
          participant.identity,
          "kind:",
          pub.kind,
          "isSubscribed:",
          pub.isSubscribed,
          "trackSid:",
          pub.trackSid,
        );
      });

      // ─────────────────────────────────────────────────────────────────────
      // FIX: TrackSubscribed — this hook now handles AUDIO ONLY.
      //
      // Video track attachment is intentionally NOT done here.
      // InterviewLive.jsx's polling effect is the sole owner of mobile video
      // attachment and the setMobileTrackAttached state update.
      //
      // Previously both places tried to attach the video track, but only
      // InterviewLive.jsx calls setMobileTrackAttached(true) to make it
      // visible. Since this hook's handler fired first (registered earlier),
      // the track got attached here but the video stayed invisible because
      // setMobileTrackAttached was never called. Then when the polling effect
      // ran its retroactive scan, TrackSubscribed had already fired so its
      // listener never triggered either.
      //
      // Solution: Remove video attachment from here entirely. Let
      // InterviewLive.jsx own the full lifecycle (attach + show).
      // ─────────────────────────────────────────────────────────────────────
      room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
        console.log("📡 [LK] TrackSubscribed:");
        console.log("  participant:", participant.identity);
        console.log("  track.kind:", track.kind);
        console.log("  pub.source:", pub.source);
        console.log("  pub.trackSid:", pub.trackSid);

        // ✅ Audio only — append hidden element for playback
        if (track.kind === Track.Kind.Audio) {
          console.log("🔊 [LK] Remote audio from:", participant.identity);
          try {
            const el = track.attach();
            el.style.display = "none";
            document.body.appendChild(el);
            console.log("✅ [LK] Remote audio element appended to body");
          } catch (err) {
            console.error(
              "❌ [LK] Error attaching audio track:",
              err.message,
              err,
            );
          }
        }

        // ❌ Video attachment removed from here.
        // InterviewLive.jsx polling effect handles mobile video exclusively.
        if (track.kind === Track.Kind.Video) {
          console.log(
            "🎥 [LK] Video track subscribed from:",
            participant.identity,
            "— deferring to InterviewLive polling effect for attachment",
          );
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
        console.log(
          "📡 [LK] TrackUnsubscribed:",
          participant.identity,
          track.kind,
        );
      });

      room.on(
        RoomEvent.TrackSubscriptionFailed,
        (trackSid, participant, reason) => {
          console.error(
            "❌ [LK] TrackSubscriptionFailed:",
            "trackSid:",
            trackSid,
            "participant:",
            participant?.identity,
            "reason:",
            reason,
          );
        },
      );

      // ── room.connect() with 15s timeout ───────────────────────────────────
      console.log("🔌 [LK] Calling room.connect()...");
      console.log("  url:", url);
      console.log("  token (first 30 chars):", token?.slice(0, 30));

      try {
        await Promise.race([
          room.connect(url, token),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(new Error("LiveKit room.connect() timed out after 15s")),
              15_000,
            ),
          ),
        ]);
        console.log("✅ [LK] room.connect() resolved!");
        console.log("  room.state after connect:", room.state);
        console.log(
          "  remoteParticipants after connect:",
          [...room.remoteParticipants.values()].map((p) => p.identity),
        );
      } catch (err) {
        console.error("❌ [LK] room.connect() FAILED:", err.message);
        console.error("  Full error:", err);
        livekitRoomRef.current = null;
        lkJoinPromiseRef.current = null;
        try {
          room.disconnect();
        } catch (_) {}
        throw err;
      }

      return room;
    };

    lkJoinPromiseRef.current = doJoin();
    return lkJoinPromiseRef.current;
  }, []);

  // ─── publishLiveKitMic ────────────────────────────────────────────────────
  const publishLiveKitMic = useCallback(async () => {
    console.log("🎤 [MIC] publishLiveKitMic called");
    const room = livekitRoomRef.current;
    if (!room) {
      console.error(
        "❌ [MIC] publishLiveKitMic: Room not connected — livekitRoomRef is null",
      );
      return;
    }
    if (localAudioTrackRef.current) {
      console.log("♻️ [MIC] Mic already published, skipping");
      return;
    }

    try {
      console.log("🎤 [MIC] Creating local audio track...");
      const track = await createLocalAudioTrack({
        ...AudioPresets.music,
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      });
      console.log("✅ [MIC] Local audio track created");

      localAudioTrackRef.current = track;
      console.log("🎤 [MIC] Publishing track to LiveKit room...");
      await room.localParticipant.publishTrack(track);
      console.log("✅ [MIC] LiveKit mic published successfully");

      const micTrack = track.mediaStreamTrack;
      const micStream = new MediaStream([micTrack]);
      const ctx = await ensureAudioContext();
      const source = ctx.createMediaStreamSource(micStream);
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      micProcessorRef.current = processor;
      source.connect(processor);
      processor.connect(ctx.destination);

      processor.onaudioprocess = (e) => {
        if (!micStreamingActiveRef.current) return;
        if (!isListeningRef.current || !canListenRef.current) return;
        if (!socketRef.current?.connected) return;
        const input = e.inputBuffer.getChannelData(0);
        if (getRMS(input) < NOISE_GATE_RMS) return;
        socketRef.current.emit("user_audio_chunk", toPCM16(input).buffer);
      };

      console.log(
        "🎤 [MIC] PCM tap active at",
        ctx.sampleRate + "Hz → Deepgram",
      );

      if (audioRecording.connectMicrophoneAudio) {
        await audioRecording.connectMicrophoneAudio(micTrack);
        console.log("✅ [MIC] Mic connected to recording mix");
      }

      dispatch(setMicPermissionGranted(true));
      dispatch(setMicStreamingActive(true));
      console.log("✅ [MIC] publishLiveKitMic complete");
    } catch (err) {
      console.error("❌ [MIC] publishLiveKitMic FAILED:", err.message);
      console.error("  Full error:", err);
      localAudioTrackRef.current = null;
      alert("Microphone access denied or unavailable: " + err.message);
    }
  }, [audioRecording, dispatch, ensureAudioContext]);

  // ─── startSocketMicFallback ───────────────────────────────────────────────
  const startSocketMicFallback = useCallback(
    async (existingStream = null) => {
      console.log("🎤 [FALLBACK] startSocketMicFallback called");
      if (micStreamRef.current) {
        console.log("♻️ [FALLBACK] Fallback mic already active, skipping");
        return;
      }
      if (!socketRef.current?.connected) {
        console.error(
          "❌ [FALLBACK] Socket not connected — cannot start mic fallback",
        );
        return;
      }
      try {
        let stream = existingStream;
        if (!stream) {
          console.log("🎤 [FALLBACK] Requesting getUserMedia...");
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              channelCount: 1,
            },
          });
          console.log("✅ [FALLBACK] getUserMedia granted");
        } else {
          console.log("✅ [FALLBACK] Using existing mic stream");
        }

        micStreamRef.current = stream;
        dispatch(setMicPermissionGranted(true));

        const ctx = await ensureAudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(2048, 1, 1);
        micProcessorRef.current = processor;
        source.connect(processor);
        processor.connect(ctx.destination);

        if (audioRecording.connectMicrophoneAudio) {
          await audioRecording.connectMicrophoneAudio(stream);
          console.log("✅ [FALLBACK] Mic connected to recording mix");
        }

        dispatch(setMicStreamingActive(true));

        processor.onaudioprocess = (e) => {
          if (!micStreamingActiveRef.current) return;
          if (!isListeningRef.current || !canListenRef.current) return;
          if (!socketRef.current?.connected) return;
          const input = e.inputBuffer.getChannelData(0);
          if (getRMS(input) < NOISE_GATE_RMS) return;
          socketRef.current.emit("user_audio_chunk", toPCM16(input).buffer);
        };

        console.log(
          "✅ [FALLBACK] Socket mic PCM fallback active at",
          ctx.sampleRate + "Hz",
        );
      } catch (err) {
        console.error(
          "❌ [FALLBACK] startSocketMicFallback FAILED:",
          err.message,
        );
        console.error("  Full error:", err);
      }
    },
    [dispatch, audioRecording, ensureAudioContext],
  );

  // ─── startMicStreaming ────────────────────────────────────────────────────
  const startMicStreaming = useCallback(
    async (existingStream = null) => {
      console.log("🎤 [MIC] startMicStreaming called");
      console.log("  livekitRoomRef.current:", !!livekitRoomRef.current);
      console.log("  lkJoinPromiseRef.current:", !!lkJoinPromiseRef.current);

      // Path 1: Room already connected
      if (livekitRoomRef.current) {
        console.log(
          "✅ [MIC] Room already connected — publishing LiveKit mic directly",
        );
        await publishLiveKitMic();
        return;
      }

      // Path 2: Room join in progress — wait up to 5s
      if (lkJoinPromiseRef.current) {
        console.log("⏳ [MIC] Room join in progress — waiting up to 5s...");
        try {
          await Promise.race([
            lkJoinPromiseRef.current,
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("LiveKit join timeout (5s)")),
                5_000,
              ),
            ),
          ]);
          if (livekitRoomRef.current) {
            console.log(
              "✅ [MIC] Room connected after waiting — publishing LiveKit mic",
            );
            await publishLiveKitMic();
            return;
          } else {
            console.warn("⚠️ [MIC] lkJoinPromise resolved but room still null");
          }
        } catch (err) {
          console.warn(
            "⚠️ [MIC] lkJoinPromise timed out or failed:",
            err.message,
          );
        }
      }

      // Path 3: Wait for lkReady promise up to 10s
      console.log("⏳ [MIC] Waiting on lkReady promise up to 10s...");
      try {
        await Promise.race([
          lkReadyPromiseRef.current,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("LiveKit ready timeout (10s)")),
              10_000,
            ),
          ),
        ]);
        if (livekitRoomRef.current) {
          console.log("✅ [MIC] lkReady resolved — publishing LiveKit mic");
          await publishLiveKitMic();
          return;
        } else {
          console.warn("⚠️ [MIC] lkReady resolved but room still null");
        }
      } catch (err) {
        console.warn("⚠️ [MIC] lkReady timed out or failed:", err.message);
      }

      // Path 4: Fallback to socket PCM
      console.warn(
        "⚠️ [MIC] LiveKit room not ready — falling back to socket PCM",
      );
      await startSocketMicFallback(existingStream);
    },
    [publishLiveKitMic, startSocketMicFallback],
  );

  // ─── autoStartInterview ───────────────────────────────────────────────────
  const autoStartInterview = useCallback(
    async (existingMicStream = null) => {
      console.log("🚀 [START] autoStartInterview called");
      console.log("  hasStartedRef.current:", hasStartedRef.current);

      if (hasStartedRef.current) {
        console.log("⚠️ [START] Already started — skipping");
        return;
      }
      hasStartedRef.current = true;

      try {
        await ensureAudioContext();
        console.log("✅ [START] AudioContext ready");

        console.log("  livekitTokenRef exists:", !!livekitTokenRef.current);
        console.log("  livekitUrlRef:", livekitUrlRef.current);
        console.log("  room exists:", !!livekitRoomRef.current);
        console.log("  join in progress:", !!lkJoinPromiseRef.current);

        if (
          livekitTokenRef.current &&
          livekitUrlRef.current &&
          !livekitRoomRef.current &&
          !lkJoinPromiseRef.current
        ) {
          console.log(
            "🔌 [START] Triggering joinLiveKitRoom from autoStartInterview...",
          );
          joinLiveKitRoom(livekitUrlRef.current, livekitTokenRef.current).catch(
            (err) =>
              console.error("❌ [START] joinLiveKitRoom failed:", err.message),
          );
        } else {
          console.log(
            "ℹ️ [START] Skipping joinLiveKitRoom — conditions not met",
          );
          if (!livekitTokenRef.current) console.log("    reason: no token yet");
          if (!livekitUrlRef.current) console.log("    reason: no url yet");
          if (livekitRoomRef.current)
            console.log("    reason: room already exists");
          if (lkJoinPromiseRef.current)
            console.log("    reason: join already in progress");
        }

        console.log("🎤 [START] Calling startMicStreaming...");
        await startMicStreaming(existingMicStream);
        console.log("✅ [START] Mic streaming started");

        if (!serverReadyRef.current) {
          console.error("❌ [START] Server not ready — aborting");
          hasStartedRef.current = false;
          return;
        }
        if (!socketRef.current?.connected) {
          console.error("❌ [START] Socket not connected — aborting");
          hasStartedRef.current = false;
          return;
        }

        dispatch(setHasStarted(true));
        console.log("✅ [START] Interview started successfully!");
      } catch (err) {
        console.error("❌ [START] autoStartInterview FAILED:", err.message);
        console.error("  Full error:", err);
        hasStartedRef.current = false;
        dispatch(setHasStarted(false));
        alert("Failed to start interview: " + err.message);
      }
    },
    [dispatch, ensureAudioContext, startMicStreaming, joinLiveKitRoom],
  );

  // ─── handleLiveKitToken ───────────────────────────────────────────────────
  const handleLiveKitToken = useCallback(
    async ({ token, url }) => {
      console.log("🔑 [TOKEN] handleLiveKitToken CALLED ✅");
      console.log("  url:", url);
      console.log("  token type:", typeof token);
      console.log("  token (first 30):", token?.slice?.(0, 30));
      console.log("  token starts with ey:", token?.startsWith?.("ey"));
      console.log("  token length:", token?.length);

      try {
        const resolvedToken = await Promise.resolve(token);
        console.log("  resolvedToken type:", typeof resolvedToken);
        console.log(
          "  resolvedToken valid:",
          typeof resolvedToken === "string" && resolvedToken.startsWith("ey"),
        );

        if (
          typeof resolvedToken !== "string" ||
          !resolvedToken.startsWith("ey")
        ) {
          console.error("❌ [TOKEN] Invalid LiveKit token received!");
          console.error("  type:", typeof resolvedToken);
          console.error(
            "  value (first 40):",
            String(resolvedToken).slice(0, 40),
          );
          return;
        }

        livekitTokenRef.current = resolvedToken;
        livekitUrlRef.current = url;
        console.log(
          "✅ [TOKEN] Token stored, checking if we should join room...",
        );
        console.log("  room already exists:", !!livekitRoomRef.current);
        console.log("  join in progress:", !!lkJoinPromiseRef.current);

        if (!livekitRoomRef.current && !lkJoinPromiseRef.current) {
          console.log("🔌 [TOKEN] Calling joinLiveKitRoom...");
          joinLiveKitRoom(url, resolvedToken).catch((err) => {
            console.error("❌ [TOKEN] joinLiveKitRoom failed:", err.message);
            console.error("  Full error:", err);
          });
        } else {
          console.log(
            "ℹ️ [TOKEN] Skipping joinLiveKitRoom — already connected or connecting",
          );
        }
      } catch (err) {
        console.error("❌ [TOKEN] handleLiveKitToken FAILED:", err.message);
        console.error("  Full error:", err);
      }
    },
    [joinLiveKitRoom],
  );

  // ─── enableListening / disableListening ──────────────────────────────────
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

  // ─── cleanup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      console.log("🧹 [CLEANUP] useInterview unmounting...");
      resetTTS();
      if (livekitRoomRef.current) {
        console.log("🧹 [CLEANUP] Disconnecting LiveKit room");
        try {
          livekitRoomRef.current.disconnect();
        } catch (err) {
          console.error("❌ [CLEANUP] room.disconnect error:", err.message);
        }
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
    enableListening: enableListeningImmediate,
    disableListening: disableListeningImmediate,
    setMicStreamingActive: (v) => dispatch(setMicStreamingActive(v)),
    initializeInterview: (d) => dispatch(initializeInterview(d)),
  };
};
