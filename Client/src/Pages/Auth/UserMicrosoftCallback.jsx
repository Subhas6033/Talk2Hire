import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMicrosoftUserAuth } from "../../Hooks/useMicrosoftAuth";
import Loader from "../../Components/Loader/Loader";

const UserMicrosoftCallback = () => {
  const { fetchSession, isAuthenticated, isNewUser } = useMicrosoftUserAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSession().then(() => {
      if (isNewUser) sessionStorage.setItem("showOnboarding", "true");
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated]);

  return <Loader label="Signing you in..." />;
};

export default UserMicrosoftCallback;
