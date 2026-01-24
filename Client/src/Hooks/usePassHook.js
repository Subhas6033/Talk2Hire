import { useDispatch, useSelector } from "react-redux";
import {
  forgotPassword,
  verifyResetPasswordOTP,
  resetPassword,
  resetPasswordState,
} from "../API/passwordApi";

export const usePassword = () => {
  const dispatch = useDispatch();

  const { loading, error, otpVerified, passwordResetSuccess } = useSelector(
    (state) => state.password
  );

  const sendForgotPasswordEmail = (email) => {
    return dispatch(forgotPassword({ email }));
  };

  const verifyOtp = (email, otp) => {
    return dispatch(verifyResetPasswordOTP({ email, otp }));
  };

  const updatePassword = (email, newPassword, confirmPassword) => {
    return dispatch(resetPassword({ email, newPassword, confirmPassword }));
  };

  const resetState = () => {
    dispatch(resetPasswordState());
  };

  return {
    loading,
    error,
    otpVerified,
    passwordResetSuccess,
    sendForgotPasswordEmail,
    verifyOtp,
    updatePassword,
    resetState,
  };
};
