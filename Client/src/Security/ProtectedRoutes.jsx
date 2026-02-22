import { Navigate } from "react-router-dom";
import { useAuth } from "../Hooks/useAuthHook";
import { useCompany } from "../Hooks/useCompanyAuthHook";
import Loader from "../Components/Loader/Loader";

const useUnifiedAuth = () => {
  const {
    isAuthenticated: isUserAuth,
    hydrated: userHydrated,
    role: userRole,
  } = useAuth();
  const { isAuthenticated: isCompanyAuth, hydrated: companyHydrated } =
    useCompany();

  return {
    hydrated: userHydrated && companyHydrated,
    isAuthenticated: isUserAuth || isCompanyAuth,
    role: isCompanyAuth ? "company" : isUserAuth ? userRole : "guest",
  };
};

// ─── PublicRoute ───────────────────────────────────────────
// Rule: guests only — logged in users get redirected to their dashboard
export const PublicRoute = ({ children }) => {
  const { isAuthenticated, hydrated, role } = useUnifiedAuth();

  if (!hydrated) return <Loader label="Loading" />;

  if (isAuthenticated) {
    // User → /dashboard | Company → /company/dashboard | never stays on public page
    return (
      <Navigate
        to={role === "company" ? "/company/dashboard" : "/dashboard"}
        replace
      />
    );
  }

  return children; // ✅ guest: show login/signup
};

// ─── RoleBasedRoute ────────────────────────────────────────
// Rule: authenticated + correct role only
// Blocks: guests, wrong-role users, cross-role access
export const RoleBasedRoute = ({ children, allowedRole }) => {
  const { isAuthenticated, hydrated, role } = useUnifiedAuth();

  if (!hydrated) return <Loader label="Verifying access" />;

  // ── Guest: not logged in at all ──
  if (!isAuthenticated) {
    // Send to the correct login page for the route they tried to access
    return (
      <Navigate
        to={allowedRole === "company" ? "/login/company" : "/login"}
        replace
      />
    );
  }

  // ── Wrong role: logged in but as the other type ──
  if (role !== allowedRole) {
    // Company trying to access /dashboard → /company/dashboard
    // User trying to access /company/dashboard → /dashboard
    return (
      <Navigate
        to={role === "company" ? "/company/dashboard" : "/dashboard"}
        replace
      />
    );
  }

  return children; // ✅ correct role: allow access
};
