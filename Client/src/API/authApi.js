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

export const forgotPassword = createAsyncThunk(
  "auth/forgotPassword",
  async (email, { rejectWithValue }) => {
    try {
      const response = await api.post(
        "/auth/forgot-password",
        { email },
        { withCredentials: true },
      );
      // Always attach the email we sent with — guaranteed regardless of
      // what the response shape looks like after any axios interceptor
      return { ...response.data, _sentEmail: email };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

// Verify OTP
export const verifyOtp = createAsyncThunk(
  "auth/verifyOtp",
  async ({ email, otp }, { rejectWithValue }) => {
    try {
      const response = await api.post(
        "/auth/verify-password",
        { email, otp },
        { withCredentials: true },
      );
      // After axios interceptor unwraps response.data:
      //   response.data = { verified: true }  (interceptor already stripped the wrapper)
      // Without interceptor:
      //   response.data = { statusCode, data: { verified: true }, message }
      const verified = response.data?.verified ?? response.data?.data?.verified;
      if (verified) {
        return response.data;
      }
      return rejectWithValue("OTP verification failed. Please try again.");
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Invalid or expired OTP.",
      );
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

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
      forgotPasswordLoading: false,
      forgotPasswordError: null,
      forgotPasswordSuccess: false,
      forgotPasswordEmail: null,
      otpLoading: false,
      otpError: null,
      otpVerified: false,
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
  // Forgot-password dedicated state
  forgotPasswordLoading: false,
  forgotPasswordError: null,
  forgotPasswordSuccess: false,
  // Email returned by forgotPassword — consumed by VerifyPassword page
  forgotPasswordEmail: null,
  // OTP verification dedicated state
  otpLoading: false,
  otpError: null,
  otpVerified: false,
});

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
    clearForgotPassword: (state) => {
      state.forgotPasswordLoading = false;
      state.forgotPasswordError = null;
      state.forgotPasswordSuccess = false;
      state.forgotPasswordEmail = null;
    },
    clearOtp: (state) => {
      state.otpLoading = false;
      state.otpError = null;
      state.otpVerified = false;
    },
  },

  extraReducers: (builder) => {
    builder
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

      .addCase(getCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = { ...state.user, ...action.payload.data };
        state.isAuthenticated = true;
        state.hydrated = true;
        state.lastVerified = Date.now();
        saveAuthState(state.user, state.isAuthenticated);
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.loading = false;
        state.hydrated = true;

        const is401 = action.payload?.status === 401;
        const isRecent = isRecentSession(state.lastVerified);

        if (is401 && !isRecent) {
          state.user = null;
          state.isAuthenticated = false;
          state.lastVerified = null;
          localStorage.removeItem("authState");
        }
      })

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
      })

      // ── forgotPassword ──────────────────────────────────────────────────────
      .addCase(forgotPassword.pending, (state) => {
        state.forgotPasswordLoading = true;
        state.forgotPasswordError = null;
        state.forgotPasswordSuccess = false;
      })
      .addCase(forgotPassword.fulfilled, (state, action) => {
        state.forgotPasswordLoading = false;
        state.forgotPasswordSuccess = true;
        // _sentEmail is injected in the thunk from the original email arg —
        // this is the most reliable source regardless of interceptor shape.
        state.forgotPasswordEmail = action.payload?._sentEmail ?? null;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.forgotPasswordLoading = false;
        state.forgotPasswordError = action.payload;
      })

      // ── verifyOtp ───────────────────────────────────────────────────────────
      .addCase(verifyOtp.pending, (state) => {
        state.otpLoading = true;
        state.otpError = null;
        state.otpVerified = false;
      })
      .addCase(verifyOtp.fulfilled, (state) => {
        state.otpLoading = false;
        state.otpVerified = true;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.otpLoading = false;
        state.otpError = action.payload;
      });
  },
});

export const {
  setAuthHydrated,
  clearError,
  updateUserLocal,
  clearSession,
  clearForgotPassword,
  clearOtp,
} = authSlice.actions;

export default authSlice.reducer;
