import api from "./api";
import { clearSession } from "./authApi";

export const setupInterceptors = (store) => {
  // REQUEST INTERCEPTOR - Ensure credentials are sent
  api.interceptors.request.use(
    (config) => {
      config.withCredentials = true;
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // RESPONSE INTERCEPTOR - Handle 401 errors (session expired)
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error.response?.status;

      if (status === 401) {
        //  Token expired/invalid - clear session
        console.log("❌ Session expired (401) - clearing authentication");

        //  Clear Redux state and localStorage
        store.dispatch(clearSession());

        //  Redirect to login page (only if not already there)
        if (
          window.location.pathname !== "/login" &&
          window.location.pathname !== "/signup"
        ) {
          window.location.href = "/login";
        }
      }

      return Promise.reject(error);
    },
  );
};
