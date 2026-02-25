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

export const PublicRoute = ({ children }) => {
  const { isAuthenticated, hydrated, role } = useUnifiedAuth();

  if (!hydrated) return <Loader label="Loading" />;

  if (isAuthenticated) {
    return (
      <Navigate to={role === "company" ? "/company/dashboard" : "/"} replace />
    );
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
    return (
      <Navigate
        to={role === "company" ? "/company/dashboard" : "/dashboard"}
        replace
      />
    );
  }

  return children;
};
