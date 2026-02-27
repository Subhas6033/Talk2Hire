const streamStore = {
  screenShareStream: null,
  micStream: null,
  primaryCameraStream: null,
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
