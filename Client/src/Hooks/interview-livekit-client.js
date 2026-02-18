import {
  Room,
  RoomEvent,
  Track,
  LocalParticipant,
  createLocalVideoTrack,
  createLocalAudioTrack,
  createLocalScreenTracks,
  VideoPresets,
  AudioPresets,
} from "livekit-client";

// ─── Configuration ─────────────────────────────────────────────────────────
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;
const HOLISTIC_FPS = 2; // How often to run face detection (frames / second)

// ══════════════════════════════════════════════════════════════════════════════
// InterviewClient
// ══════════════════
export class InterviewClient {
  /**
   * @param {object} opts
   * @param {string} opts.interviewId
   * @param {string} opts.userId
   * @param {string} opts.socketUrl        defaults to SOCKET_URL
   * @param {object} opts.callbacks        UI callbacks
   * @param {Function} opts.callbacks.onQuestion
   * @param {Function} opts.callbacks.onListeningEnabled
   * @param {Function} opts.callbacks.onListeningDisabled
   * @param {Function} opts.callbacks.onTranscript
   * @param {Function} opts.callbacks.onInterimTranscript
   * @param {Function} opts.callbacks.onTTSChunk       (base64 audio string)
   * @param {Function} opts.callbacks.onTTSEnd
   * @param {Function} opts.callbacks.onFaceViolation
   * @param {Function} opts.callbacks.onInterviewComplete
   * @param {Function} opts.callbacks.onEvaluationComplete
   * @param {Function} opts.callbacks.onError
   * @param {Function} opts.callbacks.onSecondaryCameraStatus
   * @param {Function} opts.callbacks.onMobileFrame     (base64 JPEG frame)
   */
  constructor(opts) {
    this.interviewId = opts.interviewId;
    this.userId = opts.userId;
    this.cb = opts.callbacks || {};

    this.socket = null;
    this.room = null; // LiveKit Room
    this.livekitUrl = null;
    this.livekitToken = null;

    // Media tracks
    this.localCamera = null; // LocalVideoTrack (primary webcam)
    this.localMic = null; // LocalAudioTrack
    this.localScreen = null; // LocalVideoTrack (screen share)

    // TTS
    this._audioContext = null;
    this._ttsQueue = [];
    this._ttsPlaying = false;

    // Holistic
    this._holisticCanvas = null;
    this._holisticCtx = null;
    this._holisticTimer = null;
    this._videoElement = null;
    this._holistic = null; // MediaPipe Holistic instance

    // State
    this.isSetupMode = true;
    this.isListening = false;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Bootstrap
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Connect the Socket.IO control-plane and wait for the LiveKit token.
   */
  async connect() {
    await this._connectSocket();
  }

  async _connectSocket() {
    const { io } = await import("socket.io-client");
    this.socket = io(SOCKET_URL, {
      query: {
        interviewId: this.interviewId,
        userId: this.userId,
        type: "interview",
      },
      transports: ["websocket"],
    });

    this.socket.on("connect", () =>
      console.log("🔌 Socket connected:", this.socket.id),
    );
    this.socket.on("disconnect", (r) =>
      console.warn("🔌 Socket disconnected:", r),
    );
    this.socket.on("error", (e) => this._cb("onError", e));

    // ── LiveKit token → join room ────────────────────────────────────────────
    this.socket.on("livekit_token", async ({ token, url }) => {
      this.livekitToken = token;
      this.livekitUrl = url;
      await this._joinLiveKitRoom();
    });

    // ── Interview control events ────────────────────────────────────────────
    this.socket.on("server_ready", (d) => this._onServerReady(d));
    this.socket.on("question", (d) => this._cb("onQuestion", d.question));
    this.socket.on("next_question", (d) => this._cb("onQuestion", d.question));
    this.socket.on("listening_enabled", () => {
      this.isListening = true;
      this._cb("onListeningEnabled");
    });
    this.socket.on("listening_disabled", () => {
      this.isListening = false;
      this._cb("onListeningDisabled");
    });
    this.socket.on("transcript_received", (d) =>
      this._cb("onTranscript", d.text),
    );
    this.socket.on("interim_transcript", (d) =>
      this._cb("onInterimTranscript", d.text),
    );
    this.socket.on("idle_prompt", (d) => this._cb("onQuestion", d.text));
    this.socket.on("face_violation", (d) => this._cb("onFaceViolation", d));
    this.socket.on("face_violation_cleared", () =>
      this._cb("onFaceViolation", null),
    );
    this.socket.on("interview_terminated", (d) => this._cb("onError", d));
    this.socket.on("interview_complete", (d) =>
      this._cb("onInterviewComplete", d),
    );
    this.socket.on("evaluation_complete", (d) =>
      this._cb("onEvaluationComplete", d),
    );
    this.socket.on("evaluation_error", (d) => this._cb("onError", d));
    this.socket.on("media_merge_complete", (d) => this._cb("onMediaReady", d));

    // ── Secondary camera ────────────────────────────────────────────────────
    this.socket.on("secondary_camera_ready", (d) =>
      this._cb("onSecondaryCameraStatus", { connected: true, ...d }),
    );
    this.socket.on("secondary_camera_status", (d) =>
      this._cb("onSecondaryCameraStatus", d),
    );
    this.socket.on("mobile_camera_frame", (d) =>
      this._cb("onMobileFrame", d.frame),
    );

    // ── TTS (audio comes over socket – played via WebAudio) ─────────────────
    this.socket.on("tts_audio", (d) => this._enqueueTTSChunk(d.audio));
    this.socket.on("tts_end", () => this._flushTTSQueue());
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LiveKit room
  // ══════════════════════════════════════════════════════════════════════════

  async _joinLiveKitRoom() {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this._bindRoomEvents();

    await this.room.connect(this.livekitUrl, this.livekitToken);
    console.log(" Joined LiveKit room:", this.room.name);

    // Publish camera + mic automatically
    await this.publishCamera();
    await this.publishMicrophone();
  }

  _bindRoomEvents() {
    const room = this.room;

    room.on(RoomEvent.Connected, () =>
      console.log("🏠 LiveKit room connected"),
    );
    room.on(RoomEvent.Disconnected, () =>
      console.warn("🏠 LiveKit room disconnected"),
    );
    room.on(RoomEvent.Reconnecting, () =>
      console.log("🔄 LiveKit reconnecting…"),
    );
    room.on(RoomEvent.Reconnected, () => console.log(" LiveKit reconnected"));

    // Notify server when local tracks go live/offline
    room.on(RoomEvent.LocalTrackPublished, (pub) => {
      console.log(`📡 Local track published: ${pub.source} (${pub.kind})`);
      this.socket.emit("livekit_track_published", {
        kind: pub.kind,
        source: pub.source,
        trackSid: pub.trackSid,
      });
    });

    room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
      console.log(`📡 Local track unpublished: ${pub.source}`);
      this.socket.emit("livekit_track_unpublished", {
        source: pub.source,
        trackSid: pub.trackSid,
      });
    });

    // Participant events (mobile camera)
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log(`👤 Participant joined: ${participant.identity}`);
      this.socket.emit("livekit_participant_joined", {
        identity: participant.identity,
      });
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log(`👤 Participant left: ${participant.identity}`);
      this.socket.emit("livekit_participant_left", {
        identity: participant.identity,
      });
    });

    // Render remote tracks (e.g. the TTS audio track from the interviewer bot)
    room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      console.log(`🎧 Subscribed: ${participant.identity} / ${pub.source}`);
      if (track.kind === Track.Kind.Audio) {
        // Attach to a hidden <audio> element so the browser plays it
        const el = track.attach();
        el.style.display = "none";
        document.body.appendChild(el);
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Media helpers
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Publish the primary webcam.
   * @param {HTMLVideoElement} [videoEl]  Optional element to mirror the track into.
   */
  async publishCamera(videoEl = null) {
    try {
      this.localCamera = await createLocalVideoTrack({
        resolution: VideoPresets.h720.resolution,
        facingMode: "user",
      });
      await this.room.localParticipant.publishTrack(this.localCamera);
      if (videoEl) this.localCamera.attach(videoEl);
      this._videoElement = videoEl || this._createHiddenVideo();
      this.localCamera.attach(this._videoElement);
      this._startHolisticDetection();
      console.log("📷 Camera published");
    } catch (err) {
      console.error("❌ publishCamera:", err);
      this._cb("onError", {
        message: "Camera access failed",
        error: err.message,
      });
    }
  }

  /**
   * Publish the microphone.
   * In LiveKit-agent mode the agent subscribes to this track for STT.
   * In fallback mode the browser captures PCM here and sends it via socket.
   */
  async publishMicrophone() {
    try {
      this.localMic = await createLocalAudioTrack({
        ...AudioPresets.music,
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      });
      await this.room.localParticipant.publishTrack(this.localMic);
      console.log("🎤 Microphone published");
      // If no LiveKit agent handles STT, set up the socket-based fallback:
      // this._startSocketAudioFallback();
    } catch (err) {
      console.error("❌ publishMicrophone:", err);
      this._cb("onError", {
        message: "Microphone access failed",
        error: err.message,
      });
    }
  }

  /**
   * Start screen-share.
   * Emits "livekit_track_published" automatically via _bindRoomEvents().
   */
  async startScreenShare() {
    try {
      const [screenTrack] = await createLocalScreenTracks({ audio: true });
      this.localScreen = screenTrack;
      await this.room.localParticipant.publishTrack(screenTrack);
      console.log("🖥️  Screen share started");
      return screenTrack;
    } catch (err) {
      console.error("❌ startScreenShare:", err);
      this._cb("onError", {
        message: "Screen share failed",
        error: err.message,
      });
      return null;
    }
  }

  /** Stop screen-share. */
  async stopScreenShare() {
    if (!this.localScreen) return;
    await this.room.localParticipant.unpublishTrack(this.localScreen);
    this.localScreen.stop();
    this.localScreen = null;
    console.log("🖥️  Screen share stopped");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Socket-based audio fallback (for when no LiveKit agent is running)
  // The browser captures raw PCM from the mic and sends it to the server.
  // ══════════════════════════════════════════════════════════════════════════

  _startSocketAudioFallback() {
    if (!this.localMic) return;
    // Access the underlying MediaStream from the LiveKit track
    const stream = new MediaStream([this.localMic.mediaStreamTrack]);
    const ctx = new AudioContext({ sampleRate: 16000 });
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      if (!this.isListening) return;
      const pcm = e.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(pcm.length);
      for (let i = 0; i < pcm.length; i++)
        int16[i] = Math.max(-1, Math.min(1, pcm[i])) * 0x7fff;
      this.socket.emit("user_audio_chunk", int16.buffer);
    };

    source.connect(processor);
    processor.connect(ctx.destination);
    this._audioCtxFallback = ctx;
    console.log("🎙️  Socket audio fallback active");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TTS playback (Web Audio API)
  // ══════════════════════════════════════════════════════════════════════════

  _getAudioContext() {
    if (!this._audioContext || this._audioContext.state === "closed") {
      this._audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }
    return this._audioContext;
  }

  _enqueueTTSChunk(base64Audio) {
    this._ttsQueue.push(base64Audio);
    if (!this._ttsPlaying) this._playNextTTSChunk();
  }

  async _playNextTTSChunk() {
    if (this._ttsQueue.length === 0) {
      this._ttsPlaying = false;
      return;
    }
    this._ttsPlaying = true;

    const base64 = this._ttsQueue.shift();
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    try {
      const ctx = this._getAudioContext();
      const buffer = await ctx.decodeAudioData(bytes.buffer);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => this._playNextTTSChunk();
      source.start();
      this._cb("onTTSChunk", base64);
    } catch (err) {
      console.error("❌ TTS playback error:", err);
      this._playNextTTSChunk(); // skip bad chunk
    }
  }

  _flushTTSQueue() {
    // Let the queue drain naturally; signal UI that TTS is done
    const checkDone = setInterval(() => {
      if (this._ttsQueue.length === 0 && !this._ttsPlaying) {
        clearInterval(checkDone);
        this._cb("onTTSEnd");
      }
    }, 100);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Face detection (MediaPipe Holistic)
  // ══════════════════════════════════════════════════════════════════════════

  _createHiddenVideo() {
    const v = document.createElement("video");
    v.autoplay = true;
    v.playsInline = true;
    v.muted = true;
    v.style.display = "none";
    document.body.appendChild(v);
    return v;
  }

  /**
   * Call this once the local camera video element is available.
   * Requires @mediapipe/holistic to be loaded globally.
   */
  async _startHolisticDetection() {
    if (!window.Holistic) {
      console.warn(
        "⚠️  MediaPipe Holistic not loaded – face detection disabled",
      );
      return;
    }

    this._holisticCanvas = document.createElement("canvas");
    this._holisticCanvas.width = 320;
    this._holisticCanvas.height = 240;
    this._holisticCtx = this._holisticCanvas.getContext("2d");

    this._holistic = new window.Holistic({
      locateFile: (f) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}`,
    });
    this._holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      refineFaceLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    this._holistic.onResults((results) => this._onHolisticResults(results));
    await this._holistic.initialize();

    const intervalMs = Math.round(1000 / HOLISTIC_FPS);
    this._holisticTimer = setInterval(() => this._runHolistic(), intervalMs);
    console.log(`👁️  Holistic detection started (${HOLISTIC_FPS} fps)`);
  }

  async _runHolistic() {
    if (!this._videoElement || this._videoElement.readyState < 2) return;
    try {
      this._holisticCtx.drawImage(this._videoElement, 0, 0, 320, 240);
      await this._holistic.send({ image: this._holisticCanvas });
    } catch (err) {
      console.error("❌ Holistic send error:", err);
    }
  }

  _onHolisticResults(results) {
    const hasFace = !!results.faceLandmarks;
    const hasPose = !!results.poseLandmarks;
    const hasLeftHand = !!results.leftHandLandmarks;
    const hasRightHand = !!results.rightHandLandmarks;

    // Simple multi-face heuristic: if poseLandmarks contain 2 "nose" peaks
    // we can't detect it here easily, so faceCount = 1 when face present, else 0.
    // For true multi-face you'd need a separate face-detection model.
    const faceCount = hasFace ? 1 : 0;

    this.socket.emit("holistic_detection_result", {
      hasFace,
      hasPose,
      hasLeftHand,
      hasRightHand,
      faceCount,
      timestamp: Date.now(),
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Setup mode / interview lifecycle
  // ══════════════════════════════════════════════════════════════════════════

  enterSetupMode() {
    this.isSetupMode = true;
    this.socket.emit("setup_mode", {});
  }

  startInterview() {
    this.isSetupMode = false;
    this.socket.emit("client_ready", {});
  }

  _onServerReady(data) {
    console.log(" Server ready:", data);
    // Auto-enter setup mode on first connect
    if (data.setupMode) this.enterSetupMode();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Disconnect / cleanup
  // ══════════════════════════════════════════════════════════════════════════

  async disconnect() {
    if (this._holisticTimer) {
      clearInterval(this._holisticTimer);
      this._holisticTimer = null;
    }
    if (this._holistic) {
      await this._holistic.close();
      this._holistic = null;
    }
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this._audioContext) {
      await this._audioContext.close();
      this._audioContext = null;
    }
    console.log("🔌 InterviewClient disconnected");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Internal helper
  // ══════════════════════════════════════════════════════════════════════════
  _cb(name, ...args) {
    if (typeof this.cb[name] === "function") this.cb[name](...args);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MobileClient  (used on the secondary camera device – type=settings)
// ══════════════════════════════════════════════════════════════════════════════
export class MobileInterviewClient {
  constructor({ interviewId, userId, socketUrl = SOCKET_URL, callbacks = {} }) {
    this.interviewId = interviewId;
    this.userId = userId;
    this.socketUrl = socketUrl;
    this.cb = callbacks;
    this.socket = null;
    this.room = null;
    this.localCamera = null;
    this._frameTimer = null;
  }

  async connect() {
    const { io } = await import("socket.io-client");
    this.socket = io(this.socketUrl, {
      query: {
        interviewId: this.interviewId,
        userId: this.userId,
        type: "settings",
      },
      transports: ["websocket"],
    });

    this.socket.on("livekit_token", async ({ token, url }) => {
      await this._joinRoom(url, token);
    });

    this.socket.on("connect", () => {
      this.socket.emit("secondary_camera_connected", {
        interviewId: this.interviewId,
        timestamp: Date.now(),
        angle: "side",
        angleQuality: "good",
      });
    });

    this.socket.on("mobile_camera_frame_ack", () => {});
  }

  async _joinRoom(url, token) {
    this.room = new Room();
    await this.room.connect(url, token);
    this.localCamera = await createLocalVideoTrack({
      resolution: VideoPresets.h360.resolution,
      facingMode: "environment",
    });
    await this.room.localParticipant.publishTrack(this.localCamera);
    console.log("📱 Mobile camera published to LiveKit room");
    this._startFrameRelay();
  }

  /** Send low-res JPEG preview frames over Socket.IO for the setup grid */
  _startFrameRelay() {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = new MediaStream([this.localCamera.mediaStreamTrack]);

    this._frameTimer = setInterval(() => {
      if (video.readyState < 2) return;
      ctx.drawImage(video, 0, 0, 320, 240);
      const frame = canvas.toDataURL("image/jpeg", 0.5).split(",")[1];
      this.socket.emit("mobile_camera_frame", { frame, timestamp: Date.now() });
    }, 500); // 2 fps preview
  }

  async disconnect() {
    if (this._frameTimer) {
      clearInterval(this._frameTimer);
      this._frameTimer = null;
    }
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
