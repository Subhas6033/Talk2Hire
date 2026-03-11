import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../Hooks/useAuthHook";
import { useCompany } from "../Hooks/useCompanyAuthHook";
import { useSelector } from "react-redux";
import { useEffect, useState } from "react";
import axios from "axios";
import Loader from "../Components/Loader/Loader";
import { useMicrosoftUserAuth } from "../Hooks/useMicrosoftAuth.js";
import { useMicrosoftAuth } from "../Hooks/useMicrosoftCompanyAuthHook.js";
import { markActivity, scheduleProactiveRefresh } from "../API/adminAuthApi.js";

const API = `${import.meta.env.VITE_BACKEND_URL}/api/v1/auth/admin`;

// ─── Cookie helpers (local — no import needed) ────────────────────────────────
const getCookie = (name) => {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
};
const setCookie = (name, value, maxAge) => {
  document.cookie = `${name}=${value}; path=/; SameSite=Strict; max-age=${maxAge}`;
};
const deleteCookie = (name) => {
  document.cookie = `${name}=; path=/; max-age=0`;
};

// ─── Unified auth hook (unchanged) ───────────────────────────────────────────
const useUnifiedAuth = () => {
  const {
    isAuthenticated: isUserAuth,
    hydrated: userHydrated,
    role: userRole,
  } = useAuth();
  const { isAuthenticated: isCompanyAuth, hydrated: companyHydrated } =
    useCompany();
  const {
    isAuthenticated: isMsUserAuth,
    hydrated: msUserHydrated,
    role: msUserRole,
  } = useMicrosoftUserAuth();
  const {
    isAuthenticated: isMsCompanyAuth,
    hydrated: msCompanyHydrated,
    role: msCompanyRole,
  } = useMicrosoftAuth();

  const isAuthenticated =
    isUserAuth || isCompanyAuth || isMsUserAuth || isMsCompanyAuth;
  const hydrated =
    userHydrated && companyHydrated && msUserHydrated && msCompanyHydrated;

  const role = isMsCompanyAuth
    ? (msCompanyRole ?? "company")
    : isCompanyAuth
      ? "company"
      : isMsUserAuth
        ? (msUserRole ?? "user")
        : isUserAuth
          ? userRole
          : "guest";

  return { hydrated, isAuthenticated, role };
};

// ─── Public Route ─────────────────────────────────────────────────────────────
export const PublicRoute = ({ children }) => {
  const { isAuthenticated, hydrated, role } = useUnifiedAuth();
  const pendingAutofillEmail = useSelector(
    (state) => state.auth.pendingAutofillEmail,
  );

  if (!hydrated) return <Loader label="Loading" />;
  if (pendingAutofillEmail) return children;

  if (isAuthenticated) {
    return <Navigate to={role === "company" ? "/company" : "/"} replace />;
  }

  return children;
};

// ─── Role Based Route ─────────────────────────────────────────────────────────
export const RoleBasedRoute = ({ children, allowedRole }) => {
  const { isAuthenticated, hydrated, role } = useUnifiedAuth();

  if (!hydrated) return <Loader label="Verifying access" />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to={allowedRole === "company" ? "/login/company" : "/login"}
        replace
      />
    );
  }

  if (role !== allowedRole) {
    return <Navigate to={role === "company" ? "/company" : "/"} replace />;
  }

  return children;
};

// ─── Admin Route ──────────────────────────────────────────────────────────────
// Behaviour:
//   • Access token present + valid role  → let through immediately
//   • No access token + refresh token    → attempt silent refresh (spinner)
//   • No tokens at all / refresh fails   → redirect to /admin/login
//   • Once through: wires up activity tracking + proactive refresh
const ADMIN_ROLES = ["super_admin", "admin", "moderator", "support"];
const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
];

export const AdminRoute = ({ children }) => {
  const accessToken = useSelector((state) => state.adminAuth.accessToken);
  const admin = useSelector((state) => state.adminAuth.admin);

  const hasAccess = !!getCookie("adminAccessToken");
  const hasRefresh = !!getCookie("adminRefreshToken");

  // "refreshing" = no access token but refresh token exists → try silent refresh
  const [status, setStatus] = useState(() => {
    if (hasAccess) return "ok";
    if (hasRefresh) return "refreshing";
    return "denied";
  });

  // ── Silent token refresh on page load (e.g. after 15-min idle page refresh) ─
  useEffect(() => {
    if (status !== "refreshing") return;

    (async () => {
      try {
        const refreshTokenValue = getCookie("adminRefreshToken");
        const { data } = await axios.post(`${API}/refresh-token`, {
          refreshToken: refreshTokenValue,
        });
        setCookie("adminAccessToken", data.accessToken, 900); // 15 min
        setCookie("adminRefreshToken", data.refreshToken, 604800); // 7 days
        sessionStorage.setItem("adminTokenIssuedAt", String(Date.now()));
        setStatus("ok");
      } catch {
        deleteCookie("adminAccessToken");
        deleteCookie("adminRefreshToken");
        sessionStorage.clear();
        setStatus("denied");
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Activity tracking + proactive refresh (only when authenticated) ──────────
  useEffect(() => {
    if (status !== "ok") return;

    // Mark activity on any user interaction
    const handleActivity = () => markActivity();
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: true }),
    );

    // Mark now (page just loaded = user is present)
    markActivity();

    // Start the proactive background refresh cycle
    scheduleProactiveRefresh();

    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, handleActivity),
      );
    };
  }, [status]);

  // ── Render ───────────────────────────────────────────────────────────────────
  if (status === "refreshing") {
    return <Loader label="Restoring session" />;
  }

  if (status === "denied" || !accessToken) {
    return <Navigate to="/admin/login" replace />;
  }

  // Admin object loads slightly after token — only block if loaded AND role is wrong
  if (admin?.role && !ADMIN_ROLES.includes(admin.role)) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};
