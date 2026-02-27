import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_WS_URL;
const HOLISTIC_FPS = 2;

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// ══════════════════════════════════════════════════════════════════════════════
// WebRTCInterviewClient
// Replaces InterviewClient (LiveKit) with raw WebRTC peer connections.
// Desktop ↔ Server signaling via Socket.IO.
// Secondary mobile camera uses a separate peer connection.
// ══════════════════════════════════════════════════════════════════════════════
export class WebRTCInterviewClient {
  constructor(opts) {
    this.interviewId = opts.interviewId;
    this.userId = opts.userId;
    this.cb = opts.callbacks || {};

    this.socket = null;

    // Primary peer connection (desktop → server)
    this.pc = null;
    this.localCameraTrack = null;
    this.localMicTrack = null;
    this.localScreenTrack = null;

    // Secondary peer connection (mobile camera → server, received here)
    this.mobilePc = null;

    // TTS
    this._audioContext = null;
    this._ttsQueue = [];
    this._ttsPlaying = false;

    // Holistic
    this._holisticCanvas = null;
    this._holisticCtx = null;
    this._holisticTimer = null;
    this._videoElement = null;
    this._holistic = null;

    this.isListening = false;
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  async connect() {
    await this._connectSocket();
  }

  async _connectSocket() {
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

    // ── WebRTC signaling ────────────────────────────────────────────────────
    this.socket.on("webrtc_answer", async ({ answer }) => {
      if (!this.pc) return;
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("✅ Remote description set");
      } catch (e) {
        console.error("❌ setRemoteDescription:", e.message);
      }
    });

    this.socket.on("webrtc_ice_candidate", async ({ candidate }) => {
      if (!this.pc || !candidate) return;
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("⚠️ addIceCandidate:", e.message);
      }
    });

    // Mobile secondary camera WebRTC
    this.socket.on("mobile_webrtc_offer", async ({ offer, identity }) => {
      console.log("📱 Received mobile WebRTC offer from:", identity);
      await this._handleMobileOffer(offer, identity);
    });

