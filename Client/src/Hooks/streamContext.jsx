import { createContext, useContext, useRef } from "react";

const StreamContext = createContext(null);

export const StreamProvider = ({ children }) => {
  const streamsRef = useRef({
    micStream: null,
    primaryCameraStream: null,
    screenShareStream: null,
    sessionData: null,
    preInitializedSocket: null,
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
