import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api/v1/auth/admin`;

const setCookie = (name, value, maxAge) => {
  document.cookie = `${name}=${value}; path=/; SameSite=Strict; max-age=${maxAge}`;
};

const getCookie = (name) => {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
};

const deleteCookie = (name) => {
  document.cookie = `${name}=; path=/; max-age=0`;
};

const ADMIN_KEY = "adminProfile";

const loadAdminFromStorage = () => {
  try {
    const raw = sessionStorage.getItem(ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveAdminToStorage = (admin) => {
  try {
    sessionStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  } catch {}
};

const clearAdminFromStorage = () => {
  try {
    sessionStorage.removeItem(ADMIN_KEY);
  } catch {}
};

export const loginAdmin = createAsyncThunk(
  "adminAuth/login",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/login`, { email, password });
      setCookie("adminAccessToken", data.accessToken, 900);
      setCookie("adminRefreshToken", data.refreshToken, 604800);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Login failed.");
    }
  },
);

export const logoutAdmin = createAsyncThunk(
  "adminAuth/logout",
  async (_, { rejectWithValue }) => {
    try {
      const token = getCookie("adminAccessToken");
      await axios.post(
        `${API}/logout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch {
    } finally {
      deleteCookie("adminAccessToken");
      deleteCookie("adminRefreshToken");
      clearAdminFromStorage();
    }
  },
);

export const fetchAdminProfile = createAsyncThunk(
  "adminAuth/profile",
  async (_, { rejectWithValue }) => {
    try {
      const token = getCookie("adminAccessToken");
      if (!token) return rejectWithValue("No token");
      const { data } = await axios.get(`${API}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch profile.",
      );
    }
  },
);

export const refreshAdminToken = createAsyncThunk(
  "adminAuth/refresh",
  async (_, { rejectWithValue }) => {
    try {
      const token = getCookie("adminRefreshToken");
      const { data } = await axios.post(`${API}/refresh-token`, {
        refreshToken: token,
      });
      setCookie("adminAccessToken", data.accessToken, 900);
      setCookie("adminRefreshToken", data.refreshToken, 604800);
      return data;
    } catch (err) {
      deleteCookie("adminAccessToken");
      deleteCookie("adminRefreshToken");
      clearAdminFromStorage();
      return rejectWithValue(
        err.response?.data?.message || "Token refresh failed.",
      );
    }
  },
);

const adminAuthSlice = createSlice({
  name: "adminAuth",
  initialState: {
    admin: loadAdminFromStorage(),
    accessToken: getCookie("adminAccessToken") || null,
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearAdmin: (state) => {
      state.admin = null;
      state.accessToken = null;
      deleteCookie("adminAccessToken");
      deleteCookie("adminRefreshToken");
      clearAdminFromStorage();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginAdmin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.admin = action.payload.data.admin;
        state.accessToken = action.payload.accessToken;
        saveAdminToStorage(action.payload.data.admin);
      })
      .addCase(loginAdmin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(logoutAdmin.fulfilled, (state) => {
        state.admin = null;
        state.accessToken = null;
      })
      .addCase(logoutAdmin.rejected, (state) => {
        state.admin = null;
        state.accessToken = null;
      })

      .addCase(fetchAdminProfile.fulfilled, (state, action) => {
        state.admin = action.payload.data.admin;
        saveAdminToStorage(action.payload.data.admin);
      })
      .addCase(fetchAdminProfile.rejected, (state) => {
        if (!loadAdminFromStorage()) {
          state.admin = null;
          state.accessToken = null;
        }
      })

      .addCase(refreshAdminToken.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
      })
      .addCase(refreshAdminToken.rejected, (state) => {
        state.admin = null;
        state.accessToken = null;
      });
  },
});

export const { clearError, clearAdmin } = adminAuthSlice.actions;
export default adminAuthSlice.reducer;
