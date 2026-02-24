import { Navigate } from "react-router-dom";
import { useAuth } from "../Hooks/useAuthHook";
import { useCompany } from "../Hooks/useCompanyAuthHook";
import Loader from "../Components/Loader/Loader";

// ─── Unified auth hook ────────────────────────────────────────────────────────
// Single source of truth for "who is logged in right now".
// Uses && for hydrated so we NEVER make an access decision until
// BOTH the user slice AND the company slice have finished their API checks.
const useUnifiedAuth = () => {
  const {
    isAuthenticated: isUserAuth,
    hydrated: userHydrated,
    role: userRole,
  } = useAuth();

  const { isAuthenticated: isCompanyAuth, hydrated: companyHydrated } =
    useCompany();

  return {
    // ✅ AND — both must resolve before we trust the auth state
    hydrated: userHydrated && companyHydrated,
    isAuthenticated: isUserAuth || isCompanyAuth,
    role: isCompanyAuth ? "company" : isUserAuth ? userRole : "guest",
  };
};

// ─── PublicRoute ──────────────────────────────────────────────────────────────
// Accessible only by guests (not logged in).
// Authenticated users are redirected to their respective dashboard.
export const PublicRoute = ({ children }) => {
  const { isAuthenticated, hydrated, role } = useUnifiedAuth();

  // Wait for both auth checks to complete before deciding
  if (!hydrated) return <Loader label="Loading" />;

  if (isAuthenticated) {
    return (
      <Navigate to={role === "company" ? "/company/dashboard" : "/"} replace />
    );
  }

  // ✅ Guest — show the login / signup page
  return children;
};

// ─── RoleBasedRoute ───────────────────────────────────────────────────────────
// Accessible only when:
//   1. Auth has fully hydrated (both slices resolved)
//   2. User is authenticated
//   3. User's role matches the required allowedRole
//
// Redirects:
//   • Not logged in  → correct login page for the attempted role
//   • Wrong role     → own dashboard (no infinite loops)
export const RoleBasedRoute = ({ children, allowedRole }) => {
  const { isAuthenticated, hydrated, role } = useUnifiedAuth();

  // ── Still checking auth state — show loader, never redirect yet ──
  if (!hydrated) return <Loader label="Verifying access" />;

  // ── Not logged in at all ──────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <Navigate
        to={allowedRole === "company" ? "/login/company" : "/login"}
        replace
      />
    );
  }

  // ── Logged in but wrong role ──────────────────────────────────────
  // e.g. a company account trying to hit /dashboard  → /company/dashboard
  //      a user account trying to hit /company/jobs  → /dashboard
  if (role !== allowedRole) {
    return (
      <Navigate
        to={role === "company" ? "/company/dashboard" : "/dashboard"}
        replace
      />
    );
  }

  // ✅ Authenticated + correct role — render the page
  return children;
};
