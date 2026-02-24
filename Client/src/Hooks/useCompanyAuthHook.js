import { useDispatch, useSelector } from "react-redux";
import {
  registerCompany,
  loginCompany,
  logoutCompany,
  getCurrentCompany,
  updateCompany,
  updateCompanyLogo,
  clearCompanyError,
  updateCompanyLocal,
  clearCompanySession,
} from "../API/companyAuthApi";

export const useCompany = () => {
  const dispatch = useDispatch();

  const { company, isAuthenticated, loading, error, hydrated } = useSelector(
    (state) => state.company,
  );

  return {
    // State
    company,
    isAuthenticated,
    loading,
    error,
    hydrated,
    role: company?.role ?? "guest",

    // Async actions
    registerCompany: (data) => dispatch(registerCompany(data)),
    login: (data) => dispatch(loginCompany(data)),
    logout: () => dispatch(logoutCompany()),
    getCurrentCompany: () => dispatch(getCurrentCompany()),
    updateCompany: (data) => dispatch(updateCompany(data)),
    updateCompanyLogo: (formData) => dispatch(updateCompanyLogo(formData)),

    // Sync actions
    clearError: () => dispatch(clearCompanyError()),
    updateCompanyLocal: (data) => dispatch(updateCompanyLocal(data)),
    clearSession: () => dispatch(clearCompanySession()),
  };
};
