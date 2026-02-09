import { useDispatch, useSelector } from "react-redux";
import {
  registerUser,
  loginUser,
  logoutUser,
  clearError,
  updateUser,
  updateUserLocal,
  verifyAuth,
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

    // ✅ Async actions - return promises that support .unwrap()
    registerUser: (data) => dispatch(registerUser(data)),
    login: (data) => dispatch(loginUser(data)),
    logout: () => dispatch(logoutUser()),
    updateUser: (data) => dispatch(updateUser(data)), // ✅ Now supports .unwrap()
    verifyAuth: () => dispatch(verifyAuth()),

    // ✅ Synchronous actions - don't support .unwrap()
    clearError: () => dispatch(clearError()),
    updateUserLocal: (data) => dispatch(updateUserLocal(data)), // Local-only update
  };
};
