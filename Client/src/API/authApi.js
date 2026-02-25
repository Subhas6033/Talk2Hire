import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "./api";

export const registerUser = createAsyncThunk(
  "auth/register",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/register", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const getCVSkills = createAsyncThunk(
  "auth/getCVSkills",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/auth/cv-skills", {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch CV skills",
      );
    }
  },
);

export const loginUser = createAsyncThunk(
  "auth/login",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await api.post(
        "/auth/login",
        { email, password },
        { withCredentials: true },
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const logoutUser = createAsyncThunk(
  "auth/logout",
  async (_, { rejectWithValue }) => {
    try {
      await api.post("/auth/logout", {}, { withCredentials: true });
      return null;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const getCurrentUser = createAsyncThunk(
  "auth/getCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/auth/get-current-user", {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || "Not authenticated",
        status: error.response?.status,
      });
    }
  },
);

export const updateUser = createAsyncThunk(
  "auth/updateUser",
  async (userData, { rejectWithValue }) => {
    try {
      const isFormData = userData instanceof FormData;
      const config = {
        withCredentials: true,
        ...(isFormData && {
          headers: { "Content-Type": "multipart/form-data" },
        }),
      };
      const response = await api.patch(
        "/auth/update-profile",
        userData,
        config,
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

const saveAuthState = (user, isAuthenticated) => {
  try {
    localStorage.setItem(
      "authState",
      JSON.stringify({ user, isAuthenticated, lastVerified: Date.now() }),
    );
  } catch (err) {
    console.error("Failed to save auth state:", err);
  }
};

const loadStateFromStorage = () => {
  try {
    const serialized = localStorage.getItem("authState");
    if (!serialized) return defaultState();

    const parsed = JSON.parse(serialized);
    return {
      user: parsed.user || null,
      isAuthenticated: parsed.isAuthenticated || false,
      loading: false,
      error: null,
      hydrated: true,
      lastVerified: parsed.lastVerified || null,
    };
  } catch (err) {
    console.error("Failed to load auth state:", err);
    localStorage.removeItem("authState");
    return defaultState();
  }
};

const defaultState = () => ({
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  hydrated: true,
  lastVerified: null,
});

// Sessions verified within the last 5 minutes are considered fresh.
// This prevents a race where getCurrentUser rejects and wipes a user
// who just registered/logged in moments ago.
const SESSION_GRACE_MS = 5 * 60 * 1000;

const isRecentSession = (lastVerified) =>
  lastVerified && Date.now() - lastVerified < SESSION_GRACE_MS;

const initialState = loadStateFromStorage();

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthHydrated: (state) => {
      state.hydrated = true;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateUserLocal: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        saveAuthState(state.user, state.isAuthenticated);
      }
    },
    clearSession: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.lastVerified = null;
      state.error = null;
      localStorage.removeItem("authState");
    },
  },

  extraReducers: (builder) => {
    builder
      // REGISTER
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.data;
        state.isAuthenticated = true;
        state.hydrated = true;
        state.lastVerified = Date.now();
        saveAuthState(state.user, state.isAuthenticated);
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.hydrated = true;
      })

      // GET CV SKILLS
      .addCase(getCVSkills.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCVSkills.fulfilled, (state, action) => {
        state.loading = false;
        if (state.user) {
          state.user = {
            ...state.user,
            cvSkills: action.payload.data.cvSkills || [],
          };
          saveAuthState(state.user, state.isAuthenticated);
        }
      })
      .addCase(getCVSkills.rejected, (state) => {
        state.loading = false;
      })

      // LOGIN
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.data;
        state.isAuthenticated = true;
        state.hydrated = true;
        state.lastVerified = Date.now();
        saveAuthState(state.user, state.isAuthenticated);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.hydrated = true;
      })

      // LOGOUT
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        Object.assign(state, defaultState(), { hydrated: true });
        localStorage.removeItem("authState");
      })
      .addCase(logoutUser.rejected, (state) => {
        Object.assign(state, defaultState(), { hydrated: true });
        localStorage.removeItem("authState");
      })

      // GET CURRENT USER
      .addCase(getCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.data;
        state.isAuthenticated = true;
        state.hydrated = true;
        state.lastVerified = Date.now();
        saveAuthState(state.user, state.isAuthenticated);
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.loading = false;
        state.hydrated = true;

        // Only clear the session on a confirmed 401.
        // If the request fails for any other reason (network, 500, etc.)
        // we keep the existing session intact.
        // Additionally, if the session was verified very recently (e.g. right
        // after registration), we don't clear it — the cookie is valid even
        // if this verification call failed due to a race condition.
        const is401 = action.payload?.status === 401;
        const isRecent = isRecentSession(state.lastVerified);

        if (is401 && !isRecent) {
          state.user = null;
          state.isAuthenticated = false;
          state.lastVerified = null;
          localStorage.removeItem("authState");
        }
      })

      // UPDATE USER
      .addCase(updateUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.loading = false;
        if (state.user) {
          state.user = { ...state.user, ...action.payload.data };
          saveAuthState(state.user, state.isAuthenticated);
        }
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setAuthHydrated, clearError, updateUserLocal, clearSession } =
  authSlice.actions;

export default authSlice.reducer;
