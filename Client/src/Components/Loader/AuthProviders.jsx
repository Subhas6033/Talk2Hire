import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getCurrentUser, setAuthHydrated } from "../../API/authApi";

const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const { user, hydrated } = useSelector((state) => state.auth);

  useEffect(() => {
    const initAuth = async () => {
      // Check if  user data in localStorage
      const savedState = localStorage.getItem("authState");

      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);

          //  If user data exists, verify session with backend
          if (parsedState.user && parsedState.isAuthenticated) {
            const isStale =
              Date.now() - (parsedState.lastVerified || 0) > 30 * 60 * 1000;

            if (isStale) {
              // Only hit backend if session is older than 30 minutes
              await dispatch(getCurrentUser()).unwrap();
            } else {
              // Trust the cached data, mark as hydrated immediately
              dispatch(setAuthHydrated());
            }
          }
        } catch (error) {
          // Session verification failed
          console.log("❌ Session verification failed:", error);
          dispatch(setAuthHydrated());
        }
      } else {
        // No saved state, mark as hydrated immediately
        console.log("ℹ️ No saved session found");
        dispatch(setAuthHydrated());
      }
    };

    if (!hydrated) {
      initAuth();
    }
  }, [dispatch, hydrated]);

  // Show loading screen while hydrating
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bgDark">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-purpleGlow/30 border-t-purpleGlow"></div>
          <p className="mt-4 text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthProvider;
