import React from "react";
import { useAuth } from "../Hooks/useAuthHook";
import { Navigate } from "react-router-dom";

const ProtectedRoutes = ({ children }) => {
  const { isAuthenticated } = useAuth();

  return (
    <>{isAuthenticated ? { children } : <Navigate to={"/login"} replace />}</>
  );
};

export default ProtectedRoutes;
