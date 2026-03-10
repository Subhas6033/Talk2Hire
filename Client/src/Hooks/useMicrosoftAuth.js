import { useDispatch, useSelector } from "react-redux";
import {
  initiateMicrosoftUserLogin,
  fetchMicrosoftUserSession,
  logoutMicrosoftUser,
  clearMicrosoftUserError,
  clearMicrosoftUserWelcome,
  clearMicrosoftUserSession,
  updateMicrosoftUserLocal,
} from "../API/microsoftUserApi";

export const useMicrosoftUserAuth = () => {
  const dispatch = useDispatch();

  const {
    user,
    isAuthenticated,
    loading,
    redirecting,
    error,
    hydrated,
    welcomeMessage,
    isNewUser,
    lastVerified,
  } = useSelector((state) => state.microsoftUserAuth);

  return {
    // ── State ─────────────────────────────────────────────────────────────────
    user,
    isAuthenticated,
    loading,
    /** true while browser is navigating to Microsoft's login page */
    redirecting,
    error,
    hydrated,
    welcomeMessage,
    /** true if this is the user's very first login (account just created) */
    isNewUser,
    lastVerified,
    role: user?.role ?? "guest",

    // ── Async actions ─────────────────────────────────────────────────────────

    /** Redirects to GET /api/auth/v1/user/microsoft */
    loginWithMicrosoft: () => dispatch(initiateMicrosoftUserLogin()),

    /**
     * Call inside the frontend /user/microsoft/callback route.
     * Hits /auth/get-current-user — JWT cookies already set by backend.
     */
    fetchSession: () => dispatch(fetchMicrosoftUserSession()),

    logout: () => dispatch(logoutMicrosoftUser()),

    // ── Sync actions ──────────────────────────────────────────────────────────
    clearError: () => dispatch(clearMicrosoftUserError()),
    clearWelcomeMessage: () => dispatch(clearMicrosoftUserWelcome()),
    clearSession: () => dispatch(clearMicrosoftUserSession()),
    updateUserLocal: (data) => dispatch(updateMicrosoftUserLocal(data)),
  };
};