    this.socket.on("mobile_webrtc_ice_candidate", async ({ candidate }) => {
      if (!this.mobilePc || !candidate) return;
      try {
        await this.mobilePc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (_) {}
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

    this.socket.on("secondary_camera_ready", (d) =>
      this._cb("onSecondaryCameraStatus", { connected: true, ...d }),
    );
    this.socket.on("secondary_camera_status", (d) =>
      this._cb("onSecondaryCameraStatus", d),
    );
    this.socket.on("mobile_camera_frame", (d) =>
      this._cb("onMobileFrame", d.frame),
    );

    this.socket.on("tts_audio", (d) => this._enqueueTTSChunk(d.audio));
    this.socket.on("tts_end", () => this._flushTTSQueue());
  }

  // ── Primary WebRTC peer connection ─────────────────────────────────────────

  async publishCamera(videoEl = null) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      this.localCameraTrack = stream.getVideoTracks()[0];

      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.muted = true;
        videoEl.play().catch(() => {});
      }

      this._videoElement = videoEl || this._createHiddenVideo(stream);
      this._startHolisticDetection();

      await this._ensurePeerConnection();
      this.pc.addTrack(this.localCameraTrack, stream);
      await this._negotiatePeerConnection();

      console.log("📷 Camera published via WebRTC");
    } catch (err) {
      console.error("❌ publishCamera:", err);
      this._cb("onError", {
        message: "Camera access failed",
        error: err.message,
      });
    }
  }

  async publishMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      });

      this.localMicTrack = stream.getAudioTracks()[0];

      await this._ensurePeerConnection();
      this.pc.addTrack(this.localMicTrack, stream);
      // Re-negotiate if pc already has an offer/answer
      if (this.pc.signalingState !== "stable") return;
      await this._negotiatePeerConnection();

      console.log("🎤 Microphone published via WebRTC");
    } catch (err) {
      console.error("❌ publishMicrophone:", err);
      this._cb("onError", {
        message: "Microphone access failed",
        error: err.message,
      });
    }
  }

  async startScreenShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
      });
      this.localScreenTrack = stream.getVideoTracks()[0];

      await this._ensurePeerConnection();
      this.pc.addTrack(this.localScreenTrack, stream);
      await this._negotiatePeerConnection();

      this.localScreenTrack.onended = () => {
        this.stopScreenShare();
      };

      this.socket.emit("webrtc_track_published", {
        kind: "video",
        source: "screen_share",
      });

      console.log("🖥️ Screen share started via WebRTC");
      return stream;
    } catch (err) {
      console.error("❌ startScreenShare:", err);
      this._cb("onError", {
        message: "Screen share failed",
        error: err.message,
      });
      return null;
    }
  }

  async stopScreenShare() {
    if (!this.localScreenTrack) return;

    const sender = this.pc
      ?.getSenders()
      .find((s) => s.track === this.localScreenTrack);
    if (sender) {
      try {
        this.pc.removeTrack(sender);
      } catch (_) {}
    }

    this.localScreenTrack.stop();
    this.localScreenTrack = null;

    this.socket.emit("webrtc_track_unpublished", { source: "screen_share" });
    await this._negotiatePeerConnection();
    console.log("🖥️ Screen share stopped");
  }

  async _ensurePeerConnection() {
    if (
      this.pc &&
      this.pc.connectionState !== "closed" &&
      this.pc.connectionState !== "failed"
    ) {
      return;
    }

    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate && this.socket?.connected) {
        this.socket.emit("webrtc_ice_candidate", { candidate });
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log("🔗 WebRTC connection state:", this.pc.connectionState);
      if (this.pc.connectionState === "connected") {
        this.socket.emit("webrtc_connected", {
          interviewId: this.interviewId,
          userId: this.userId,
        });
      }
    };

    this.pc.ontrack = (event) => {
      if (event.track.kind === "audio") {
        const el = document.createElement("audio");
        el.autoplay = true;
        el.style.display = "none";
        el.srcObject = new MediaStream([event.track]);
        document.body.appendChild(el);
      }
    };
  }

  async _negotiatePeerConnection() {
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      this.socket.emit("webrtc_offer", {
        offer: this.pc.localDescription,
        interviewId: this.interviewId,
        userId: this.userId,
      });
    } catch (err) {
      console.error("❌ WebRTC negotiation failed:", err.message);
    }
  }

  // ── Mobile secondary camera WebRTC ─────────────────────────────────────────

  async _handleMobileOffer(offer, identity) {
    try {
      if (this.mobilePc) {
        try {
          this.mobilePc.close();
        } catch (_) {}
      }

      this.mobilePc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      this.mobilePc.onicecandidate = ({ candidate }) => {
        if (candidate && this.socket?.connected) {
          this.socket.emit("mobile_webrtc_ice_candidate_desktop", {
            candidate,
            identity,
          });
        }
      };

      this.mobilePc.ontrack = (event) => {
        if (event.track.kind !== "video") return;

        const container = document.getElementById("secondary-camera-container");
        if (!container) {
          console.warn("⚠️ secondary-camera-container not found");
          return;
        }

        const videoEl = document.createElement("video");
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.muted = true;
        videoEl.style.width = "100%";
        videoEl.style.height = "100%";
        videoEl.srcObject = new MediaStream([event.track]);

        container.innerHTML = "";
        container.appendChild(videoEl);
        videoEl.play().catch(() => {});

        this._cb("onSecondaryCameraStatus", { connected: true, identity });
      };

      this.mobilePc.onconnectionstatechange = () => {
        if (
          this.mobilePc.connectionState === "disconnected" ||
          this.mobilePc.connectionState === "failed" ||
          this.mobilePc.connectionState === "closed"
        ) {
          this._cb("onSecondaryCameraStatus", { connected: false });
        }
      };

      await this.mobilePc.setRemoteDescription(
        new RTCSessionDescription(offer),
      );
      const answer = await this.mobilePc.createAnswer();
      await this.mobilePc.setLocalDescription(answer);

      this.socket.emit("mobile_webrtc_answer", {
        answer: this.mobilePc.localDescription,
        identity,
      });
    } catch (err) {
      console.error("❌ _handleMobileOffer:", err.message);
    }
  }

  // ── Socket-based audio for STT ─────────────────────────────────────────────
  // Server reads PCM from socket (same as before, unchanged path)

  startSocketAudioFallback(micStreamOrTrack) {
    if (!micStreamOrTrack) return;
    const stream =
      micStreamOrTrack instanceof MediaStreamTrack
        ? new MediaStream([micStreamOrTrack])
        : micStreamOrTrack;

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
  }

  // ── TTS ────────────────────────────────────────────────────────────────────

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
      this._playNextTTSChunk();
    }
  }

  _flushTTSQueue() {
    const checkDone = setInterval(() => {
      if (this._ttsQueue.length === 0 && !this._ttsPlaying) {
        clearInterval(checkDone);
        this._cb("onTTSEnd");
      }
    }, 100);
  }

  // ── Holistic face detection ────────────────────────────────────────────────

  _createHiddenVideo(stream) {
    const v = document.createElement("video");
    v.autoplay = true;
    v.playsInline = true;
    v.muted = true;
    v.style.display = "none";
    v.srcObject = stream;
    document.body.appendChild(v);
    return v;
  }

  async _startHolisticDetection() {
    if (!window.Holistic) {
      console.warn(
        "⚠️ MediaPipe Holistic not loaded — face detection disabled",
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
    console.log(`👁️ Holistic detection started (${HOLISTIC_FPS} fps)`);
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
    this.socket.emit("holistic_detection_result", {
      hasFace: !!results.faceLandmarks,
      hasPose: !!results.poseLandmarks,
      hasLeftHand: !!results.leftHandLandmarks,
      hasRightHand: !!results.rightHandLandmarks,
      faceCount: results.faceLandmarks ? 1 : 0,
      timestamp: Date.now(),
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  enterSetupMode() {
    this.socket.emit("setup_mode", {});
  }

  startInterview() {
    this.socket.emit("client_ready", {});
  }

  _onServerReady(data) {
    console.log("✅ Server ready:", data);
    if (data.setupMode) this.enterSetupMode();
  }

  async disconnect() {
    if (this._holisticTimer) {
      clearInterval(this._holisticTimer);
      this._holisticTimer = null;
    }
    if (this._holistic) {
      await this._holistic.close();
      this._holistic = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.mobilePc) {
      this.mobilePc.close();
      this.mobilePc = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this._audioContext) {
      await this._audioContext.close();
      this._audioContext = null;
    }
    if (this._audioCtxFallback) {
      await this._audioCtxFallback.close();
      this._audioCtxFallback = null;
    }
    console.log("🔌 WebRTCInterviewClient disconnected");
  }

  _cb(name, ...args) {
    if (typeof this.cb[name] === "function") this.cb[name](...args);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MobileWebRTCClient — secondary camera device
// Replaces MobileInterviewClient (LiveKit)
// ══════════════════════════════════════════════════════════════════════════════
export class MobileWebRTCClient {
  constructor({ interviewId, userId, socketUrl = SOCKET_URL, callbacks = {} }) {
    this.interviewId = interviewId;
    this.userId = userId;
    this.socketUrl = socketUrl;
    this.cb = callbacks;
    this.socket = null;
    this.pc = null;
    this.localCameraStream = null;
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

    this.socket.on("connect", async () => {
      console.log("📱 Mobile socket connected");
      this.socket.emit("secondary_camera_connected", {
        interviewId: this.interviewId,
        timestamp: Date.now(),
        angle: "side",
        angleQuality: "good",
      });
      // Start WebRTC after socket is connected
      await this._startWebRTC();
    });

    // Server relays ICE candidates from the desktop
    this.socket.on(
      "mobile_webrtc_ice_candidate_from_desktop",
      async ({ candidate }) => {
        if (!this.pc || !candidate) return;
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (_) {}
      },
    );
  }

  async _startWebRTC() {
    try {
      this.localCameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      this.localCameraStream.getVideoTracks().forEach((track) => {
        this.pc.addTrack(track, this.localCameraStream);
      });

      this.pc.onicecandidate = ({ candidate }) => {
        if (candidate && this.socket?.connected) {
          this.socket.emit("mobile_webrtc_ice_candidate", { candidate });
        }
      };

      this.pc.onconnectionstatechange = () => {
        console.log("📱 Mobile WebRTC state:", this.pc.connectionState);
      };

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // Send offer to server; server relays to desktop
      this.socket.emit("mobile_webrtc_offer", {
        offer: this.pc.localDescription,
        identity: `mobile_${this.userId}`,
      });

      // Server relays desktop answer back
      this.socket.once(
        "mobile_webrtc_answer_from_server",
        async ({ answer }) => {
          try {
            await this.pc.setRemoteDescription(
              new RTCSessionDescription(answer),
            );
            console.log("📱 Mobile WebRTC answer set");
          } catch (e) {
            console.error("❌ mobile setRemoteDescription:", e.message);
          }
        },
      );

      // Low-res preview frames over socket (for setup UI only)
      this._startFrameRelay();

      console.log("📱 Mobile camera WebRTC offer sent");
    } catch (err) {
      console.error("❌ Mobile WebRTC start failed:", err.message);
    }
  }

  _startFrameRelay() {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = this.localCameraStream;

    this._frameTimer = setInterval(() => {
      if (video.readyState < 2) return;
      ctx.drawImage(video, 0, 0, 320, 240);
      const frame = canvas.toDataURL("image/jpeg", 0.5).split(",")[1];
      this.socket.emit("mobile_camera_frame", { frame, timestamp: Date.now() });
    }, 500);
  }

  async disconnect() {
    if (this._frameTimer) {
      clearInterval(this._frameTimer);
      this._frameTimer = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.localCameraStream) {
      this.localCameraStream.getTracks().forEach((t) => t.stop());
      this.localCameraStream = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
