import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api/v1/auth/admin`;

// ─── Token expiry config (must match backend) ─────────────────────────────────
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Refresh the access token this many ms BEFORE it expires (while user is active)
const PROACTIVE_REFRESH_BUFFER_MS = 2 * 60 * 1000; // 2 minutes

// ─── Cookie helpers ───────────────────────────────────────────────────────────
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

// ─── Session storage helpers ──────────────────────────────────────────────────
const ADMIN_KEY = "adminProfile";
const LAST_ACTIVITY_KEY = "adminLastActivity"; // timestamp of last user action
const TOKEN_ISSUED_KEY = "adminTokenIssuedAt"; // timestamp when access token was issued

const loadAdminFromStorage = () => {
  try {
    return JSON.parse(sessionStorage.getItem(ADMIN_KEY));
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
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
    sessionStorage.removeItem(TOKEN_ISSUED_KEY);
  } catch {}
};

// Record when the access token was issued so we can compute time-to-expiry
const markTokenIssued = () =>
  sessionStorage.setItem(TOKEN_ISSUED_KEY, String(Date.now()));

// Record user activity (called on any mouse/key/touch event)
export const markActivity = () =>
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));

// Returns true if the user has been active within the last ACCESS_TOKEN_TTL_MS
const isUserActive = () => {
  const last = parseInt(sessionStorage.getItem(LAST_ACTIVITY_KEY) || "0", 10);
  return Date.now() - last < ACCESS_TOKEN_TTL_MS;
};

// Returns how many ms until the current access token expires (negative = already expired)
const msUntilAccessTokenExpires = () => {
  const issued = parseInt(sessionStorage.getItem(TOKEN_ISSUED_KEY) || "0", 10);
  if (!issued) return -1;
  return issued + ACCESS_TOKEN_TTL_MS - Date.now();
};

// ─── Axios instance ───────────────────────────────────────────────────────────
// ✅ Added baseURL so callers only need to pass the path, e.g. "/api/v1/admin/..."
export const adminAxios = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
});

let isRefreshing = false;
let pendingQueue = []; // { resolve, reject }[]

const processPendingQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token),
  );
  pendingQueue = [];
};

// Attach current access token to every request
adminAxios.interceptors.request.use((config) => {
  const token = getCookie("adminAccessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401: attempt silent refresh ONLY IF user is still active; otherwise logout
adminAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // ── If user has been idle longer than the token TTL → force logout ─────
    if (!isUserActive()) {
      deleteCookie("adminAccessToken");
      deleteCookie("adminRefreshToken");
      clearAdminFromStorage();
      window.location.href = "/admin/login";
      return Promise.reject(error);
    }

    // ── Active user → attempt token refresh ───────────────────────────────
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return adminAxios(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshTokenValue = getCookie("adminRefreshToken");
      if (!refreshTokenValue) throw new Error("No refresh token");

      const { data } = await axios.post(`${API}/refresh-token`, {
        refreshToken: refreshTokenValue,
      });

      setCookie(
        "adminAccessToken",
        data.accessToken,
        ACCESS_TOKEN_TTL_MS / 1000,
      );
      setCookie(
        "adminRefreshToken",
        data.refreshToken,
        REFRESH_TOKEN_TTL_MS / 1000,
      );
      markTokenIssued();

      processPendingQueue(null, data.accessToken);

      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
      return adminAxios(originalRequest);
    } catch (refreshError) {
      processPendingQueue(refreshError, null);
      deleteCookie("adminAccessToken");
      deleteCookie("adminRefreshToken");
      clearAdminFromStorage();
      window.location.href = "/admin/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

// ─── Proactive background refresh ────────────────────────────────────────────
// Schedules a silent token refresh BEFORE the access token expires,
// but only if the user has been recently active.
let proactiveRefreshTimer = null;

export const scheduleProactiveRefresh = () => {
  if (proactiveRefreshTimer) clearTimeout(proactiveRefreshTimer);

  const msLeft = msUntilAccessTokenExpires();
  const delay = Math.max(0, msLeft - PROACTIVE_REFRESH_BUFFER_MS);

  proactiveRefreshTimer = setTimeout(async () => {
    // Only refresh if the user is still active
    if (!isUserActive()) return; // idle — let the 401 interceptor handle logout naturally

    try {
      const refreshTokenValue = getCookie("adminRefreshToken");
      if (!refreshTokenValue) return;

      const { data } = await axios.post(`${API}/refresh-token`, {
        refreshToken: refreshTokenValue,
      });

      setCookie(
        "adminAccessToken",
        data.accessToken,
        ACCESS_TOKEN_TTL_MS / 1000,
      );
      setCookie(
        "adminRefreshToken",
        data.refreshToken,
        REFRESH_TOKEN_TTL_MS / 1000,
      );
      markTokenIssued();

      // Schedule next proactive refresh cycle
      scheduleProactiveRefresh();
    } catch {
      // Refresh failed — will be caught on next API call via the interceptor
    }
  }, delay);
};

export const cancelProactiveRefresh = () => {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
};

// ─── Async thunks ─────────────────────────────────────────────────────────────
export const loginAdmin = createAsyncThunk(
  "adminAuth/login",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/login`, { email, password });
      setCookie(
        "adminAccessToken",
        data.accessToken,
        ACCESS_TOKEN_TTL_MS / 1000,
      );
      setCookie(
        "adminRefreshToken",
        data.refreshToken,
        REFRESH_TOKEN_TTL_MS / 1000,
      );
      markTokenIssued();
      markActivity(); // user just logged in — counts as activity
      scheduleProactiveRefresh();
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
      await adminAxios.post(`${API}/logout`);
    } catch {
      // Ignore logout errors — always clear local state
    } finally {
      cancelProactiveRefresh();
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
      const { data } = await adminAxios.get(`${API}/profile`);
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
      if (!token) return rejectWithValue("No refresh token");

      const { data } = await axios.post(`${API}/refresh-token`, {
        refreshToken: token,
      });
      setCookie(
        "adminAccessToken",
        data.accessToken,
        ACCESS_TOKEN_TTL_MS / 1000,
      );
      setCookie(
        "adminRefreshToken",
        data.refreshToken,
        REFRESH_TOKEN_TTL_MS / 1000,
      );
      markTokenIssued();
      scheduleProactiveRefresh();
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

// ─── Slice ────────────────────────────────────────────────────────────────────
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
      cancelProactiveRefresh();
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

export { adminAxios as adminApi };
