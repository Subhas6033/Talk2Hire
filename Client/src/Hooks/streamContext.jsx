import { createContext, useContext, useRef } from "react";

const StreamContext = createContext(null);

const createDefaultStreams = () => ({
  // ── Media Streams ───────────────────────────────────────────────────────────
  micStream: null,
  primaryCameraStream: null,
  screenShareStream: null,

  // ── Session & Socket ────────────────────────────────────────────────────────
  sessionData: null,
  preInitializedSocket: null,

  // ── LiveKit ─────────────────────────────────────────────────────────────────
  // Stashing the Room object here lets InterviewLive grab it immediately
  // instead of waiting for re-auth. The room is already connected when
  // InterviewSetup navigates away.
  livekitRoom: null,
  livekitToken: null,
  livekitUrl: null,

  preWarmSessionIds: {
    audioId: null, // from audio_recording_ready
    primaryCameraId: null, // from video_recording_ready (primary_camera)
    screenRecordingId: null, // from video_recording_ready (screen_recording)
    secondaryCameraId: null, // from video_recording_ready (secondary_camera), optional
  },

  // ── Flags so InterviewLive knows which sessions are already confirmed ───────
  preWarmComplete: {
    audio: false,
    primaryCamera: false,
    screenRecording: false, // stays false on mobile (not supported)
    secondaryCamera: false, // optional — may stay false if mobile not connected
  },
});

export const StreamProvider = ({ children }) => {
  const streamsRef = useRef(createDefaultStreams());

  streamsRef.current.reset = () => {
    const fresh = createDefaultStreams();
    Object.assign(streamsRef.current, fresh);
  };

  return (
    <StreamContext.Provider value={streamsRef}>
      {children}
    </StreamContext.Provider>
  );
};

export const useStreams = () => {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error("useStreams must be used within StreamProvider");
  }
  return context;
};
