import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const api = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL}`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export const fetchMicrosoftSession = createAsyncThunk(
  "microsoftAuth/fetchSession",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/api/v1/company/auth/me", {
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

export const initiateMicrosoftLogin = createAsyncThunk(
  "microsoftAuth/initiateLogin",
  async (_, { rejectWithValue }) => {
    try {
      window.location.href = "/api/auth/v1/microsoft";
      return null;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const logoutMicrosoftCompany = createAsyncThunk(
  "microsoftAuth/logout",
  async (_, { rejectWithValue }) => {
    try {
      await api.post(
        "/api/v1/company/auth/logout",
        {},
        { withCredentials: true },
      );
      return null;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

const STORAGE_KEY = "microsoftCompanyAuthState";

const saveState = (company, isAuthenticated) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ company, isAuthenticated, lastVerified: Date.now() }),
    );
  } catch (err) {
    console.error("Failed to persist Microsoft auth state:", err);
  }
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      company: parsed.company || null,
      isAuthenticated: parsed.isAuthenticated || false,
      loading: false,
      redirecting: false,
      error: null,
      welcomeMessage: null,
      hydrated: true,
      lastVerified: parsed.lastVerified || null,
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return defaultState();
  }
};

const defaultState = () => ({
  company: null,
  isAuthenticated: false,
  loading: false,
  redirecting: false,
  error: null,
  welcomeMessage: null,
  hydrated: true,
  lastVerified: null,
});

const microsoftAuthSlice = createSlice({
  name: "microsoftAuth",
  initialState: loadState(),

  reducers: {
    clearMicrosoftError: (state) => {
      state.error = null;
    },
    clearWelcomeMessage: (state) => {
      state.welcomeMessage = null;
    },
    clearMicrosoftSession: (state) => {
      Object.assign(state, defaultState());
      localStorage.removeItem(STORAGE_KEY);
    },
    updateMicrosoftCompanyLocal: (state, action) => {
      if (state.company) {
        state.company = { ...state.company, ...action.payload };
        saveState(state.company, state.isAuthenticated);
      }
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(initiateMicrosoftLogin.pending, (state) => {
        state.redirecting = true;
        state.error = null;
      })
      .addCase(initiateMicrosoftLogin.fulfilled, (state) => {
        state.redirecting = true;
      })
      .addCase(initiateMicrosoftLogin.rejected, (state, action) => {
        state.redirecting = false;
        state.error = action.payload || "Failed to redirect to Microsoft";
      })

      .addCase(fetchMicrosoftSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMicrosoftSession.fulfilled, (state, action) => {
        const { welcomeMessage, ...companyData } = action.payload.data || {};
        state.loading = false;
        state.company = companyData;
        state.isAuthenticated = true;
        state.hydrated = true;
        state.welcomeMessage = welcomeMessage || null;
        state.lastVerified = Date.now();
        saveState(companyData, true);
      })
      .addCase(fetchMicrosoftSession.rejected, (state, action) => {
        state.loading = false;
        state.hydrated = true;
        if (action.payload?.status === 401) {
          state.company = null;
          state.isAuthenticated = false;
          state.lastVerified = null;
          localStorage.removeItem(STORAGE_KEY);
        }
        state.error = action.payload?.message || "Session fetch failed";
      })

      .addCase(logoutMicrosoftCompany.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutMicrosoftCompany.fulfilled, (state) => {
        Object.assign(state, defaultState(), { hydrated: true });
        localStorage.removeItem(STORAGE_KEY);
      })
      .addCase(logoutMicrosoftCompany.rejected, (state) => {
        Object.assign(state, defaultState(), { hydrated: true });
        localStorage.removeItem(STORAGE_KEY);
      });
  },
});

export const {
  clearMicrosoftError,
  clearWelcomeMessage,
  clearMicrosoftSession,
  updateMicrosoftCompanyLocal,
} = microsoftAuthSlice.actions;

export default microsoftAuthSlice.reducer;
