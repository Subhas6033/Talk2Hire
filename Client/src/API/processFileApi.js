import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

/**
 * Async thunk to send interview settings + resume
 */
export const startInterview = createAsyncThunk(
  "interview/startInterview",
  async (formValues, { rejectWithValue }) => {
    try {
      const formData = new FormData();

      formData.append("domain", formValues.domain);
      formData.append("role", formValues.role);
      formData.append("experience", formValues.experience);
      formData.append("difficulty", formValues.difficulty);
      formData.append("file", formValues.resume);

      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/v1/file/file-process`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          withCredentials: true,
        }
      );

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Interview start failed"
      );
    }
  }
);

const interviewSlice = createSlice({
  name: "interview",
  initialState: {
    loading: false,
    error: null,
    data: null,
  },
  reducers: {
    resetInterviewState: (state) => {
      state.loading = false;
      state.error = null;
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(startInterview.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(startInterview.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(startInterview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { resetInterviewState } = interviewSlice.actions;
export default interviewSlice.reducer;
