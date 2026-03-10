import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const api = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL}`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export const fetchMicrosoftUserSession = createAsyncThunk(
  "microsoftUserAuth/fetchSession",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/api/v1/auth/get-current-user", {
        withCredentials: true,
      });
      return response.data;
    } catch (err) {
      return rejectWithValue({
        message:
          err.response?.data?.message || err.message || "Session fetch failed",
        status: err.response?.status,
      });
    }
  },
);

export const initiateMicrosoftUserLogin = createAsyncThunk(
  "microsoftUserAuth/initiateLogin",
  async (_, { rejectWithValue }) => {
    try {
      window.location.href = "/api/auth/v1/user/microsoft";
      return null;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const logoutMicrosoftUser = createAsyncThunk(
  "microsoftUserAuth/logout",
  async (_, { rejectWithValue }) => {
    try {
      await api.post("/api/v1/auth/logout", {}, { withCredentials: true });
      return null;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

const STORAGE_KEY = "microsoftUserAuthState";

const saveState = (user, isAuthenticated) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user, isAuthenticated, lastVerified: Date.now() }),
    );
  } catch (err) {
    console.error("Failed to persist Microsoft user auth state:", err);
  }
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      user: parsed.user || null,
      isAuthenticated: parsed.isAuthenticated || false,
      loading: false,
      redirecting: false,
      error: null,
      welcomeMessage: null,
      isNewUser: false,
      hydrated: true,
      lastVerified: parsed.lastVerified || null,
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return defaultState();
  }
};

const defaultState = () => ({
  user: null,
  isAuthenticated: false,
  loading: false,
  redirecting: false,
  error: null,
  welcomeMessage: null,
  isNewUser: false,
  hydrated: true,
  lastVerified: null,
});

const microsoftUserAuthSlice = createSlice({
  name: "microsoftUserAuth",
  initialState: loadState(),

  reducers: {
    clearMicrosoftUserError: (state) => {
      state.error = null;
    },
    clearMicrosoftUserWelcome: (state) => {
      state.welcomeMessage = null;
      state.isNewUser = false;
    },
    clearMicrosoftUserSession: (state) => {
      Object.assign(state, defaultState());
      localStorage.removeItem(STORAGE_KEY);
    },
    updateMicrosoftUserLocal: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        saveState(state.user, state.isAuthenticated);
      }
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(initiateMicrosoftUserLogin.pending, (state) => {
        state.redirecting = true;
        state.error = null;
      })
      .addCase(initiateMicrosoftUserLogin.fulfilled, (state) => {
        state.redirecting = true;
      })
      .addCase(initiateMicrosoftUserLogin.rejected, (state, action) => {
        state.redirecting = false;
        state.error = action.payload || "Failed to redirect to Microsoft";
      })

      .addCase(fetchMicrosoftUserSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMicrosoftUserSession.fulfilled, (state, action) => {
        const { welcomeMessage, isNewUser, ...userData } =
          action.payload.data || {};
        state.loading = false;
        state.user = userData;
        state.isAuthenticated = true;
        state.hydrated = true;
        state.welcomeMessage = welcomeMessage || null;
        state.isNewUser = isNewUser || false;
        state.lastVerified = Date.now();
        saveState(userData, true);
      })
      .addCase(fetchMicrosoftUserSession.rejected, (state, action) => {
        state.loading = false;
        state.hydrated = true;
        if (action.payload?.status === 401) {
          state.user = null;
          state.isAuthenticated = false;
          state.lastVerified = null;
          localStorage.removeItem(STORAGE_KEY);
        }
        state.error = action.payload?.message || "Session fetch failed";
      })

      .addCase(logoutMicrosoftUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutMicrosoftUser.fulfilled, (state) => {
        Object.assign(state, defaultState(), { hydrated: true });
        localStorage.removeItem(STORAGE_KEY);
      })
      .addCase(logoutMicrosoftUser.rejected, (state) => {
        Object.assign(state, defaultState(), { hydrated: true });
        localStorage.removeItem(STORAGE_KEY);
      });
  },
});

export const {
  clearMicrosoftUserError,
  clearMicrosoftUserWelcome,
  clearMicrosoftUserSession,
  updateMicrosoftUserLocal,
} = microsoftUserAuthSlice.actions;

export default microsoftUserAuthSlice.reducer;
