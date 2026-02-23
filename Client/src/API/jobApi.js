import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api/v1/jobs`;

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// ─── Async Thunks ─────────────────────────────────────────────

export const fetchJobs = createAsyncThunk(
  "jobs/fetchAll",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (filters.status && filters.status !== "all")
        params.status = filters.status;
      if (filters.department && filters.department !== "all")
        params.department = filters.department;
      if (filters.search) params.search = filters.search;

      const { data } = await api.get("", { params });
      return data.data; // { jobs, counts, total }
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch jobs",
      );
    }
  },
);

export const fetchPublicJobs = createAsyncThunk(
  "jobs/fetchPublic",
  async (filters = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.department) params.department = filters.department;
      if (filters.location) params.location = filters.location;
      if (filters.type) params.type = filters.type;
      if (filters.experience) params.experience = filters.experience;

      const { data } = await api.get("/public-jobs", { params });
      return data.data; // { jobs, total }
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch public jobs",
      );
    }
  },
);

export const fetchJobById = createAsyncThunk(
  "jobs/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/public/${id}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch job",
      );
    }
  },
);

export const createJob = createAsyncThunk(
  "jobs/create",
  async (jobData, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/", jobData);
      return data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to create job",
      );
    }
  },
);

export const updateJob = createAsyncThunk(
  "jobs/update",
  async ({ id, ...jobData }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/${id}`, jobData);
      return data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to update job",
      );
    }
  },
);

export const deleteJob = createAsyncThunk(
  "jobs/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to delete job",
      );
    }
  },
);

export const toggleJobStatus = createAsyncThunk(
  "jobs/toggleStatus",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/${id}/toggle-status`);
      return data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to toggle status",
      );
    }
  },
);

// ─── Initial State ────────────────────────────────────────────

const initialState = {
  jobs: [],
  publicJobs: [], // ← ADDED
  publicTotal: 0, // ← ADDED
  selectedJob: null,
  counts: { all: 0, active: 0, closed: 0, draft: 0 },
  total: 0,

  // Granular loading states per action
  loading: {
    fetch: false,
    fetchPublic: false, // ← ADDED
    create: false,
    update: false,
    delete: false,
    toggle: false,
  },

  // Track which job ID is being mutated (for per-card UI feedback)
  mutatingId: null,

  error: null,
  successMessage: null,
};

// ─── Slice ────────────────────────────────────────────────────

const jobSlice = createSlice({
  name: "jobs",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSuccess: (state) => {
      state.successMessage = null;
    },
    clearSelectedJob: (state) => {
      state.selectedJob = null;
    },
    // Optimistic filter/search on cached jobs (UI-only, no API call)
    setFilters: (state, action) => {
      state.activeFilters = action.payload;
    },
  },
  extraReducers: (builder) => {
    // ── Fetch All ──────────────────────────────────────────────
    builder
      .addCase(fetchJobs.pending, (state) => {
        state.loading.fetch = true;
        state.error = null;
      })
      .addCase(fetchJobs.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.jobs = payload.jobs;
        state.counts = payload.counts;
        state.total = payload.total;
      })
      .addCase(fetchJobs.rejected, (state, { payload }) => {
        state.loading.fetch = false;
        state.error = payload;
      });

    // ── Fetch Public Jobs ──────────────────────────────────────
    builder
      .addCase(fetchPublicJobs.pending, (state) => {
        state.loading.fetchPublic = true;
        state.error = null;
      })
      .addCase(fetchPublicJobs.fulfilled, (state, { payload }) => {
        state.loading.fetchPublic = false;
        state.publicJobs = payload.jobs;
        state.publicTotal = payload.total;
      })
      .addCase(fetchPublicJobs.rejected, (state, { payload }) => {
        state.loading.fetchPublic = false;
        state.error = payload;
      });

    // ── Fetch By ID ────────────────────────────────────────────
    builder
      .addCase(fetchJobById.pending, (state) => {
        state.loading.fetch = true;
        state.error = null;
      })
      .addCase(fetchJobById.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.selectedJob = payload;
      })
      .addCase(fetchJobById.rejected, (state, { payload }) => {
        state.loading.fetch = false;
        state.error = payload;
      });

    // ── Create ─────────────────────────────────────────────────
    builder
      .addCase(createJob.pending, (state) => {
        state.loading.create = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(createJob.fulfilled, (state, { payload }) => {
        state.loading.create = false;
        state.jobs.unshift(payload);
        state.counts.all += 1;
        state.counts[payload.status] = (state.counts[payload.status] || 0) + 1;
        state.total += 1;
        state.successMessage = "Job posted successfully";
      })
      .addCase(createJob.rejected, (state, { payload }) => {
        state.loading.create = false;
        state.error = payload;
      });

    // ── Update ─────────────────────────────────────────────────
    builder
      .addCase(updateJob.pending, (state, { meta }) => {
        state.loading.update = true;
        state.mutatingId = meta.arg.id;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(updateJob.fulfilled, (state, { payload }) => {
        state.loading.update = false;
        state.mutatingId = null;
        state.jobs = state.jobs.map((j) => (j.id === payload.id ? payload : j));
        if (state.selectedJob?.id === payload.id) state.selectedJob = payload;
        state.successMessage = "Job updated successfully";
      })
      .addCase(updateJob.rejected, (state, { payload }) => {
        state.loading.update = false;
        state.mutatingId = null;
        state.error = payload;
      });

    // ── Delete ─────────────────────────────────────────────────
    builder
      .addCase(deleteJob.pending, (state, { meta }) => {
        state.loading.delete = true;
        state.mutatingId = meta.arg;
        state.error = null;
      })
      .addCase(deleteJob.fulfilled, (state, { payload: id }) => {
        state.loading.delete = false;
        state.mutatingId = null;
        const deleted = state.jobs.find((j) => j.id === id);
        if (deleted) {
          state.counts.all = Math.max(0, state.counts.all - 1);
          state.counts[deleted.status] = Math.max(
            0,
            state.counts[deleted.status] - 1,
          );
          state.total = Math.max(0, state.total - 1);
        }
        state.jobs = state.jobs.filter((j) => j.id !== id);
        state.successMessage = "Job deleted successfully";
      })
      .addCase(deleteJob.rejected, (state, { payload }) => {
        state.loading.delete = false;
        state.mutatingId = null;
        state.error = payload;
      });

    // ── Toggle Status ──────────────────────────────────────────
    builder
      .addCase(toggleJobStatus.pending, (state, { meta }) => {
        state.loading.toggle = true;
        state.mutatingId = meta.arg;
        state.error = null;
      })
      .addCase(toggleJobStatus.fulfilled, (state, { payload }) => {
        state.loading.toggle = false;
        state.mutatingId = null;
        // Update counts
        const old = state.jobs.find((j) => j.id === payload.id);
        if (old && old.status !== payload.status) {
          state.counts[old.status] = Math.max(0, state.counts[old.status] - 1);
          state.counts[payload.status] =
            (state.counts[payload.status] || 0) + 1;
        }
        state.jobs = state.jobs.map((j) => (j.id === payload.id ? payload : j));
      })
      .addCase(toggleJobStatus.rejected, (state, { payload }) => {
        state.loading.toggle = false;
        state.mutatingId = null;
        state.error = payload;
      });
  },
});

export const { clearError, clearSuccess, clearSelectedJob } = jobSlice.actions;
export default jobSlice.reducer;
