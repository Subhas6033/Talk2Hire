import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API_URL = import.meta.env.VITE_BACKEND_URL;

// Async thunks
export const fetchCandidates = createAsyncThunk(
  "hiring/fetchCandidates",
  async (filters, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.role) params.append("role", filters.role);
      if (filters.location) params.append("location", filters.location);
      if (filters.minScore) params.append("minScore", filters.minScore);
      params.append("page", filters.page || 1);
      params.append("limit", filters.limit || 50);

      const response = await axios.get(
        `${API_URL}/api/v1/hiring/candidates?${params}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch candidates",
      );
    }
  },
);

export const fetchCandidateDetails = createAsyncThunk(
  "hiring/fetchCandidateDetails",
  async (interviewId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/v1/hiring/candidates/${interviewId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch candidate details",
      );
    }
  },
);

export const fetchHiringStats = createAsyncThunk(
  "hiring/fetchStats",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/api/v1/hiring/stats`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch stats",
      );
    }
  },
);

// Initial state
const initialState = {
  candidates: [],
  selectedCandidate: null,
  stats: null,
  filters: {
    search: "",
    role: "",
    location: "",
    minScore: 0,
    page: 1,
    limit: 50,
  },
  pagination: {
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0,
  },
  loading: false,
  error: null,
};

// Slice
const hiringSlice = createSlice({
  name: "hiring",
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
    setSelectedCandidate: (state, action) => {
      state.selectedCandidate = action.payload;
    },
    clearSelectedCandidate: (state) => {
      state.selectedCandidate = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch candidates
      .addCase(fetchCandidates.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCandidates.fulfilled, (state, action) => {
        state.loading = false;
        state.candidates = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchCandidates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch candidate details
      .addCase(fetchCandidateDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCandidateDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedCandidate = action.payload.data;
      })
      .addCase(fetchCandidateDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch stats
      .addCase(fetchHiringStats.fulfilled, (state, action) => {
        state.stats = action.payload.data;
      });
  },
});

export const {
  setFilters,
  resetFilters,
  setSelectedCandidate,
  clearSelectedCandidate,
} = hiringSlice.actions;

export default hiringSlice.reducer;
