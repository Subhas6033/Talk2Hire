import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  loginAdmin,
  logoutAdmin,
  fetchAdminProfile,
  refreshAdminToken,
  clearError,
  clearAdmin,
  markActivity,
  scheduleProactiveRefresh,
} from "../API/adminAuthApi";

// Activity events that count as "user is present"
const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
];

const useAdminAuth = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { admin, accessToken, loading, error } = useSelector(
    (state) => state.adminAuth,
  );

  // ── Wire up activity tracking & proactive refresh on mount ─────────────────
  useEffect(() => {
    if (!accessToken) return;

    // Mark activity on any user interaction
    const handleActivity = () => markActivity();
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: true }),
    );

    // Mark activity immediately (component just mounted = user is here)
    markActivity();

    // Kick off proactive refresh cycle
    scheduleProactiveRefresh();

    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, handleActivity),
      );
    };
  }, [accessToken]);

  // ── On page load: if we have a refresh token, restore the session ───────────
  // (handles page refresh — access token may have expired but refresh is still valid)
  useEffect(() => {
    if (accessToken) {
      dispatch(fetchAdminProfile());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
