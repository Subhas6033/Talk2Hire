import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "./api";

// Register User
export const registerUser = createAsyncThunk(
  "auth/register",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/register", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

// Get CV Skills
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

// Login User
export const loginUser = createAsyncThunk(
  "auth/login",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await api.post(
        "/auth/login",
        { email, password },
        { withCredentials: true },
      );
      console.log("Login response:", response.data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

// Logout User
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

// Get Current User (verify session)
export const getCurrentUser = createAsyncThunk(
  "auth/getCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/auth/get-current-user", {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Not authenticated",
      );
    }
  },
);

// Update User Profile
export const updateUser = createAsyncThunk(
  "auth/updateUser",
  async (userData, { rejectWithValue }) => {
    try {
      const isFormData = userData instanceof FormData;

      const config = {
        withCredentials: true,
        ...(isFormData && {
          headers: {
            "Content-Type": "multipart/form-data",
          },
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

// Save to localStorage (user data only, NO tokens)
const saveAuthState = (user, isAuthenticated) => {
  try {
    const authState = {
      user,
      isAuthenticated,
      lastVerified: Date.now(),
    };
    localStorage.setItem("authState", JSON.stringify(authState));
  } catch (err) {
    console.error("Failed to save auth state:", err);
  }
};

// Load from localStorage
const loadStateFromStorage = () => {
  try {
    const serializedState = localStorage.getItem("authState");
    if (!serializedState) {
      return {
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null,
        hydrated: false,
        lastVerified: null,
      };
    }

    const parsedState = JSON.parse(serializedState);

    return {
      user: parsedState.user || null,
      isAuthenticated: parsedState.isAuthenticated || false,
      loading: false,
      error: null,
      hydrated: false,
      lastVerified: parsedState.lastVerified || null,
    };
  } catch (err) {
    console.error("Failed to load auth state:", err);
    localStorage.removeItem("authState");
    return {
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      hydrated: false,
      lastVerified: null,
    };
  }
};

const initialState = loadStateFromStorage();

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Mark state as hydrated
    setAuthHydrated: (state) => {
      state.hydrated = true;
    },

    // Clear any errors
    clearError: (state) => {
      state.error = null;
    },

    // Update user locally without API call
    updateUserLocal: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        saveAuthState(state.user, state.isAuthenticated);
      }
    },

    // Clear session (force logout)
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
      // ========== REGISTER ==========
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        // Backend returns user data (tokens are in httpOnly cookies)
        state.user = action.payload.data;
        state.isAuthenticated = true;
        state.hydrated = true;
        state.lastVerified = Date.now();

        // Save user data to localStorage (NO tokens)
        saveAuthState(state.user, state.isAuthenticated);
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.hydrated = true;
      })

      // ========== GET CV SKILLS ==========
      .addCase(getCVSkills.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCVSkills.fulfilled, (state, action) => {
        state.loading = false;
        // Update user object with CV skills
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
        // Keep existing user data, just don't update CV skills
      })

      // ========== LOGIN ==========
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        // Backend returns user data (tokens are in httpOnly cookies)
        state.user = action.payload.data;
        state.isAuthenticated = true;
        state.hydrated = true;
        state.lastVerified = Date.now();

        // Save user data to localStorage (NO tokens)
        saveAuthState(state.user, state.isAuthenticated);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.hydrated = true;
      })

      // ========== LOGOUT ==========
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.hydrated = true;
        state.lastVerified = null;

        // Clear localStorage
        localStorage.removeItem("authState");
      })
      .addCase(logoutUser.rejected, (state) => {
        // Even if API fails, logout locally
        state.loading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.lastVerified = null;

        // Clear localStorage
        localStorage.removeItem("authState");
      })

      // ========== GET CURRENT USER ==========
      .addCase(getCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.data;
        state.isAuthenticated = true;
        state.hydrated = true;
        state.lastVerified = Date.now();

        // Update localStorage with fresh data
        saveAuthState(state.user, state.isAuthenticated);
      })
      .addCase(getCurrentUser.rejected, (state) => {
        // Session invalid - clear everything
        state.loading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.hydrated = true;
        state.lastVerified = null;
        localStorage.removeItem("authState");
      })

      // ========== UPDATE USER ==========
      .addCase(updateUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.loading = false;
        if (state.user) {
          state.user = { ...state.user, ...action.payload.data };

          // Update localStorage
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
