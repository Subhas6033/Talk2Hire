import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const BASE = import.meta.env.VITE_BACKEND_URL;
const INTERVIEW_API = `${BASE}/api/v1/company/interview`;
const VIOLATION_API = `${BASE}/api/v1/company/violation`;

/* ── Thunks ──────────────────────────────────────────────────────────────── */

export const fetchInterviews = createAsyncThunk(
  "companyInterviews/fetchAll",
  async ({ status, job_id, search } = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (status && status !== "all") params.status = status;
      if (job_id && job_id !== "all") params.job_id = job_id;
      if (search) params.search = search;

      const { data } = await axios.get(INTERVIEW_API, {
        params,
        withCredentials: true,
      });
      return data.data; // { interviews, counts, jobs }
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch interviews",
      );
    }
  },
);

export const fetchInterviewById = createAsyncThunk(
  "companyInterviews/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${INTERVIEW_API}/${id}`, {
        withCredentials: true,
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to fetch interview",
      );
    }
  },
);

export const fetchViolations = createAsyncThunk(
  "companyInterviews/fetchViolations",
  async (interviewId, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${VIOLATION_API}/${interviewId}`, {
        withCredentials: true,
      });
      return { interviewId, violations: data.data?.violations ?? [] };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to load proctoring data",
      );
    }
  },
);

export const hireCandidate = createAsyncThunk(
  "companyInterviews/hire",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await axios.patch(
        `${INTERVIEW_API}/${id}/hire`,
        {},
        { withCredentials: true },
      );
      return data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to hire candidate",
      );
    }
  },
);

export const rejectCandidate = createAsyncThunk(
  "companyInterviews/reject",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await axios.patch(
        `${INTERVIEW_API}/${id}/reject`,
        {},
        { withCredentials: true },
      );
      return data.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message ?? "Failed to reject candidate",
      );
    }
  },
);

/* ── Initial State ───────────────────────────────────────────────────────── */

const initialState = {
  interviews: [],
  jobs: [],
  counts: { all: 0, pending: 0, hired: 0, rejected: 0, avg_score: 0 },

  filterStatus: "all",
  filterJobId: "all",
  search: "",

  selectedInterview: null,

  // violations keyed by interviewId for caching
  violationsByInterview: {},
  violationsStatus: "idle", // idle | loading | succeeded | failed
  violationsError: null,

  listStatus: "idle",
  detailStatus: "idle",
  decisionStatus: "idle",

  error: null,
  detailError: null,
  decisionError: null,
};

/* ── Slice ───────────────────────────────────────────────────────────────── */

const companyInterviewSlice = createSlice({
  name: "companyInterviews",
  initialState,

  reducers: {
    setFilterStatus(state, { payload }) {
      state.filterStatus = payload;
    },
    setFilterJobId(state, { payload }) {
      state.filterJobId = payload;
    },
    setSearch(state, { payload }) {
      state.search = payload;
    },
    clearSelectedInterview(state) {
      state.selectedInterview = null;
      state.detailStatus = "idle";
      state.detailError = null;
      state.violationsStatus = "idle";
      state.violationsError = null;
    },
    clearDecisionError(state) {
      state.decisionError = null;
    },
    resetFilters(state) {
      state.filterStatus = "all";
      state.filterJobId = "all";
      state.search = "";
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchInterviews.pending, (state) => {
        state.listStatus = "loading";
        state.error = null;
      })
      .addCase(fetchInterviews.fulfilled, (state, { payload }) => {
        state.listStatus = "succeeded";
        state.interviews = payload.interviews ?? [];
        state.counts = payload.counts ?? initialState.counts;
        state.jobs = payload.jobs ?? [];
      })
      .addCase(fetchInterviews.rejected, (state, { payload }) => {
        state.listStatus = "failed";
        state.error = payload;
      });

    builder
      .addCase(fetchInterviewById.pending, (state) => {
        state.detailStatus = "loading";
        state.detailError = null;
      })
      .addCase(fetchInterviewById.fulfilled, (state, { payload }) => {
        state.detailStatus = "succeeded";
        state.selectedInterview = payload;
      })
      .addCase(fetchInterviewById.rejected, (state, { payload }) => {
        state.detailStatus = "failed";
        state.detailError = payload;
      });

    builder
      .addCase(fetchViolations.pending, (state) => {
        state.violationsStatus = "loading";
        state.violationsError = null;
      })
      .addCase(fetchViolations.fulfilled, (state, { payload }) => {
        state.violationsStatus = "succeeded";
        state.violationsByInterview[payload.interviewId] = payload.violations;
      })
      .addCase(fetchViolations.rejected, (state, { payload }) => {
        state.violationsStatus = "failed";
        state.violationsError = payload;
      });

    builder
      .addCase(hireCandidate.pending, (state) => {
        state.decisionStatus = "loading";
        state.decisionError = null;
      })
      .addCase(hireCandidate.fulfilled, (state, { payload }) => {
        state.decisionStatus = "succeeded";
        _patchInterview(state, payload);
        if (state.selectedInterview?.id === payload.id) {
          state.selectedInterview = {
            ...state.selectedInterview,
            status: payload.status,
          };
        }
      })
      .addCase(hireCandidate.rejected, (state, { payload }) => {
        state.decisionStatus = "failed";
        state.decisionError = payload;
      });

    builder
      .addCase(rejectCandidate.pending, (state) => {
        state.decisionStatus = "loading";
        state.decisionError = null;
      })
      .addCase(rejectCandidate.fulfilled, (state, { payload }) => {
        state.decisionStatus = "succeeded";
        _patchInterview(state, payload);
        if (state.selectedInterview?.id === payload.id) {
          state.selectedInterview = {
            ...state.selectedInterview,
            status: payload.status,
          };
        }
      })
      .addCase(rejectCandidate.rejected, (state, { payload }) => {
        state.decisionStatus = "failed";
        state.decisionError = payload;
      });
  },
});

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function _patchInterview(state, updated) {
  const idx = state.interviews.findIndex((i) => i.id === updated.id);
  if (idx !== -1)
    state.interviews[idx] = { ...state.interviews[idx], ...updated };

  const counts = {
    all: 0,
    pending: 0,
    hired: 0,
    rejected: 0,
    avg_score: state.counts.avg_score,
  };
  state.interviews.forEach((i) => {
    counts.all++;
    if (counts[i.status] !== undefined) counts[i.status]++;
  });
  state.counts = counts;
}

/* ── Selectors ───────────────────────────────────────────────────────────── */

export const selectFilteredInterviews = (state) => {
  const { interviews, filterStatus, filterJobId, search } =
    state.companyInterviews;
  return interviews.filter((c) => {
    const matchSearch =
      !search ||
      c.candidate?.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.job?.title?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    const matchJob =
      filterJobId === "all" || String(c.job?.id) === String(filterJobId);
    return matchSearch && matchStatus && matchJob;
  });
};

export const selectCounts = (s) => s.companyInterviews.counts;
export const selectJobs = (s) => s.companyInterviews.jobs;
export const selectFilters = (s) => ({
  filterStatus: s.companyInterviews.filterStatus,
  filterJobId: s.companyInterviews.filterJobId,
  search: s.companyInterviews.search,
});
export const selectSelectedInterview = (s) =>
  s.companyInterviews.selectedInterview;
export const selectListStatus = (s) => s.companyInterviews.listStatus;
export const selectDetailStatus = (s) => s.companyInterviews.detailStatus;
export const selectDecisionStatus = (s) => s.companyInterviews.decisionStatus;
export const selectDecisionError = (s) => s.companyInterviews.decisionError;
export const selectViolations = (interviewId) => (s) =>
  s.companyInterviews.violationsByInterview[interviewId] ?? null;
export const selectViolationsStatus = (s) =>
  s.companyInterviews.violationsStatus;
export const selectViolationsError = (s) => s.companyInterviews.violationsError;

/* ── Exports ─────────────────────────────────────────────────────────────── */

export const {
  setFilterStatus,
  setFilterJobId,
  setSearch,
  clearSelectedInterview,
  clearDecisionError,
  resetFilters,
} = companyInterviewSlice.actions;

export default companyInterviewSlice.reducer;
