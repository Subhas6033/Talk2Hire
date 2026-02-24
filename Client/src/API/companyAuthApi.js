import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "./api";

export const registerCompany = createAsyncThunk(
  "company/register",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await api.post("/company/auth/register", formData, {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const loginCompany = createAsyncThunk(
  "company/login",
  async ({ companyMail, password }, { rejectWithValue }) => {
    try {
      const response = await api.post(
        "/company/auth/login",
        { companyMail, password },
        { withCredentials: true },
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const logoutCompany = createAsyncThunk(
  "company/logout",
  async (_, { rejectWithValue }) => {
    try {
      await api.post("/company/auth/logout", {}, { withCredentials: true });
      return null;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const getCurrentCompany = createAsyncThunk(
  "company/getCurrent",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/company/auth/me", {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      // Pass the status code through so the reducer can act on it
      return rejectWithValue({
        message: error.response?.data?.message || "Not authenticated",
        status: error.response?.status,
      });
    }
  },
);

export const updateCompany = createAsyncThunk(
  "company/update",
  async (data, { rejectWithValue }) => {
    try {
      const response = await api.patch("/company/auth/update-details", data, {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const updateCompanyLogo = createAsyncThunk(
  "company/updateLogo",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await api.patch("/company/auth/update-logo", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

const saveCompanyState = (company, isAuthenticated) => {
  try {
    localStorage.setItem(
      "companyAuthState",
      JSON.stringify({ company, isAuthenticated, lastVerified: Date.now() }),
    );
  } catch (err) {
    console.error("Failed to save company auth state:", err);
  }
};

const loadCompanyState = () => {
  try {
    const serialized = localStorage.getItem("companyAuthState");
    if (!serialized) return defaultState();

    const parsed = JSON.parse(serialized);
    return {
      company: parsed.company || null,
      isAuthenticated: parsed.isAuthenticated || false,
      loading: false,
      error: null,
      hydrated: true,
      lastVerified: parsed.lastVerified || null,
    };
  } catch (err) {
    console.error("Failed to load company auth state:", err);
    localStorage.removeItem("companyAuthState");
    return defaultState();
  }
};

const defaultState = () => ({
  company: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  hydrated: true,
  lastVerified: null,
});

const companySlice = createSlice({
  name: "company",
  initialState: loadCompanyState(),
  reducers: {
    clearCompanyError: (state) => {
      state.error = null;
    },
    updateCompanyLocal: (state, action) => {
      if (state.company) {
        state.company = { ...state.company, ...action.payload };
        saveCompanyState(state.company, state.isAuthenticated);
      }
    },
    clearCompanySession: (state) => {
      state.company = null;
      state.isAuthenticated = false;
      state.lastVerified = null;
      state.error = null;
      localStorage.removeItem("companyAuthState");
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(registerCompany.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerCompany.fulfilled, (state, action) => {
        state.loading = false;
        state.company = action.payload.data;
        state.isAuthenticated = true;
        state.hydrated = true;
        state.lastVerified = Date.now();
        saveCompanyState(state.company, true);
      })
      .addCase(registerCompany.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.hydrated = true;
      })

      .addCase(loginCompany.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginCompany.fulfilled, (state, action) => {
        state.loading = false;
        state.company = action.payload.data;
        state.isAuthenticated = true;
        state.hydrated = true;
        state.lastVerified = Date.now();
        saveCompanyState(state.company, true);
      })
      .addCase(loginCompany.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.hydrated = true;
      })

      .addCase(logoutCompany.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutCompany.fulfilled, (state) => {
        Object.assign(state, defaultState(), { hydrated: true });
        localStorage.removeItem("companyAuthState");
      })
      .addCase(logoutCompany.rejected, (state) => {
        Object.assign(state, defaultState(), { hydrated: true });
        localStorage.removeItem("companyAuthState");
      })

      .addCase(getCurrentCompany.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCurrentCompany.fulfilled, (state, action) => {
        state.loading = false;
        state.company = action.payload.data;
        state.isAuthenticated = true;
        state.hydrated = true;
        state.lastVerified = Date.now();
        saveCompanyState(state.company, true);
      })
      .addCase(getCurrentCompany.rejected, (state, action) => {
        state.loading = false;
        state.hydrated = true;

        // Only clear auth on a confirmed 401 (token invalid/expired).
        // Any other failure (network error, 500) keeps the existing session
        // so the user is not logged out due to a transient server error.
        if (action.payload?.status === 401) {
          state.company = null;
          state.isAuthenticated = false;
          state.lastVerified = null;
          localStorage.removeItem("companyAuthState");
        }
      })

      .addCase(updateCompany.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCompany.fulfilled, (state, action) => {
        state.loading = false;
        state.company = action.payload.data;
        saveCompanyState(state.company, state.isAuthenticated);
      })
      .addCase(updateCompany.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(updateCompanyLogo.pending, (state) => {
        state.error = null;
      })
      .addCase(updateCompanyLogo.fulfilled, (state, action) => {
        if (state.company) {
          state.company.logo = action.payload.data?.logo;
          saveCompanyState(state.company, state.isAuthenticated);
        }
      })
      .addCase(updateCompanyLogo.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { clearCompanyError, updateCompanyLocal, clearCompanySession } =
  companySlice.actions;

export default companySlice.reducer;
