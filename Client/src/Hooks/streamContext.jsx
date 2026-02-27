import { createContext, useContext, useRef } from "react";

const StreamContext = createContext(null);

const createDefaultStreams = () => ({
  micStream: null,
  primaryCameraStream: null,
  screenShareStream: null,
  sessionData: null,
  preInitializedSocket: null,
  preWarmSessionIds: {
    audioId: null,
    primaryCameraId: null,
    screenRecordingId: null,
    secondaryCameraId: null,
  },
  preWarmComplete: {
    audio: false,
    primaryCamera: false,
    screenRecording: false,
    secondaryCamera: false,
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
