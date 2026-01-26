import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
const baseURL = import.meta.env.VITE_BACKEND_URL;

export const fetchInterviewQuestions = createAsyncThunk(
  "interview/fetchQuestions",
  async (formData, { rejectWithValue }) => {
    try {
      const fd = new FormData();
      if (!formData.resume) {
        throw new Error("Resume file required");
      }
      fd.append("file", formData.resume);
      fd.append("domain", formData.domain);
      fd.append("role", formData.role);
      fd.append("experience", formData.experience);
      fd.append("difficulty", formData.difficulty);
      console.log(formData);
      const res = await axios.post(
        `${baseURL}/api/v1/questions/generate-questions`,
        fd,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
          validateStatus: (status) => status >= 200 && status < 300,
        }
      );
      console.log(res.data.data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

const interviewSlice = createSlice({
  name: "interview",
  initialState: {
    questions: [],
    currentIndex: 0,
    duration: 300,
    status: "idle",
    error: null,
  },
  reducers: {
    nextQuestion(state) {
      if (state.currentIndex < state.questions.length - 1) {
        state.currentIndex += 1;
      }
    },
    resetInterview(state) {
      state.questions = [];
      state.currentIndex = 0;
      state.duration = 300;
      state.status = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInterviewQuestions.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchInterviewQuestions.fulfilled, (state, action) => {
        console.log(action.payload.data);
        state.status = "succeeded";
        state.questions = action.payload.data?.questions || [];
        state.duration = action.payload.data?.duration || 300;
        state.currentIndex = 0;
      })
      .addCase(fetchInterviewQuestions.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
        console.error("Interview fetch failed:", action.payload);
      });
  },
});

export const { nextQuestion, resetInterview } = interviewSlice.actions;
export default interviewSlice.reducer;
