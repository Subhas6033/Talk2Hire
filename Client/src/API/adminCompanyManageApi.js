import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { adminAxios } from "./adminAuthApi";

const API = `${import.meta.env.VITE_BACKEND_URL}/api/v1/admin/manage-company`;

export const fetchCompanies = createAsyncThunk(
  "adminCompanies/fetchCompanies",
  async (params, { rejectWithValue }) => {
    try {
      const query = new URLSearchParams(params).toString();
      const { data } = await adminAxios.get(`${API}?${query}`);
      return data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch companies.",
      );
    }
  },
);

export const deleteCompany = createAsyncThunk(
  "adminCompanies/deleteCompany",
  async (id, { rejectWithValue }) => {
    try {
      await adminAxios.delete(`${API}/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to delete company.",
      );
    }
  },
);

const adminCompaniesSlice = createSlice({
  name: "adminCompanies",
  initialState: {
    companies: [],
    pagination: null,
    loading: false,
    actionLoading: null,
    error: null,
    filters: {
      search: "",
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
      .addCase(fetchCompanies.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompanies.fulfilled, (state, action) => {
        state.loading = false;
        state.companies = action.payload.data.companies;
        state.pagination = action.payload.data.pagination;
      })
      .addCase(fetchCompanies.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(deleteCompany.pending, (state, action) => {
        state.actionLoading = action.meta.arg;
      })
      .addCase(deleteCompany.fulfilled, (state, action) => {
        state.actionLoading = null;
        state.companies = state.companies.filter(
          (c) => c.id !== action.payload,
        );
        if (state.pagination) state.pagination.total -= 1;
      })
      .addCase(deleteCompany.rejected, (state, action) => {
        state.actionLoading = null;
        state.error = action.payload;
      });
  },
});

export const { setFilters, setPage, clearError } = adminCompaniesSlice.actions;
export default adminCompaniesSlice.reducer;
