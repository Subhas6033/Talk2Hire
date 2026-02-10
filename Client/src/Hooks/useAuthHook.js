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
} from "../API/authApi";

export const useAuth = () => {
  const dispatch = useDispatch();

  const { user, isAuthenticated, accessToken, loading, error, hydrated } =
    useSelector((state) => state.auth);

  return {
    // State
    user,
    isAuthenticated,
    accessToken,
    loading,
    error,
    hydrated,

    //  Async actions
    registerUser: (data) => dispatch(registerUser(data)),
    login: (data) => dispatch(loginUser(data)),
    logout: () => dispatch(logoutUser()),
    updateUser: (data) => dispatch(updateUser(data)),
    getCurrentUser: () => dispatch(getCurrentUser()),

    //  Sync actions
    clearError: () => dispatch(clearError()),
    updateUserLocal: (data) => dispatch(updateUserLocal(data)),
    clearSession: () => dispatch(clearSession()),
  };
};
