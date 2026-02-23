// store/slices/dashboardSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const api = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL}/api/v1/dashboard`,
  withCredentials: true,
});

// ─── Thunks ───────────────────────────────────────────────────

// Main — fetches everything in one call
export const fetchDashboard = createAsyncThunk(
  "dashboard/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("");
      return data.data; // { stats, pipeline, recentJobs, recentInterviews }
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch dashboard",
      );
    }
  },
);

// Individual — for targeted refetches (e.g. after hiring someone)
export const fetchDashboardStats = createAsyncThunk(
  "dashboard/fetchStats",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/stats");
      return data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch stats",
      );
    }
  },
);

export const fetchPipeline = createAsyncThunk(
  "dashboard/fetchPipeline",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/pipeline");
      return data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch pipeline",
      );
    }
  },
);

export const fetchRecentJobs = createAsyncThunk(
  "dashboard/fetchRecentJobs",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/recent-jobs");
      return data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch recent jobs",
      );
    }
  },
);

export const fetchRecentInterviews = createAsyncThunk(
  "dashboard/fetchRecentInterviews",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/recent-interviews");
      return data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch recent interviews",
      );
    }
  },
);

// ─── Initial State ────────────────────────────────────────────
const initialState = {
  stats: {
    activeJobs: 0,
    totalApplicants: 0,
    interviewsDone: 0,
    hiredThisMonth: 0,
    newJobsThisMonth: 0,
    interviewsThisWeek: 0,
    hiredLastMonth: 0,
  },
  pipeline: {
    applied: 0,
    interviewed: 0,
    underReview: 0,
    hired: 0,
  },
  recentJobs: [],
  recentInterviews: [],

  loading: {
    dashboard: false,
    stats: false,
    pipeline: false,
    recentJobs: false,
    recentInterviews: false,
  },

  error: null,
  lastFetched: null, // timestamp to avoid unnecessary refetches
};

// ─── Slice ────────────────────────────────────────────────────
const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    clearDashboardError: (state) => {
      state.error = null;
    },
    resetDashboard: () => initialState,
  },
  extraReducers: (builder) => {
    // ── Full Dashboard ─────────────────────────────────────────
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.loading.dashboard = true;
        state.error = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, { payload }) => {
        state.loading.dashboard = false;
        state.stats = payload.stats;
        state.pipeline = payload.pipeline;
        state.recentJobs = payload.recentJobs;
        state.recentInterviews = payload.recentInterviews;
        state.lastFetched = Date.now();
      })
      .addCase(fetchDashboard.rejected, (state, { payload }) => {
        state.loading.dashboard = false;
        state.error = payload;
      });

    // ── Stats ──────────────────────────────────────────────────
    builder
      .addCase(fetchDashboardStats.pending, (state) => {
        state.loading.stats = true;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, { payload }) => {
        state.loading.stats = false;
        state.stats = payload;
      })
      .addCase(fetchDashboardStats.rejected, (state, { payload }) => {
        state.loading.stats = false;
        state.error = payload;
      });

    // ── Pipeline ───────────────────────────────────────────────
    builder
      .addCase(fetchPipeline.pending, (state) => {
        state.loading.pipeline = true;
      })
      .addCase(fetchPipeline.fulfilled, (state, { payload }) => {
        state.loading.pipeline = false;
        state.pipeline = payload;
      })
      .addCase(fetchPipeline.rejected, (state, { payload }) => {
        state.loading.pipeline = false;
        state.error = payload;
      });

    // ── Recent Jobs ────────────────────────────────────────────
    builder
      .addCase(fetchRecentJobs.pending, (state) => {
        state.loading.recentJobs = true;
      })
      .addCase(fetchRecentJobs.fulfilled, (state, { payload }) => {
        state.loading.recentJobs = false;
        state.recentJobs = payload;
      })
      .addCase(fetchRecentJobs.rejected, (state, { payload }) => {
        state.loading.recentJobs = false;
        state.error = payload;
      });

    // ── Recent Interviews ──────────────────────────────────────
    builder
      .addCase(fetchRecentInterviews.pending, (state) => {
        state.loading.recentInterviews = true;
      })
      .addCase(fetchRecentInterviews.fulfilled, (state, { payload }) => {
        state.loading.recentInterviews = false;
        state.recentInterviews = payload;
      })
      .addCase(fetchRecentInterviews.rejected, (state, { payload }) => {
        state.loading.recentInterviews = false;
        state.error = payload;
      });
  },
});

export const { clearDashboardError, resetDashboard } = dashboardSlice.actions;
export default dashboardSlice.reducer;
