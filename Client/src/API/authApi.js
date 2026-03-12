import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "./api";

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

export const googleLoginUser = createAsyncThunk(
  "auth/googleLogin",
  async (credentialResponse, { rejectWithValue }) => {
    try {
      const response = await api.post(
        "/auth/google",
        { token: credentialResponse.credential },
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
      return { ...response.data, _sentEmail: email };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const verifyOtp = createAsyncThunk(
  "auth/verifyOtp",
  async ({ email, otp }, { rejectWithValue }) => {
    try {
      const response = await api.post(
        "/auth/verify-password",
        { email, otp },
        { withCredentials: true },
      );
      const verified = response.data?.verified ?? response.data?.data?.verified;
      if (verified) return response.data;
      return rejectWithValue("OTP verification failed. Please try again.");
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Invalid or expired OTP.",
      );
    }
  },
);

export const regUploadResume = createAsyncThunk(
  "auth/regUploadResume",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/upload-resume", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const regPollStatus = createAsyncThunk(
  "auth/regPollStatus",
  async (sessionId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/auth/extraction-status/${sessionId}`, {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const regSendOtp = createAsyncThunk(
  "auth/regSendOtp",
  async (sessionId, { rejectWithValue }) => {
    try {
      const response = await api.post(
        "/auth/send-registration-otp",
        { sessionId },
        { withCredentials: true },
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const regVerifyOtp = createAsyncThunk(
  "auth/regVerifyOtp",
  async ({ sessionId, otp }, { rejectWithValue }) => {
    try {
      const response = await api.post(
        "/auth/verify-registration-otp",
        { sessionId, otp },
        { withCredentials: true },
      );
      const verified = response.data?.verified ?? response.data?.data?.verified;
      if (verified) return response.data;
      return rejectWithValue("OTP verification failed. Please try again.");
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Invalid or expired OTP.",
      );
    }
  },
);

export const regComplete = createAsyncThunk(
  "auth/regComplete",
  async (
    { sessionId, fullName, email, mobile, location, skills },
    { rejectWithValue },
  ) => {
    try {
      const response = await api.post(
        "/auth/complete-registration",
        { sessionId, fullName, email, mobile, location, skills },
        { withCredentials: true },
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
    const pendingAutofill = localStorage.getItem("pendingAutofillEmail");
    if (!serialized) return defaultState();
    const parsed = JSON.parse(serialized);
    if (pendingAutofill) {
      return {
        ...defaultState(),
        hydrated: true,
      };
    }
    return {
      ...defaultState(),
      user: parsed.user || null,
      isAuthenticated: parsed.isAuthenticated || false,
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
  forgotPasswordLoading: false,
  forgotPasswordError: null,
  forgotPasswordSuccess: false,
  forgotPasswordEmail: null,
  otpLoading: false,
  otpError: null,
  otpVerified: false,
  googleLoading: false,
  googleError: null,
  regStep: "idle",
  regLoading: false,
  regError: null,
  regSessionId: null,
  regExtractedData: null,
  regMaskedEmail: null,
  pendingAutofillEmail: localStorage.getItem("pendingAutofillEmail") || null,
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
    clearGoogleError: (state) => {
      state.googleError = null;
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
    clearRegistration: (state) => {
      state.regStep = "idle";
      state.regLoading = false;
      state.regError = null;
      state.regSessionId = null;
      state.regExtractedData = null;
      state.regMaskedEmail = null;
    },
    setRegStep: (state, action) => {
      state.regStep = action.payload;
      state.regError = null;
    },
    setPendingAutofillEmail: (state, action) => {
      state.pendingAutofillEmail = action.payload;
      localStorage.setItem("pendingAutofillEmail", action.payload);
    },
    clearPendingAutofillEmail: (state) => {
      state.pendingAutofillEmail = null;
      localStorage.removeItem("pendingAutofillEmail");
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(getCVSkills.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCVSkills.fulfilled, (state, action) => {
        state.loading = false;
        if (state.user) {
          state.user = {
            ...state.user,
            cvSkills: action.payload.data?.cvSkills || [],
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

      .addCase(googleLoginUser.pending, (state) => {
        state.googleLoading = true;
        state.googleError = null;
      })
      .addCase(googleLoginUser.fulfilled, (state, action) => {
        state.googleLoading = false;
        state.user = action.payload.data;
        state.isAuthenticated = true;
        state.hydrated = true;
        state.lastVerified = Date.now();
        saveAuthState(state.user, state.isAuthenticated);
      })
      .addCase(googleLoginUser.rejected, (state, action) => {
        state.googleLoading = false;
        state.googleError = action.payload;
      })

      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        const pending = state.pendingAutofillEmail;
        Object.assign(state, defaultState(), { hydrated: true });
        state.pendingAutofillEmail = pending;
        localStorage.removeItem("authState");
      })
      .addCase(logoutUser.rejected, (state) => {
        const pending = state.pendingAutofillEmail;
        Object.assign(state, defaultState(), { hydrated: true });
        state.pendingAutofillEmail = pending;
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

      .addCase(forgotPassword.pending, (state) => {
        state.forgotPasswordLoading = true;
        state.forgotPasswordError = null;
        state.forgotPasswordSuccess = false;
      })
      .addCase(forgotPassword.fulfilled, (state, action) => {
        state.forgotPasswordLoading = false;
        state.forgotPasswordSuccess = true;
        state.forgotPasswordEmail = action.payload?._sentEmail ?? null;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.forgotPasswordLoading = false;
        state.forgotPasswordError = action.payload;
      })

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
      })

      .addCase(regUploadResume.pending, (state) => {
        state.regStep = "uploading";
        state.regLoading = true;
        state.regError = null;
      })
      .addCase(regUploadResume.fulfilled, (state, action) => {
        state.regLoading = false;
        state.regSessionId = action.payload.data?.sessionId ?? null;
        state.regStep = "extracting";
      })
      .addCase(regUploadResume.rejected, (state, action) => {
        state.regLoading = false;
        state.regStep = "idle";
        state.regError = action.payload;
      })

      .addCase(regPollStatus.fulfilled, (state, action) => {
        const { status, extractedData, error } = action.payload.data || {};
        if (status === "completed") {
          state.regExtractedData = extractedData;
        } else if (status === "failed") {
          state.regStep = "idle";
          state.regError =
            error ||
            "Could not extract data from your resume. Please try again.";
        }
      })
      .addCase(regPollStatus.rejected, () => {})

      .addCase(regSendOtp.pending, (state) => {
        state.regLoading = true;
        state.regError = null;
      })
      .addCase(regSendOtp.fulfilled, (state, action) => {
        state.regLoading = false;
        state.regMaskedEmail =
          action.payload.data?.email ?? action.payload?.email ?? null;
        state.regStep = "otp_sent";
      })
      .addCase(regSendOtp.rejected, (state, action) => {
        state.regLoading = false;
        state.regError = action.payload;
      })

      .addCase(regVerifyOtp.pending, (state) => {
        state.regLoading = true;
        state.regError = null;
      })
      .addCase(regVerifyOtp.fulfilled, (state) => {
        state.regLoading = false;
        state.regStep = "otp_verified";
      })
      .addCase(regVerifyOtp.rejected, (state, action) => {
        state.regLoading = false;
        state.regError = action.payload;
      })

      .addCase(regComplete.pending, (state) => {
        state.regStep = "completing";
        state.regLoading = true;
        state.regError = null;
      })
      .addCase(regComplete.fulfilled, (state, action) => {
        state.user = action.payload.data;
        state.isAuthenticated = true;
        state.hydrated = true;
        state.lastVerified = Date.now();
        saveAuthState(state.user, state.isAuthenticated);
        state.regStep = "idle";
        state.regLoading = false;
        state.regSessionId = null;
        state.regExtractedData = null;
        state.regMaskedEmail = null;
        state.regError = null;
      })
      .addCase(regComplete.rejected, (state, action) => {
        state.regLoading = false;
        state.regStep = "otp_verified";
        state.regError = action.payload;
      });
  },
});

export const {
  setAuthHydrated,
  clearError,
  clearGoogleError,
  updateUserLocal,
  clearSession,
  clearForgotPassword,
  clearOtp,
  clearRegistration,
  setRegStep,
  setPendingAutofillEmail,
  clearPendingAutofillEmail,
} = authSlice.actions;

export default authSlice.reducer;
