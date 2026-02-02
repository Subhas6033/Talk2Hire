import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const baseURL = import.meta.env.VITE_BACKEND_URL;

// Async thunk for starting interview (your existing logic)
export const startInterview = createAsyncThunk(
  "interview/start",
  async ({ resume }, { rejectWithValue }) => {
    try {
      const fd = new FormData();
      fd.append("file", resume);
      const res = await axios.post(
        `${baseURL}/api/v1/questions/generate-questions`,
        fd,
        {
          withCredentials: true,
        }
      );
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

const initialState = {
  // Session & Connection
  sessionId: null,
  status: "idle", // idle | loading | ready | connecting | live | ended | failed | error | disconnected
  isInitializing: true,
  serverReady: false,
  hasStarted: false,

  // Audio State
  isPlaying: false,
  isListening: false,
  canListen: false,
  ttsStreamActive: false,
  audioQueueLength: 0, // Only store count, not actual buffers

  // Microphone State
  micStreamingActive: false,
  micPermissionGranted: false,

  // Interview Content
  currentQuestion: null,
  questionOrder: 0,
  serverText: "",
  userText: "",
  liveTranscript: "",
  finalAnswer: "",
  idlePrompt: "",

  // Recording
  recordingDuration: "00:00",
  recordingStartTime: null,

  // Interview History
  history: [],

  // Metadata
  interviewId: null,
  userId: null,
  totalQuestions: 0,
  isComplete: false,

  // Error handling
  error: null,
};

const interviewSlice = createSlice({
  name: "interview",
  initialState,
  reducers: {
    // ============================================================================
    // CONNECTION & STATUS ACTIONS
    // ============================================================================

    setStatus: (state, action) => {
      state.status = action.payload;
    },

    setServerReady: (state, action) => {
      state.serverReady = action.payload;
    },

    setHasStarted: (state, action) => {
      state.hasStarted = action.payload;
      if (action.payload) {
        state.isInitializing = false;
      }
    },

    setIsInitializing: (state, action) => {
      state.isInitializing = action.payload;
    },

    // Socket connection actions (your existing logic)
    connectSocket: (state, action) => {
      state.status = "connecting";
    },

    socketConnected: (state) => {
      state.status = "live";
    },

    socketError: (state, action) => {
      state.error = action.payload;
      state.status = "error";
    },

    // ============================================================================
    // AUDIO PLAYBACK ACTIONS
    // ============================================================================

    setIsPlaying: (state, action) => {
      state.isPlaying = action.payload;
    },

    setIsListening: (state, action) => {
      state.isListening = action.payload;
      state.canListen = action.payload;
    },

    enableListening: (state) => {
      state.isListening = true;
      state.canListen = true;
    },

    disableListening: (state) => {
      state.isListening = false;
      state.canListen = false;
    },

    setTtsStreamActive: (state, action) => {
      state.ttsStreamActive = action.payload;
    },

    // Audio queue management - ONLY store length, not buffers
    incrementAudioQueue: (state) => {
      state.audioQueueLength += 1;
    },

    decrementAudioQueue: (state) => {
      if (state.audioQueueLength > 0) {
        state.audioQueueLength -= 1;
      }
    },

    clearAudioQueue: (state) => {
      state.audioQueueLength = 0;
    },

    setAudioQueueLength: (state, action) => {
      state.audioQueueLength = action.payload;
    },

    // ============================================================================
    // MICROPHONE ACTIONS
    // ============================================================================

    setMicStreamingActive: (state, action) => {
      state.micStreamingActive = action.payload;
    },

    setMicPermissionGranted: (state, action) => {
      state.micPermissionGranted = action.payload;
    },

    // ============================================================================
    // QUESTION & TRANSCRIPT ACTIONS
    // ============================================================================

    setCurrentQuestion: (state, action) => {
      state.currentQuestion = action.payload;
      state.serverText = action.payload;
      state.idlePrompt = "";
    },

    // Your existing question handler
    receiveNextQuestion: (state, action) => {
      state.currentQuestion = action.payload.question;
      state.questionOrder = action.payload.questionOrder;
      state.serverText = action.payload.question;
      state.finalAnswer = "";
      state.userText = "";
      state.idlePrompt = "";
    },

    // Transcript handling
    setUserText: (state, action) => {
      state.userText = action.payload;
      state.idlePrompt = "";
    },

    receivePartialTranscript: (state, action) => {
      state.liveTranscript = action.payload;
    },

    receiveFinalAnswer: (state, action) => {
      state.finalAnswer = action.payload;
      state.userText = action.payload;
      state.history.push({
        question: state.currentQuestion,
        answer: action.payload,
        questionOrder: state.questionOrder,
      });
      state.liveTranscript = "";
      state.idlePrompt = "";
    },

    clearUserText: (state) => {
      state.userText = "";
      state.finalAnswer = "";
    },

    setIdlePrompt: (state, action) => {
      state.idlePrompt = action.payload;
    },

    // ============================================================================
    // RECORDING ACTIONS
    // ============================================================================

    setRecordingDuration: (state, action) => {
      state.recordingDuration = action.payload;
    },

    startRecording: (state) => {
      state.recordingStartTime = Date.now();
      state.recordingDuration = "00:00";
    },

    updateRecordingDuration: (state) => {
      if (state.recordingStartTime) {
        const elapsed = Math.floor(
          (Date.now() - state.recordingStartTime) / 1000
        );
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        state.recordingDuration = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      }
    },

    stopRecording: (state) => {
      state.recordingStartTime = null;
    },

    // ============================================================================
    // INTERVIEW LIFECYCLE
    // ============================================================================

    initializeInterview: (state, action) => {
      state.interviewId = action.payload.interviewId;
      state.userId = action.payload.userId;
      state.sessionId = action.payload.sessionId || action.payload.interviewId;
    },

    completeInterview: (state, action) => {
      state.isComplete = true;
      state.totalQuestions =
        action.payload?.totalQuestions || state.history.length;
      state.isListening = false;
      state.canListen = false;
      state.micStreamingActive = false;
      state.idlePrompt = "";
      state.status = "ended";
    },

    interviewEnded: (state) => {
      state.status = "ended";
      state.isComplete = true;
      state.isListening = false;
      state.canListen = false;
      state.micStreamingActive = false;
    },

    // Reset entire interview
    resetInterview: () => initialState,
  },

  // ============================================================================
  // ASYNC THUNK HANDLERS
  // ============================================================================

  extraReducers: (builder) => {
    builder
      // Start interview
      .addCase(startInterview.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(startInterview.fulfilled, (state, action) => {
        state.status = "ready";
        state.sessionId = action.payload.sessionId;
        state.currentQuestion = action.payload.question;
        state.serverText = action.payload.question;
        state.questionOrder = 1;
        state.error = null;
      })
      .addCase(startInterview.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      });
  },
});

// Export actions
export const {
  setStatus,
  setServerReady,
  setHasStarted,
  setIsInitializing,
  setIsPlaying,
  setIsListening,
  enableListening,
  disableListening,
  setTtsStreamActive,
  incrementAudioQueue,
  decrementAudioQueue,
  clearAudioQueue,
  setAudioQueueLength,
  setMicStreamingActive,
  setMicPermissionGranted,
  setCurrentQuestion,
  receiveNextQuestion,
  setUserText,
  receivePartialTranscript,
  receiveFinalAnswer,
  clearUserText,
  setIdlePrompt,
  setRecordingDuration,
  startRecording,
  updateRecordingDuration,
  stopRecording,
  initializeInterview,
  completeInterview,
  interviewEnded,
  resetInterview,
  connectSocket,
  socketConnected,
  socketError,
} = interviewSlice.actions;

export default interviewSlice.reducer;
