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
} from "../API/authApi";

export const useAuth = () => {
  const dispatch = useDispatch();

  const { user, isAuthenticated, loading, error, hydrated } = useSelector(
    (state) => state.auth,
  );

  return {
    user,
    isAuthenticated,
    loading,
    error,
    hydrated,
    role: user?.role ?? "guest",

    registerUser: (data) => dispatch(registerUser(data)),
    login: (data) => dispatch(loginUser(data)),
    logout: () => dispatch(logoutUser()),
    updateUser: (data) => dispatch(updateUser(data)),
    getCurrentUser: () => dispatch(getCurrentUser()),
    getCVSkills: () => dispatch(getCVSkills()),

    clearError: () => dispatch(clearError()),
    updateUserLocal: (data) => dispatch(updateUserLocal(data)),
    clearSession: () => dispatch(clearSession()),
  };
};
