import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "./api";

export const registerUser = createAsyncThunk(
  "auth/register",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/register", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const loginUser = createAsyncThunk(
  "auth/login",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/login", {
        email,
        password,
      });
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
      await api.post("/auth/logout");
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const getCurrentUser = createAsyncThunk(
  "auth/getCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/auth/get-current-user");
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Not authenticated",
      );
    }
  },
);

export const verifyAuth = createAsyncThunk(
  "auth/verify",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/auth/get-current-user");
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Not authenticated",
      );
    }
  },
);

// ✅ Update user (supports both FormData and regular JSON)
export const updateUser = createAsyncThunk(
  "auth/updateUser",
  async (userData, { rejectWithValue }) => {
    try {
      // Determine if we're sending FormData (for file uploads) or JSON
      const isFormData = userData instanceof FormData;

      const config = isFormData
        ? {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        : {};

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

// Load initial state from localStorage
const loadStateFromStorage = () => {
  try {
    const serializedState = localStorage.getItem("authState");
    if (serializedState === null) {
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
      ...parsedState,
      loading: false,
      error: null,
      hydrated: false,
    };
  } catch (err) {
    console.error("Failed to load auth state:", err);
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
    setAuthHydrated: (state) => {
      state.hydrated = true;
    },
    clearError: (state) => {
      state.error = null;
    },
    // ✅ OPTIONAL: Keep this for local-only updates (no backend call)
    updateUserLocal: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        localStorage.setItem(
          "authState",
          JSON.stringify({
            user: state.user,
            isAuthenticated: state.isAuthenticated,
            lastVerified: state.lastVerified,
          }),
        );
      }
    },
  },

  extraReducers: (builder) => {
    builder
      // registerUser
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
        localStorage.setItem(
          "authState",
          JSON.stringify({
            user: state.user,
            isAuthenticated: state.isAuthenticated,
            lastVerified: state.lastVerified,
          }),
        );
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.hydrated = true;
      })

      // login
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
        localStorage.setItem(
          "authState",
          JSON.stringify({
            user: state.user,
            isAuthenticated: state.isAuthenticated,
            lastVerified: state.lastVerified,
          }),
        );
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.hydrated = true;
      })

      // logout
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.hydrated = true;
        state.lastVerified = null;
        localStorage.removeItem("authState");
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.user = null;
        state.isAuthenticated = false;
        state.lastVerified = null;
        localStorage.removeItem("authState");
      })

      // get current user
      .addCase(getCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.data;
        state.isAuthenticated = true;
        state.hydrated = true;
        state.lastVerified = Date.now();
        localStorage.setItem(
          "authState",
          JSON.stringify({
            user: state.user,
            isAuthenticated: state.isAuthenticated,
            lastVerified: state.lastVerified,
          }),
        );
      })
      .addCase(getCurrentUser.rejected, (state) => {
        state.loading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.hydrated = true;
        state.lastVerified = null;
        localStorage.removeItem("authState");
      })

      // verify auth
      .addCase(verifyAuth.pending, (state) => {
        state.loading = true;
      })
      .addCase(verifyAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.data;
        state.isAuthenticated = true;
        state.hydrated = true;
        state.lastVerified = Date.now();
        localStorage.setItem(
          "authState",
          JSON.stringify({
            user: state.user,
            isAuthenticated: state.isAuthenticated,
            lastVerified: state.lastVerified,
          }),
        );
      })
      .addCase(verifyAuth.rejected, (state) => {
        state.loading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.hydrated = true;
        state.lastVerified = null;
        localStorage.removeItem("authState");
      })

      // ✅ updateUser async thunk handlers
      .addCase(updateUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.loading = false;
        if (state.user) {
          // Update user with response from backend
          state.user = { ...state.user, ...action.payload.data };
          localStorage.setItem(
            "authState",
            JSON.stringify({
              user: state.user,
              isAuthenticated: state.isAuthenticated,
              lastVerified: state.lastVerified,
            }),
          );
        }
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setAuthHydrated, clearError, updateUserLocal } =
  authSlice.actions;

export default authSlice.reducer;
