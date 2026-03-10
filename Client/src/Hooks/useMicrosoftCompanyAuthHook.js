import { useDispatch, useSelector } from "react-redux";
import {
  initiateMicrosoftLogin,
  fetchMicrosoftSession,
  logoutMicrosoftCompany,
  clearMicrosoftError,
  clearWelcomeMessage,
  clearMicrosoftSession,
  updateMicrosoftCompanyLocal,
} from "../API/microsoftAuthApi";

/**
 * useMicrosoftAuth
 *
 * Mirrors the shape of useCompany so both hooks are interchangeable.
 */
export const useMicrosoftAuth = () => {
  const dispatch = useDispatch();

  const {
    company,
    isAuthenticated,
    loading,
    redirecting,
    error,
    hydrated,
    welcomeMessage,
    lastVerified,
  } = useSelector((state) => state.microsoftAuth);

  return {
    // ── State ────────────────────────────────────────────────────────────────
    company,
    isAuthenticated,
    loading,
    redirecting,
    error,
    hydrated,
    welcomeMessage,
    lastVerified,
    role: company?.role ?? "guest",

    // ── Async actions ────────────────────────────────────────────────────────

    loginWithMicrosoft: () => dispatch(initiateMicrosoftLogin()),

    /**
     * Call this inside the frontend /callback route component.
     * Hits /api/v1/company/auth/me — cookies are already set by backend.
     */
    fetchSession: () => dispatch(fetchMicrosoftSession()),

    logout: () => dispatch(logoutMicrosoftCompany()),

    // ── Sync actions ─────────────────────────────────────────────────────────
    clearError: () => dispatch(clearMicrosoftError()),
    clearWelcomeMessage: () => dispatch(clearWelcomeMessage()),
    clearSession: () => dispatch(clearMicrosoftSession()),
    updateCompanyLocal: (data) => dispatch(updateMicrosoftCompanyLocal(data)),
  };
};
