import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "./api";

export const forgotPassword = createAsyncThunk(
  "password/forgotPassword",
  async ({ email }, { rejectWithValue }) => {
    try {
      const response = await api.post("/api/v1/auth/forgot-password", {
        email,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const verifyResetPasswordOTP = createAsyncThunk(
  "password/verifyResetPasswordOTP",
  async ({ email, otp }, { rejectWithValue }) => {
    try {
      const response = await api.post("/api/v1/auth/verify-password", {
        email,
        otp,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const resetPassword = createAsyncThunk(
  "password/resetPassword",
  async ({ email, newPassword, confirmPassword }, { rejectWithValue }) => {
    try {
      const response = await api.put("/api/v1/auth/update-password", {
        email,
        newPassword,
        confirmPassword,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

const initialState = {
  loading: false,
  error: null,
  otpVerified: false,
  passwordResetSuccess: false,
};

const passwordSlice = createSlice({
  name: "password",
  initialState,
  reducers: {
    resetPasswordState: (state) => {
      state.loading = false;
      state.error = null;
      state.otpVerified = false;
      state.passwordResetSuccess = false;
    },
  },

  extraReducers: (builder) => {
    builder
      //   Forgot password
      .addCase(forgotPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(forgotPassword.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      //   Verify OTP
      .addCase(verifyResetPasswordOTP.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyResetPasswordOTP.fulfilled, (state) => {
        state.loading = false;
        state.otpVerified = true;
      })
      .addCase(verifyResetPasswordOTP.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.otpVerified = false;
      })

      //   Reset password
      .addCase(resetPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.loading = false;
        state.passwordResetSuccess = true;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { resetPasswordState } = passwordSlice.actions;
export default passwordSlice.reducer;
