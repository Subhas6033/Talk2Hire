import { Navigate } from "react-router-dom";
import { useAuth } from "../Hooks/useAuthHook";
import { useCompany } from "../Hooks/useCompanyAuthHook";
import { useSelector } from "react-redux";
import Loader from "../Components/Loader/Loader";
import { useMicrosoftUserAuth } from "../Hooks/useMicrosoftAuth.js";
import { useMicrosoftAuth } from "../Hooks/useMicrosoftCompanyAuthHook.js";

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
