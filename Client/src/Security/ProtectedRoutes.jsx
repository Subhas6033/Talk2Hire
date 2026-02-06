import { Navigate } from "react-router-dom";
import { useAuth } from "../Hooks/useAuthHook";

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, hydrated } = useAuth();

  //  Wait for auth to be checked before redirecting
  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-purple-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
