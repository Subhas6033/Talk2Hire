import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  registerUser,
  loginUser,
  logoutUser,
  clearError,
  updateUser,
  updateUserLocal,
  getCurrentUser,
  clearSession,
  getCVSkills,
  forgotPassword,
  clearForgotPassword,
  verifyOtp as verifyOtpThunk,
  clearOtp,
} from "../API/authApi";
import api from "../API/api";

export const useAuth = () => {
  const dispatch = useDispatch();

  const {
    user,
    isAuthenticated,
    loading,
    error,
    hydrated,
    forgotPasswordLoading,
    forgotPasswordError,
    forgotPasswordSuccess,
    forgotPasswordEmail,
    otpLoading,
    otpError,
    otpVerified,
  } = useSelector((state) => state.auth);

  // updatePassword is scoped to the reset-password flow only — no need to
  // persist this in Redux, so local state lives here in the hook.
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordReset, setPasswordReset] = useState(false);

  const updatePassword = async (email, newPassword, confirmPassword) => {
    setPasswordLoading(true);
    setPasswordError(null);
    try {
      await api.put(
        "/auth/update-password",
        { email, newPassword, confirmPassword },
        { withCredentials: true },
      );
      setPasswordReset(true);
    } catch (err) {
      setPasswordError(
        err.response?.data?.message || "Failed to update password.",
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const resetState = () => {
    dispatch(clearOtp());
    setPasswordError(null);
    setPasswordReset(false);
  };

  return {
    // ── Auth state ────────────────────────────────────────────────────────────
    user,
    isAuthenticated,
    hydrated,
    role: user?.role ?? "guest",

    // ── Main loading / error (login, register, etc.) ──────────────────────────
    loading,
    error,

    // ── Forgot-password state ─────────────────────────────────────────────────
    forgotPasswordLoading,
    forgotPasswordError,
    forgotPasswordSuccess,
    // Email stored after forgotPassword succeeds — no need to re-enter on VerifyPassword page
    forgotPasswordEmail,

    // ── OTP + reset-password state ────────────────────────────────────────────
    otpLoading,
    otpError,
    otpVerified,
    passwordLoading,
    passwordError,
    passwordReset,
    // Merged helpers for VerifyPassword.jsx — single loading/error across both steps
    verifyPasswordLoading: otpLoading || passwordLoading,
    verifyPasswordError: otpError || passwordError,

    // ── Actions ───────────────────────────────────────────────────────────────
    registerUser: (data) => dispatch(registerUser(data)),
    login: (data) => dispatch(loginUser(data)),
    logout: () => dispatch(logoutUser()),
    updateUser: (data) => dispatch(updateUser(data)),
    getCurrentUser: () => dispatch(getCurrentUser()),
    getCVSkills: () => dispatch(getCVSkills()),
    forgotPassword: (email) => dispatch(forgotPassword(email)),
    verifyOtp: (email, otp) => dispatch(verifyOtpThunk({ email, otp })),
    updatePassword,
    resetState,

    // ── Utility ───────────────────────────────────────────────────────────────
    clearError: () => dispatch(clearError()),
    updateUserLocal: (data) => dispatch(updateUserLocal(data)),
    clearSession: () => dispatch(clearSession()),
    clearForgotPassword: () => dispatch(clearForgotPassword()),
    clearOtp: () => dispatch(clearOtp()),
  };
};
