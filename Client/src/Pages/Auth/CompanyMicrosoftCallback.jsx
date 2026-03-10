import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMicrosoftAuth } from "../../Hooks/useMicrosoftCompanyAuthHook";
import Loader from "../../Components/Loader/Loader";

const CompanyMicrosoftCallback = () => {
  const { fetchSession, isAuthenticated } = useMicrosoftAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSession();
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate("/company/dashboard", { replace: true });
  }, [isAuthenticated]);

  return <Loader label="Signing you in..." />;
};

export default CompanyMicrosoftCallback;
