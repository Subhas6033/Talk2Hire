import { createContext, useContext, useRef } from "react";

const StreamContext = createContext(null);

export const StreamProvider = ({ children }) => {
  const streamsRef = useRef({
    // ── Media Streams ─────────────────────────────────────────────────────────
    micStream: null,
    primaryCameraStream: null,
    screenShareStream: null,

    // ── Session & Socket ──────────────────────────────────────────────────────
    sessionData: null,
    preInitializedSocket: null,

    // ── Pre-warmed recording session IDs from InterviewSetup step 7 ──────────
    // These are populated during pre-initialization so InterviewLive can
    // resume the SAME server sessions rather than creating new ones.
    // This eliminates the duplicate video_recording_start / server-conflict bug.
    preWarmSessionIds: {
      audioId: null, // from audio_recording_ready
      primaryCameraId: null, // from video_recording_ready (primary_camera)
      screenRecordingId: null, // from video_recording_ready (screen_recording)
      secondaryCameraId: null, // from video_recording_ready (secondary_camera), may be null
    },

    // ── Flags so InterviewLive knows which sessions are already confirmed ─────
    preWarmComplete: {
      audio: false,
      primaryCamera: false,
      screenRecording: false,
      secondaryCamera: false, // optional — may stay false
    },
  });

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
