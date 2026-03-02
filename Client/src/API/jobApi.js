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
      if (filters.q?.trim()) params.q = filters.q.trim();
      if (filters.location?.trim()) params.location = filters.location.trim();
      if (filters.type?.trim()) params.type = filters.type.trim();
      if (filters.department?.trim())
        params.department = filters.department.trim();
      if (filters.experience?.trim())
        params.experience = filters.experience.trim(); // ← ADD
      if (filters.page) params.page = filters.page;
      if (filters.limit) params.limit = filters.limit;

      const { data } = await api.get("/search", { params });

      return {
        jobs: data.data.jobs,
        total: data.data.pagination.total,
        pagination: data.data.pagination,
      };
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

  // Public job listing
  publicJobs: [],
  publicTotal: 0,
  publicPagination: {
    total: 0,
    page: 1,
    limit: 9,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  },

  selectedJob: null,
  counts: { all: 0, active: 0, closed: 0, draft: 0 },
  total: 0,

  loading: {
    fetch: false,
    fetchPublic: false,
    create: false,
    update: false,
    delete: false,
    toggle: false,
  },

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
  },
  extraReducers: (builder) => {
    // ── Fetch All (admin) ──────────────────────────────────
    builder
      .addCase(fetchJobs.pending, (s) => {
        s.loading.fetch = true;
        s.error = null;
      })
      .addCase(fetchJobs.fulfilled, (s, { payload }) => {
        s.loading.fetch = false;
        s.jobs = payload.jobs;
        s.counts = payload.counts;
        s.total = payload.total;
      })
      .addCase(fetchJobs.rejected, (s, { payload }) => {
        s.loading.fetch = false;
        s.error = payload;
      });

    // ── Fetch Public Jobs ──────────────────────────────────
    // Each call replaces the list (server handles pagination).
    builder
      .addCase(fetchPublicJobs.pending, (s) => {
        s.loading.fetchPublic = true;
        s.error = null;
      })
      .addCase(fetchPublicJobs.fulfilled, (s, { payload }) => {
        s.loading.fetchPublic = false;
        s.publicJobs = payload.jobs;
        s.publicTotal = payload.total;
        s.publicPagination = payload.pagination;
      })
      .addCase(fetchPublicJobs.rejected, (s, { payload }) => {
        s.loading.fetchPublic = false;
        s.error = payload;
      });

    // ── Fetch By ID ────────────────────────────────────────
    builder
      .addCase(fetchJobById.pending, (s) => {
        s.loading.fetch = true;
        s.error = null;
      })
      .addCase(fetchJobById.fulfilled, (s, { payload }) => {
        s.loading.fetch = false;
        s.selectedJob = payload;
      })
      .addCase(fetchJobById.rejected, (s, { payload }) => {
        s.loading.fetch = false;
        s.error = payload;
      });

    // ── Create ─────────────────────────────────────────────
    builder
      .addCase(createJob.pending, (s) => {
        s.loading.create = true;
        s.error = null;
        s.successMessage = null;
      })
      .addCase(createJob.fulfilled, (s, { payload }) => {
        s.loading.create = false;
        s.jobs.unshift(payload);
        s.counts.all += 1;
        s.counts[payload.status] = (s.counts[payload.status] || 0) + 1;
        s.total += 1;
        s.successMessage = "Job posted successfully";
      })
      .addCase(createJob.rejected, (s, { payload }) => {
        s.loading.create = false;
        s.error = payload;
      });

    // ── Update ─────────────────────────────────────────────
    builder
      .addCase(updateJob.pending, (s, { meta }) => {
        s.loading.update = true;
        s.mutatingId = meta.arg.id;
        s.error = null;
      })
      .addCase(updateJob.fulfilled, (s, { payload }) => {
        s.loading.update = false;
        s.mutatingId = null;
        s.jobs = s.jobs.map((j) => (j.id === payload.id ? payload : j));
        if (s.selectedJob?.id === payload.id) s.selectedJob = payload;
        s.successMessage = "Job updated successfully";
      })
      .addCase(updateJob.rejected, (s, { payload }) => {
        s.loading.update = false;
        s.mutatingId = null;
        s.error = payload;
      });

    // ── Delete ─────────────────────────────────────────────
    builder
      .addCase(deleteJob.pending, (s, { meta }) => {
        s.loading.delete = true;
        s.mutatingId = meta.arg;
      })
      .addCase(deleteJob.fulfilled, (s, { payload: id }) => {
        s.loading.delete = false;
        s.mutatingId = null;
        const deleted = s.jobs.find((j) => j.id === id);
        if (deleted) {
          s.counts.all = Math.max(0, s.counts.all - 1);
          s.counts[deleted.status] = Math.max(0, s.counts[deleted.status] - 1);
          s.total = Math.max(0, s.total - 1);
        }
        s.jobs = s.jobs.filter((j) => j.id !== id);
        s.successMessage = "Job deleted successfully";
      })
      .addCase(deleteJob.rejected, (s, { payload }) => {
        s.loading.delete = false;
        s.mutatingId = null;
        s.error = payload;
      });

    // ── Toggle Status ──────────────────────────────────────
    builder
      .addCase(toggleJobStatus.pending, (s, { meta }) => {
        s.loading.toggle = true;
        s.mutatingId = meta.arg;
      })
      .addCase(toggleJobStatus.fulfilled, (s, { payload }) => {
        s.loading.toggle = false;
        s.mutatingId = null;
        const old = s.jobs.find((j) => j.id === payload.id);
        if (old && old.status !== payload.status) {
          s.counts[old.status] = Math.max(0, s.counts[old.status] - 1);
          s.counts[payload.status] = (s.counts[payload.status] || 0) + 1;
        }
        s.jobs = s.jobs.map((j) => (j.id === payload.id ? payload : j));
      })
      .addCase(toggleJobStatus.rejected, (s, { payload }) => {
        s.loading.toggle = false;
        s.mutatingId = null;
        s.error = payload;
      });
  },
});

export const { clearError, clearSuccess, clearSelectedJob } = jobSlice.actions;
export default jobSlice.reducer;
