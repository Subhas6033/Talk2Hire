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
import { useTTS } from "./useSpeechHook";

const MIC_SAMPLE_RATE = 48000;

// Convert Float32 audio samples to PCM16 for Deepgram
function toPCM16(input) {
  const pcm16 = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

// Simple RMS — used only to detect a completely dead/disconnected mic
function getRMS(input) {
  let sum = 0;
  for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
  return Math.sqrt(sum / input.length);
}

export const useInterview = (interviewId, userId, cameraStream) => {
  const dispatch = useDispatch();
  const interview = useSelector((s) => s.interview);

  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioCtxInitRef = useRef(false);
  const recordingTimerRef = useRef(null);
  const audioChunkCountRef = useRef(0);

  const audioRecording = useAudioRecording(socketRef, interviewId, userId);

  const pcRef = useRef(null);
  const localMicTrackRef = useRef(null);
  const localCameraTrackRef = useRef(null);
  const micProcessorRef = useRef(null);
  const micStreamRef = useRef(null);
  const remoteDescriptionSetRef = useRef(false);

  // Refs that mirror Redux state for use inside onaudioprocess
  const isListeningRef = useRef(false);
  const canListenRef = useRef(false);
  const hasStartedRef = useRef(false);
  const serverReadyRef = useRef(false);
  const micStreamingActiveRef = useRef(false);

  // Keep refs in sync with Redux state
  useEffect(() => {
    isListeningRef.current = interview.isListening;
    canListenRef.current = interview.canListen;
    serverReadyRef.current = interview.serverReady;
    micStreamingActiveRef.current = interview.micStreamingActive;
  }, [interview]);

  // Recording duration timer
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

  // ── AudioContext ─────────────────────────────────────────────────────────
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

  // ── TTS ──────────────────────────────────────────────────────────────────
  const {
    enqueueTTSChunk,
    flushTTS,
    resetTTS,
    getStats: getTTSStats,
  } = useTTS({
    onPlayStart: () => {
      console.log("🔊 TTS playback started");
      dispatch(setIsPlaying(true));
      dispatch(disableListening());
      // Sync refs immediately — don't wait for the useEffect re-render cycle
      isListeningRef.current = false;
      canListenRef.current = false;
    },
    onPlayEnd: () => {
      console.log("🔊 TTS playback ended → opening mic");
      dispatch(setIsPlaying(false));
      // CRITICAL FIX: open the mic THE INSTANT audio finishes — no server
      // round-trip, no render cycle, no Redux async flush.
      // The server's STT gate opened ~80ms after TTS stream ended (pre-warm),
      // which is always well before audio finishes playing on the client, so
      // audio chunks sent now go straight into a ready Deepgram connection.
      isListeningRef.current = true;
      canListenRef.current = true;
      dispatch(enableListening());
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
      if (base64?.length) {
        console.log(`🔊 Received TTS chunk (${base64.length} chars)`);
        enqueueTTSChunk(base64);
      }
    },
    [enqueueTTSChunk],
  );

  const handleTtsEnd = useCallback(
    (onDone) => {
      console.log("🔊 TTS stream ended");
      dispatch(setTtsStreamActive(false));
      flushTTS(onDone);
    },
    [dispatch, flushTTS],
  );

  // ── Interview event handlers ──────────────────────────────────────────────
  const handleQuestion = useCallback(
    (payload) => {
      const text =
        typeof payload === "string" ? payload : payload?.question || "";
      console.log(`❓ Question received: "${text.substring(0, 50)}..."`);
      resetTTS();
      dispatch(setCurrentQuestion(text));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
    },
    [dispatch, resetTTS],
  );

  const handleNextQuestion = useCallback(
    (payload) => {
      console.log(
        `❓ Next question: "${payload?.question?.substring(0, 50)}..."`,
      );
      resetTTS();
      dispatch(receiveNextQuestion(payload));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
    },
    [dispatch, resetTTS],
  );

  const handleIdlePrompt = useCallback(
    ({ text }) => {
      console.log(`⏱️ Idle prompt: "${text}"`);
      resetTTS();
      dispatch(setIdlePrompt(text));
      dispatch(setTtsStreamActive(true));
      dispatch(disableListening());
    },
    [dispatch, resetTTS],
  );

  const handleTranscriptReceived = useCallback(
    ({ text }) => {
      console.log(`📝 Final transcript: "${text.substring(0, 50)}..."`);
      dispatch(setUserText(text));
      dispatch(disableListening());
    },
    [dispatch],
  );

  const handleInterviewComplete = useCallback(
    (data) => {
      console.log("✅ Interview complete");
      dispatch(completeInterview({ totalQuestions: data.totalQuestions }));
      dispatch(setMicStreamingActive(false));
    },
    [dispatch],
  );

  const handleInterimTranscript = useCallback(
    (data) => {
      if (data.text?.trim()) {
        console.log(`📝 Interim: "${data.text}"`);
        dispatch(setUserText(data.text));
      }
    },
    [dispatch],
  );

  // ── WebRTC ────────────────────────────────────────────────────────────────
  const setupWebRTCPeerConnection = useCallback(() => {
    const existingPc = pcRef.current;
    if (
      existingPc &&
      existingPc.connectionState !== "closed" &&
      existingPc.connectionState !== "failed" &&
      existingPc.signalingState !== "closed"
    ) {
      return existingPc;
    }
    if (existingPc) {
      try {
        existingPc.close();
      } catch (_) {}
      pcRef.current = null;
    }

    const ICE_SERVERS = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];

    if (import.meta.env?.VITE_TURN_URL) {
      ICE_SERVERS.push({
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME || "",
        credential: import.meta.env.VITE_TURN_CREDENTIAL || "",
      });
      console.log(
        "[WebRTC] TURN server configured:",
        import.meta.env.VITE_TURN_URL,
      );
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    remoteDescriptionSetRef.current = false;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        if (socketRef.current?.connected) {
          socketRef.current.emit("webrtc_ice_candidate", { candidate });
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        console.error("[WebRTC] ICE failed — attempting restart");
        pc.restartIce?.();
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit("webrtc_offer", {
          offer: pc.localDescription,
          interviewId,
          userId,
        });
      } catch (err) {
        console.error("[WebRTC] onnegotiationneeded error:", err.message);
      }
    };

    pc.ontrack = (event) => {
      if (event.track.kind === "audio") {
        const el = document.createElement("audio");
        el.autoplay = true;
        el.style.display = "none";
        el.srcObject = new MediaStream([event.track]);
        document.body.appendChild(el);
      }
    };

    return pc;
  }, [interviewId, userId]);

  const publishCameraToWebRTC = useCallback(
    (camStream) => {
      if (!camStream) return;
      const videoTrack = camStream.getVideoTracks()[0];
      if (!videoTrack) {
        console.error("[CAM] No video track found in cameraStream");
        return;
      }
      if (localCameraTrackRef.current) {
        return;
      }
      const pc = setupWebRTCPeerConnection();
      localCameraTrackRef.current = videoTrack;
      pc.addTrack(videoTrack, camStream);
      console.log("[WebRTC] Camera track added");
    },
    [setupWebRTCPeerConnection],
  );

  const publishMicToWebRTC = useCallback(
    async (micStreamOrTrack) => {
      const pc = setupWebRTCPeerConnection();
      const track =
        micStreamOrTrack instanceof MediaStreamTrack
          ? micStreamOrTrack
          : micStreamOrTrack?.getAudioTracks()[0];
      if (!track) {
        console.error("[MIC] No audio track to publish");
        return;
      }
      localMicTrackRef.current = track;
      const stream =
        micStreamOrTrack instanceof MediaStreamTrack
          ? new MediaStream([track])
          : micStreamOrTrack;
      pc.addTrack(track, stream);
      console.log("[WebRTC] Mic track added");
    },
    [setupWebRTCPeerConnection],
  );

  // ── Mic streaming ─────────────────────────────────────────────────────────
  const startMicStreaming = useCallback(
    async (existingStream = null) => {
      if (localMicTrackRef.current) {
        console.log("[MIC] Already streaming");
        return;
      }
      try {
        let stream = existingStream;
        if (!stream) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: MIC_SAMPLE_RATE,
            },
          });
        }
        micStreamRef.current = stream;

        dispatch(setMicPermissionGranted(true));

        if (cameraStream) publishCameraToWebRTC(cameraStream);

        await publishMicToWebRTC(stream);

        const ctx = await ensureAudioContext();

        // ── AudioWorklet mic processor ────────────────────────────────────
        // Runs on a dedicated audio thread — never blocked by React renders,
        // TTS decode, or any main-thread work. Fixed 256-sample buffer gives
        // ~5ms latency vs up to 170ms jitter with ScriptProcessorNode.
        const workletCode = `
          class MicProcessor extends AudioWorkletProcessor {
            constructor() {
              super();
              this._buf = [];
              this._TARGET = 256;
            }
            process(inputs) {
              const ch = inputs[0]?.[0];
              if (!ch) return true;
              for (let i = 0; i < ch.length; i++) this._buf.push(ch[i]);
              while (this._buf.length >= this._TARGET) {
                const frame = new Float32Array(this._buf.splice(0, this._TARGET));
                this.port.postMessage(frame, [frame.buffer]);
              }
              return true;
            }
          }
          registerProcessor('mic-processor', MicProcessor);
        `;
        const blob = new Blob([workletCode], {
          type: "application/javascript",
        });
        const blobURL = URL.createObjectURL(blob);
        await ctx.audioWorklet.addModule(blobURL);
        URL.revokeObjectURL(blobURL);

        const source = ctx.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(ctx, "mic-processor");
        micProcessorRef.current = workletNode;

        workletNode.port.onmessage = (e) => {
          if (!micStreamingActiveRef.current) return;
          if (!isListeningRef.current) return;
          if (!canListenRef.current) return;
          if (!socketRef.current?.connected) return;

          const input = e.data; // Float32Array, 256 samples

          // Skip dead-mic frames
          if (getRMS(input) < 0.0001) return;

          socketRef.current.emit("user_audio_chunk", toPCM16(input).buffer);

          audioChunkCountRef.current++;
          if (audioChunkCountRef.current % 100 === 0) {
            console.log(`🎤 Sent ${audioChunkCountRef.current} audio chunks`);
          }
        };

        // Connect source → worklet (NOT to destination — avoids mic echo)
        source.connect(workletNode);
        // ─────────────────────────────────────────────────────────────────

        if (audioRecording.connectMicrophoneAudio) {
          await audioRecording.connectMicrophoneAudio(stream);
        }

        dispatch(setMicStreamingActive(true));
        console.log("[MIC] Streaming active at", ctx.sampleRate + "Hz");
      } catch (err) {
        console.error("[MIC] startMicStreaming failed:", err.message);
      }
    },
    [
      audioRecording,
      cameraStream,
      dispatch,
      ensureAudioContext,
      publishCameraToWebRTC,
      publishMicToWebRTC,
    ],
  );

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
        console.log("[START] Interview started");
      } catch (err) {
        console.error("[START] autoStartInterview failed:", err.message);
        hasStartedRef.current = false;
        dispatch(setHasStarted(false));
      }
    },
    [dispatch, ensureAudioContext, startMicStreaming],
  );

  // ── WebRTC answer / ICE ───────────────────────────────────────────────────
  const handleWebRTCAnswer = useCallback(async ({ answer }) => {
    if (!pcRef.current) return;
    if (remoteDescriptionSetRef.current) {
      return;
    }
    if (pcRef.current.signalingState !== "have-local-offer") {
      return;
    }
    try {
      remoteDescriptionSetRef.current = true;
      await pcRef.current.setRemoteDescription(
        new RTCSessionDescription(answer),
      );
      console.log("[WebRTC] Remote description set");
    } catch (err) {
      remoteDescriptionSetRef.current = false;
      console.error("[WebRTC] setRemoteDescription failed:", err.message);
    }
  }, []);

  const handleWebRTCIceCandidate = useCallback(async ({ candidate }) => {
    if (!pcRef.current || !candidate) return;
    try {
      await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn("[WebRTC] addIceCandidate:", err.message);
    }
  }, []);

  // ── Listening enable / disable ────────────────────────────────────────────
  const enableListeningImmediate = useCallback(() => {
    isListeningRef.current = true;
    canListenRef.current = true;
    console.log("[MIC] Listening enabled");
    dispatch(enableListening());
  }, [dispatch]);

  const disableListeningImmediate = useCallback(() => {
    isListeningRef.current = false;
    canListenRef.current = false;
    console.log("[MIC] Listening disabled");
    dispatch(disableListening());
  }, [dispatch]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanupWebRTC = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (micProcessorRef.current) {
      try {
        micProcessorRef.current.port.onmessage = null; // stop message handler
        micProcessorRef.current.disconnect();
      } catch (_) {}
      micProcessorRef.current = null;
    }
    localMicTrackRef.current = null;
    localCameraTrackRef.current = null;
    remoteDescriptionSetRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      resetTTS();
      cleanupWebRTC();
    };
  }, [resetTTS, cleanupWebRTC]);

  // Log TTS stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (getTTSStats) {
        const stats = getTTSStats();
        if (stats.isPlaying || stats.queueLength > 0) {
          console.log("📊 TTS Stats:", stats);
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [getTTSStats]);

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    ...interview,
    socketRef,
    audioCtxRef,
    micStreamRef,
    pcRef,
    handleWebRTCAnswer,
    handleWebRTCIceCandidate,
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
    cleanupWebRTC,
  };
};
