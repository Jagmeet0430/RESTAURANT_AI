import axios from "axios";

// Base configuration
const configuredApiUrl = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const getApiBaseUrl = () => {
  if (typeof window === "undefined") {
    return configuredApiUrl;
  }

  const { hostname, protocol } = window.location;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  const configuredForLocalhost =
    configuredApiUrl.includes("localhost") || configuredApiUrl.includes("127.0.0.1");

  if (!isLocalHost && configuredForLocalhost) {
    return `${protocol}//${hostname}:5001/api`;
  }

  return configuredApiUrl;
};

export const API_BASE_URL = getApiBaseUrl().replace(/\/+$/, "");

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
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default apiClient;
