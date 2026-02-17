const streamStore = {
  screenShareStream: null,
  micStream: null,
  primaryCameraStream: null,
  sessionData: null,
  preInitializedSocket: null,
  preWarmSessionIds: {},
  preWarmComplete: {},
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
  streamStore.preWarmSessionIds = {};
  streamStore.preWarmComplete = {};
};

export default streamStore;
