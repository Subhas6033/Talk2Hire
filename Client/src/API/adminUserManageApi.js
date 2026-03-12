import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { adminAxios } from "./adminAuthApi";

const API = `${import.meta.env.VITE_BACKEND_URL}/api/v1/admin/manage-user`;

export const fetchUsers = createAsyncThunk(
  "adminUsers/fetchUsers",
  async (params, { rejectWithValue }) => {
    try {
      const query = new URLSearchParams(params).toString();
      const { data } = await adminAxios.get(`${API}?${query}`);
      return data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch users.",
      );
    }
  },
);

export const updateUserStatus = createAsyncThunk(
  "adminUsers/updateStatus",
  async ({ id, is_active }, { rejectWithValue }) => {
    try {
      const { data } = await adminAxios.patch(`${API}/${id}/status`, {
        is_active,
      });
      return { id, is_active, message: data.message };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to update status.",
      );
    }
  },
);

export const deleteUser = createAsyncThunk(
  "adminUsers/deleteUser",
  async (id, { rejectWithValue }) => {
    try {
      await adminAxios.delete(`${API}/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to delete user.",
      );
    }
  },
);

const adminUsersSlice = createSlice({
  name: "adminUsers",
  initialState: {
    users: [],
    pagination: null,
    loading: false,
    actionLoading: null,
    error: null,
    filters: {
      search: "",
      status: "all",
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
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.data.users;
        state.pagination = action.payload.data.pagination;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(updateUserStatus.pending, (state, action) => {
        state.actionLoading = action.meta.arg.id;
      })
      .addCase(updateUserStatus.fulfilled, (state, action) => {
        state.actionLoading = null;
        const user = state.users.find((u) => u.id === action.payload.id);
        if (user) user.is_active = action.payload.is_active ? 1 : 0;
      })
      .addCase(updateUserStatus.rejected, (state, action) => {
        state.actionLoading = null;
        state.error = action.payload;
      })

      .addCase(deleteUser.pending, (state, action) => {
        state.actionLoading = action.meta.arg;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.actionLoading = null;
        state.users = state.users.filter((u) => u.id !== action.payload);
        if (state.pagination) state.pagination.total -= 1;
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.actionLoading = null;
        state.error = action.payload;
      });
  },
});

export const { setFilters, setPage, clearError } = adminUsersSlice.actions;
export default adminUsersSlice.reducer;
