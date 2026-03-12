import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const API = import.meta?.env?.VITE_BACKEND_URL || "";

export const fetchAdminDashboard = createAsyncThunk(
  "adminDashboard/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API}/api/v1/admin/stats/get-stats`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return rejectWithValue(err.message || "Failed to fetch admin stats");
      }
      const data = await res.json();
      return data.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

const adminDashboardSlice = createSlice({
  name: "adminDashboard",
  initialState: {
    stats: null,
    weeklyScreenings: [],
    planBreakdown: [],
    recentActivity: [],
    activityFeed: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminDashboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload.stats;
        state.weeklyScreenings = action.payload.weeklyScreenings;
        state.planBreakdown = action.payload.planBreakdown;
        state.recentActivity = action.payload.recentActivity;
        state.activityFeed = action.payload.activityFeed;
      })
      .addCase(fetchAdminDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default adminDashboardSlice.reducer;
