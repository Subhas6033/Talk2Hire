import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  loginUser,
  googleLoginUser,
  logoutUser,
  clearError,
  clearGoogleError,
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
  setPendingAutofillEmail,
  clearPendingAutofillEmail,
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
    googleLoading,
    googleError,
    regStep,
    regLoading,
    regError,
    regSessionId,
    regExtractedData,
    regMaskedEmail,
    pendingAutofillEmail,
  } = useSelector((state) => state.auth);

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
    user,
    isAuthenticated,
    hydrated,
    role: user?.role ?? "guest",
    loading,
    error,
    forgotPasswordLoading,
    forgotPasswordError,
    forgotPasswordSuccess,
    forgotPasswordEmail,
    otpLoading,
    otpError,
    otpVerified,
    passwordLoading,
    passwordError,
    passwordReset,
    verifyPasswordLoading: otpLoading || passwordLoading,
    verifyPasswordError: otpError || passwordError,
    googleLoading,
    googleError,
    regStep,
    regLoading,
    regError,
    regSessionId,
    regExtractedData,
    regMaskedEmail,
    pendingAutofillEmail,
    login: (data) => dispatch(loginUser(data)),
    loginWithGoogle: (credentialResponse) =>
      dispatch(googleLoginUser(credentialResponse)),
    logout: () => dispatch(logoutUser()),
    updateUser: (data) => dispatch(updateUser(data)),
    getCurrentUser: () => dispatch(getCurrentUser()),
    getCVSkills: () => dispatch(getCVSkills()),
    forgotPassword: (email) => dispatch(forgotPassword(email)),
    verifyOtp: (email, otp) => dispatch(verifyOtpThunk({ email, otp })),
    updatePassword,
    resetState,
    regUploadResume: (formData) => dispatch(regUploadResume(formData)),
    regPollStatus: (sessionId) => dispatch(regPollStatus(sessionId)),
    regSendOtp: (sessionId) => dispatch(regSendOtp(sessionId)),
    regVerifyOtp: (sessionId, otp) =>
      dispatch(regVerifyOtp({ sessionId, otp })),
    regComplete: (data) => dispatch(regComplete(data)),
    clearRegistration: () => dispatch(clearRegistration()),
    setRegStep: (step) => dispatch(setRegStep(step)),
    setPendingAutofillEmail: (email) =>
      dispatch(setPendingAutofillEmail(email)),
    clearPendingAutofillEmail: () => dispatch(clearPendingAutofillEmail()),
    clearError: () => dispatch(clearError()),
    clearGoogleError: () => dispatch(clearGoogleError()),
    updateUserLocal: (data) => dispatch(updateUserLocal(data)),
    clearSession: () => dispatch(clearSession()),
    clearForgotPassword: () => dispatch(clearForgotPassword()),
    clearOtp: () => dispatch(clearOtp()),
  };
};
