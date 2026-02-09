import axios from "axios";

const api = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL}/api/v1`,
  withCredentials: true,
  /* headers: {
    "Content-Type": "application/json",
  }, */
});

//  Log all API requests for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`🌐 API Call: ${config.method.toUpperCase()} ${config.url}`);
    console.trace("📍 Called from:");
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default api;
