import api from "./api";
import { logoutUser } from "./authApi";

export const setupInterceptors = (store) => {
  // ✅ Intercept 401 responses (session expired)
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        console.log("❌ Session expired - logging out");
        store.dispatch(logoutUser());
      }
      return Promise.reject(error);
    },
  );
};
