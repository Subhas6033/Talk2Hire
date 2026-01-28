import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const baseURL = import.meta.env.VITE_BACKEND_URL;

/**
 * STEP 1: Start interview (HTTP)
 * Generates first question + sessionId
 */
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

const interviewSlice = createSlice({
  name: "interview",
  initialState: {
    sessionId: null,
    socket: null,
    status: "idle", // idle | loading | ready | connecting | live | ended | failed
    currentQuestion: null,
    questionOrder: 0,
    liveTranscript: "",
    finalAnswer: "",
    history: [],
    audioQueue: [], // store audio chunks for playback
    error: null,
  },

  reducers: {
    /**
     * STEP 2: Connect WebSocket
     */
    connectSocket(state, action) {
      state.socket = action.payload;
      state.status = "connecting";
    },

    socketConnected(state) {
      state.status = "live";
    },

    socketError(state, action) {
      state.error = action.payload;
      state.status = "ended";
    },

    /**
     * 🎙️ Receive partial speech transcript from Deepgram
     */
    receivePartialTranscript(state, action) {
      state.liveTranscript = action.payload;
    },

    /**
     * ✅ Receive final transcript (user finished answering)
     */
    receiveFinalAnswer(state, action) {
      state.finalAnswer = action.payload;

      state.history.push({
        question: state.currentQuestion,
        answer: action.payload,
      });

      state.liveTranscript = "";
    },

    /**
     * ❓ Receive next question from server
     */
    receiveNextQuestion(state, action) {
      state.currentQuestion = action.payload.question;
      state.questionOrder = action.payload.questionOrder;
      state.finalAnswer = "";
    },

    /**
     * 🔊 Receive audio chunk (TTS)
     */
    receiveAudioChunk(state, action) {
      state.audioQueue.push(action.payload);
    },

    /**
     * 🏁 Interview finished
     */
    interviewEnded(state) {
      state.status = "ended";
    },

    /**
     * Reset entire interview state
     */
    resetInterview(state) {
      state.sessionId = null;
      state.socket = null;
      state.status = "idle";
      state.currentQuestion = null;
      state.questionOrder = 0;
      state.liveTranscript = "";
      state.finalAnswer = "";
      state.history = [];
      state.audioQueue = [];
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder
      /* Start interview */
      .addCase(startInterview.pending, (state) => {
        state.status = "loading";
      })
      .addCase(startInterview.fulfilled, (state, action) => {
        state.status = "ready";
        state.sessionId = action.payload.sessionId;
        state.currentQuestion = action.payload.question;
        state.questionOrder = 1;
      })
      .addCase(startInterview.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      });
  },
});

export const {
  connectSocket,
  socketConnected,
  socketError,
  receivePartialTranscript,
  receiveFinalAnswer,
  receiveNextQuestion,
  receiveAudioChunk,
  interviewEnded,
  resetInterview,
} = interviewSlice.actions;

export default interviewSlice.reducer;
