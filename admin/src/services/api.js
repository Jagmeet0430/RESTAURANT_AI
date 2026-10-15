import axios from "axios";

// Express serves the installed Admin and API together; Vite proxies /api in development.
export const API_BASE_URL = "/api";
const adminBasePath = (() => {
  const base = import.meta.env.BASE_URL || "/";
  const normalized = base.replace(/\/+$/, "");
  return normalized === "" ? "" : normalized;
})();

const isLoginRequest = (config = {}) =>
  new URL(config.url || "", window.location.origin).pathname.endsWith("/auth/login");

// Create axios instance with default headers
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request interceptor to add token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isLoginRequest(error.config)) {
      // Token expired or invalid
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      window.location.assign(`${adminBasePath}/login` || "/login");
    }
    return Promise.reject(error);
  }
);

export default apiClient;
