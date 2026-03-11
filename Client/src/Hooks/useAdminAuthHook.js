import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  loginAdmin,
  logoutAdmin,
  fetchAdminProfile,
  refreshAdminToken,
  clearError,
  clearAdmin,
} from "../API/aminAuthApi";

const useAdminAuth = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { admin, accessToken, loading, error } = useSelector(
    (state) => state.adminAuth,
  );

  const login = async (email, password) => {
    const result = await dispatch(loginAdmin({ email, password }));
    if (loginAdmin.fulfilled.match(result)) {
      navigate("/admin/dashboard", { replace: true });
    }
    return result;
  };

  const logout = async () => {
    await dispatch(logoutAdmin());
    navigate("/admin/login", { replace: true });
  };

  const getProfile = () => dispatch(fetchAdminProfile());

  const refreshToken = () => dispatch(refreshAdminToken());

  const resetError = () => dispatch(clearError());

  const reset = () => dispatch(clearAdmin());

  const isAuthenticated = !!accessToken;

  return {
    admin,
    accessToken,
    loading,
    error,
    isAuthenticated,
    login,
    logout,
    getProfile,
    refreshToken,
    resetError,
    reset,
  };
};

export default useAdminAuth;
