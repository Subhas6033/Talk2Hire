import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { adminAxios } from "./adminAuthApi";

const API = `${import.meta.env.VITE_BACKEND_URL}/api/v1/admin/manage-jobs`;

export const fetchJobs = createAsyncThunk(
  "adminJobs/fetchJobs",
  async (params, { rejectWithValue }) => {
    try {
      const query = new URLSearchParams(params).toString();
      const { data } = await adminAxios.get(`${API}?${query}`);
      return data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch jobs.",
      );
    }
  },
);

export const updateJobStatus = createAsyncThunk(
  "adminJobs/updateStatus",
  async ({ id, status }, { rejectWithValue }) => {
    try {
      const { data } = await adminAxios.patch(`${API}/${id}/status`, {
        status,
      });
      return { id, status, message: data.message };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to update status.",
      );
    }
  },
);

export const deleteJob = createAsyncThunk(
  "adminJobs/deleteJob",
  async (id, { rejectWithValue }) => {
    try {
      await adminAxios.delete(`${API}/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to delete job.",
      );
    }
  },
);

const adminJobsSlice = createSlice({
  name: "adminJobs",
  initialState: {
    jobs: [],
    pagination: null,
    loading: false,
    actionLoading: null,
    error: null,
    filters: {
      search: "",
      status: "all",
      type: "all",
      sortBy: "created_at",
      sortOrder: "desc",
      page: 1,
      limit: 10,
    },
  },
  reducers: {
    setFilters: (state, action) => {
      state.filters = {
        ...state.filters,
        ...action.payload,
        page: action.payload.page ?? 1,
      };
    },
    setPage: (state, action) => {
      state.filters.page = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchJobs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchJobs.fulfilled, (state, action) => {
        state.loading = false;
        state.jobs = action.payload.data.jobs;
        state.pagination = action.payload.data.pagination;
      })
      .addCase(fetchJobs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(updateJobStatus.pending, (state, action) => {
        state.actionLoading = action.meta.arg.id;
      })
      .addCase(updateJobStatus.fulfilled, (state, action) => {
        state.actionLoading = null;
        const job = state.jobs.find((j) => j.id === action.payload.id);
        if (job) job.status = action.payload.status;
      })
      .addCase(updateJobStatus.rejected, (state, action) => {
        state.actionLoading = null;
        state.error = action.payload;
      })

      .addCase(deleteJob.pending, (state, action) => {
        state.actionLoading = action.meta.arg;
      })
      .addCase(deleteJob.fulfilled, (state, action) => {
        state.actionLoading = null;
        state.jobs = state.jobs.filter((j) => j.id !== action.payload);
        if (state.pagination) state.pagination.total -= 1;
      })
      .addCase(deleteJob.rejected, (state, action) => {
        state.actionLoading = null;
        state.error = action.payload;
      });
  },
});

export const { setFilters, setPage, clearError } = adminJobsSlice.actions;
export default adminJobsSlice.reducer;
