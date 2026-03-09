import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
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
  regUploadResume,
  regPollStatus,
  regSendOtp,
  regVerifyOtp,
  regComplete,
  clearRegistration,
  setRegStep,
} from "../API/authApi";
import api from "../API/api";

export const useAuth = () => {
  const dispatch = useDispatch();

  const {
    // ── Core auth ─────────────────────────────────────────────────────────────
    user,
    isAuthenticated,
    loading,
    error,
    hydrated,

    // ── Forgot-password ───────────────────────────────────────────────────────
    forgotPasswordLoading,
    forgotPasswordError,
    forgotPasswordSuccess,
    forgotPasswordEmail,

    // ── OTP (forgot-password flow) ────────────────────────────────────────────
    otpLoading,
    otpError,
    otpVerified,

    // ── Registration wizard ───────────────────────────────────────────────────
    regStep,
    regLoading,
    regError,
    regSessionId,
    regExtractedData,
    regMaskedEmail,
    // NOTE: regSuggestedPassword removed — generated client-side in RegistrationForm
  } = useSelector((state) => state.auth);

  // ── Reset-password local state ─────────────────────────────────────────────
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

    // ── Main loading / error ──────────────────────────────────────────────────
    loading,
    error,

    // ── Forgot-password state ─────────────────────────────────────────────────
    forgotPasswordLoading,
    forgotPasswordError,
    forgotPasswordSuccess,
    forgotPasswordEmail,

    // ── OTP + reset-password state ────────────────────────────────────────────
    otpLoading,
    otpError,
    otpVerified,
    passwordLoading,
    passwordError,
    passwordReset,
    verifyPasswordLoading: otpLoading || passwordLoading,
    verifyPasswordError: otpError || passwordError,

    // ── Registration wizard state ─────────────────────────────────────────────
    // regStep: 'idle' | 'uploading' | 'extracting' | 'otp_sent' | 'otp_verified' | 'completing'
    regStep,
    regLoading,
    regError,
    regSessionId,
    regExtractedData, // { email, fullName, mobile, location, cvSkills }
    regMaskedEmail, // masked email shown on OTP screen e.g. "jo***@gmail.com"
    // regSuggestedPassword removed — generated client-side in RegistrationForm

    // ── Actions ───────────────────────────────────────────────────────────────
    login: (data) => dispatch(loginUser(data)),
    logout: () => dispatch(logoutUser()),
    updateUser: (data) => dispatch(updateUser(data)),
    getCurrentUser: () => dispatch(getCurrentUser()),
    getCVSkills: () => dispatch(getCVSkills()),
    forgotPassword: (email) => dispatch(forgotPassword(email)),
    verifyOtp: (email, otp) => dispatch(verifyOtpThunk({ email, otp })),
    updatePassword,
    resetState,

    // ── Registration wizard actions ───────────────────────────────────────────
    regUploadResume: (formData) => dispatch(regUploadResume(formData)),
    regPollStatus: (sessionId) => dispatch(regPollStatus(sessionId)),
    regSendOtp: (sessionId) => dispatch(regSendOtp(sessionId)),
    regVerifyOtp: (sessionId, otp) =>
      dispatch(regVerifyOtp({ sessionId, otp })),
    regComplete: (data) => dispatch(regComplete(data)),
    clearRegistration: () => dispatch(clearRegistration()),
    setRegStep: (step) => dispatch(setRegStep(step)),

    // ── Utility ───────────────────────────────────────────────────────────────
    clearError: () => dispatch(clearError()),
    updateUserLocal: (data) => dispatch(updateUserLocal(data)),
    clearSession: () => dispatch(clearSession()),
    clearForgotPassword: () => dispatch(clearForgotPassword()),
    clearOtp: () => dispatch(clearOtp()),
  };
};
