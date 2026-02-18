// ── Global stream store ───────────────────────────────────────────────────────
// Used as a module-level singleton so values survive React StrictMode's
// double-mount cycle without needing Context.
//
// LiveKit fields are included so InterviewSetup can hand a pre-connected Room
// to InterviewLive — eliminating the cold-join latency on interview start.

const streamStore = {
  // Media streams
  screenShareStream: null,
  micStream: null,
  primaryCameraStream: null,

  // Session / socket
  sessionData: null,
  preInitializedSocket: null,

  // ── LiveKit ─────────────────────────────────────────────────────────────────
  // Set by InterviewSetup once the Room is connected; read by useInterview.
  livekitRoom: null, // Room instance (already connected)
  livekitToken: null, // JWT (kept for reconnect)
  livekitUrl: null, // wss://... server URL

  // Pre-warm session IDs
  preWarmSessionIds: {
    audioId: null,
    primaryCameraId: null,
    screenRecordingId: null,
    secondaryCameraId: null,
  },

  // Pre-warm complete flags
  preWarmComplete: {
    audio: false,
    primaryCamera: false,
    screenRecording: false,
    secondaryCamera: false,
  },
};

export const setStreamStore = (key, value) => {
  streamStore[key] = value;
};

export const getStreamStore = (key) => streamStore[key];

export const setAllStreams = (data) => {
  Object.assign(streamStore, data);
};

export const clearStreamStore = () => {
  streamStore.screenShareStream = null;
  streamStore.micStream = null;
  streamStore.primaryCameraStream = null;
  streamStore.sessionData = null;
  streamStore.preInitializedSocket = null;
  streamStore.livekitRoom = null;
  streamStore.livekitToken = null;
  streamStore.livekitUrl = null;
  streamStore.preWarmSessionIds = {
    audioId: null,
    primaryCameraId: null,
    screenRecordingId: null,
    secondaryCameraId: null,
  };
  streamStore.preWarmComplete = {
    audio: false,
    primaryCamera: false,
    screenRecording: false,
    secondaryCamera: false,
  };
};

export default streamStore;
