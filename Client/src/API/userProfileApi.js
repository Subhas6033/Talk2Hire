import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export const fetchProfileStats = createAsyncThunk(
  "profile/fetchStats",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/v1/auth/profile-stats");
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const updateProfileFiles = createAsyncThunk(
  "profile/updateFiles",
  async (formData, { rejectWithValue }) => {
    try {
      const res = await api.patch("/api/v1/auth/update-profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const fetchUserInterviews = createAsyncThunk(
  "profile/fetchInterviews",
  async ({ page = 1, limit = 10 } = {}, { rejectWithValue }) => {
    try {
      const res = await api.get(
        `/api/v1/auth/interviews?page=${page}&limit=${limit}`,
      );
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

const profileSlice = createSlice({
  name: "profile",
  initialState: {
    data: null,
    loading: false,
    updating: false,
    error: null,
    updateError: null,
    interviews: [],
    interviewsPagination: null,
    interviewsLoading: false,
    interviewsError: null,
  },
  reducers: {
    clearProfileError(state) {
      state.error = null;
      state.updateError = null;
    },
    patchProfile(state, action) {
      if (state.data) state.data = { ...state.data, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfileStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfileStats.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchProfileStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateProfileFiles.pending, (state) => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(updateProfileFiles.fulfilled, (state, action) => {
        state.updating = false;
        state.data = state.data
          ? { ...state.data, ...action.payload }
          : action.payload;
      })
      .addCase(updateProfileFiles.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload;
      })
      .addCase(fetchUserInterviews.pending, (state) => {
        state.interviewsLoading = true;
        state.interviewsError = null;
      })
      .addCase(fetchUserInterviews.fulfilled, (state, action) => {
        state.interviewsLoading = false;
        state.interviews = action.payload.interviews;
        state.interviewsPagination = action.payload.pagination;
      })
      .addCase(fetchUserInterviews.rejected, (state, action) => {
        state.interviewsLoading = false;
        state.interviewsError = action.payload;
      });
  },
});

export const { clearProfileError, patchProfile } = profileSlice.actions;
export default profileSlice.reducer;
