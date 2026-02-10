import { Navigate } from "react-router-dom";
import { useAuth } from "../Hooks/useAuthHook";
import Loader from "../Components/Loader/Loader";

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, hydrated } = useAuth();

  // Wait for auth state to hydrate before deciding
  if (!hydrated) {
    return <Loader label="Verifying authentication" />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated, render the protected component
  return children;
};

export const PublicRoute = ({ children }) => {
  const { isAuthenticated, hydrated } = useAuth();

  // Wait for hydration
  if (!hydrated) {
    return <Loader label="Loading" />;
  }

  //  Redirect authenticated users to home page
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // User is not authenticated, show public page (login/signup)
  return children;
};
