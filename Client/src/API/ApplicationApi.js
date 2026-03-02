import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "./api"; // adjust path

// ─── Thunks ───────────────────────────────────────────────────
export const fetchMyApplications = createAsyncThunk(
  "applications/fetchMy",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/applications/my");
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch");
    }
  },
);

export const updateAppStatus = createAsyncThunk(
  "applications/updateStatus",
  async ({ id, status }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/applications/${id}/status`, {
        status,
      });
      return res.data.data; // { id, status }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to update");
    }
  },
);

export const toggleAppStar = createAsyncThunk(
  "applications/toggleStar",
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/applications/${id}/star`);
      return res.data.data; // { id, starred }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to star");
    }
  },
);

export const deleteApp = createAsyncThunk(
  "applications/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/applications/${id}`);
      return { id };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to delete");
    }
  },
);

export const updateAppNotes = createAsyncThunk(
  "applications/updateNotes",
  async ({ id, notes }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/applications/${id}/notes`, {
        notes,
      });
      return res.data.data; // { id, notes }
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to update notes",
      );
    }
  },
);

// ─── Slice ────────────────────────────────────────────────────
const applicationSlice = createSlice({
  name: "applications",
  initialState: {
    applications: [],
    loading: {
      fetch: false,
      updateStatus: false,
      toggleStar: false,
      delete: false,
      updateNotes: false,
    },
    mutatingId: null,
    error: null,
  },
  reducers: {
    clearAppError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // fetch
    builder
      .addCase(fetchMyApplications.pending, (state) => {
        state.loading.fetch = true;
        state.error = null;
      })
      .addCase(fetchMyApplications.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.applications = payload;
      })
      .addCase(fetchMyApplications.rejected, (state, { payload }) => {
        state.loading.fetch = false;
        state.error = payload;
      })

      // update status — optimistic
      .addCase(updateAppStatus.pending, (state, { meta }) => {
        state.mutatingId = meta.arg.id;
        const app = state.applications.find((a) => a.id === meta.arg.id);
        if (app) app.status = meta.arg.status; // optimistic
      })
      .addCase(updateAppStatus.fulfilled, (state) => {
        state.mutatingId = null;
      })
      .addCase(updateAppStatus.rejected, (state, { payload }) => {
        state.mutatingId = null;
        state.error = payload;
      })

      // toggle star — optimistic
      .addCase(toggleAppStar.pending, (state, { meta }) => {
        const app = state.applications.find((a) => a.id === meta.arg);
        if (app) app.starred = !app.starred; // optimistic
      })
      .addCase(toggleAppStar.rejected, (state, { meta, payload }) => {
        // revert
        const app = state.applications.find((a) => a.id === meta.arg);
        if (app) app.starred = !app.starred;
        state.error = payload;
      })

      // delete — optimistic
      .addCase(deleteApp.pending, (state, { meta }) => {
        state.mutatingId = meta.arg;
        state.applications = state.applications.filter(
          (a) => a.id !== meta.arg,
        );
      })
      .addCase(deleteApp.rejected, (state, { payload }) => {
        state.mutatingId = null;
        state.error = payload;
        // Note: ideally re-fetch on failure
      })
      .addCase(deleteApp.fulfilled, (state) => {
        state.mutatingId = null;
      })

      // update notes — optimistic
      .addCase(updateAppNotes.pending, (state, { meta }) => {
        const app = state.applications.find((a) => a.id === meta.arg.id);
        if (app) app.notes = meta.arg.notes;
      })
      .addCase(updateAppNotes.rejected, (state, { payload }) => {
        state.error = payload;
      });
  },
});

export const { clearAppError } = applicationSlice.actions;
export default applicationSlice.reducer;
