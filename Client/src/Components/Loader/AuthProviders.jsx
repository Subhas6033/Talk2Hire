import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setAuthHydrated } from "../../API/authApi";
import Loader from "./Loader";

const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const { hydrated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!hydrated) {
      // ✅ Just mark as hydrated - NO API call, trust localStorage
      console.log("✅ Loading auth from localStorage (no API call)");
      dispatch(setAuthHydrated());
    }
  }, [dispatch, hydrated]);

  if (!hydrated) {
    return <Loader label="Loading" />;
  }

  return children;
};

export default AuthProvider;
