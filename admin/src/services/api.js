import axios from "axios";

// Base configuration
const configuredApiUrl = import.meta.env.VITE_API_URL || "http://localhost:5001/api";
const adminBasePath = (() => {
  const base = import.meta.env.BASE_URL || "/";
  const normalized = base.replace(/\/+$/, "");
  return normalized === "" ? "" : normalized;
})();

const normalizeApiUrl = (url) => String(url || "").replace(/\/+$/, "");
const isLoopbackHost = (hostname = "") =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";

const parseUrl = (url, base) => {
  try {
    return new URL(url, base);
  } catch {
    return null;
  }
};

const buildSameHostApiUrl = (windowLocation, configuredUrl) => {
  const parsedConfigured = parseUrl(configuredUrl, windowLocation.origin);
  const apiPath = parsedConfigured?.pathname || "/api";
  return normalizeApiUrl(`${windowLocation.origin}${apiPath}`);
};

const buildLanApiUrl = (windowLocation, configuredUrl) => {
  const parsedConfigured = parseUrl(configuredUrl, windowLocation.origin);
  const apiPath = parsedConfigured?.pathname || "/api";
  const apiPort = parsedConfigured?.port || "5001";
  const pagePort = windowLocation.port || "";

  if (!pagePort || pagePort === apiPort) {
    return buildSameHostApiUrl(windowLocation, configuredUrl);
  }

  return normalizeApiUrl(`${windowLocation.protocol}//${windowLocation.hostname}:${apiPort}${apiPath}`);
};

const getApiBaseUrl = () => {
  const normalizedConfiguredUrl = normalizeApiUrl(configuredApiUrl);

  if (typeof window === "undefined") {
    return normalizedConfiguredUrl;
  }

  const parsedConfigured = parseUrl(normalizedConfiguredUrl, window.location.origin);
  const configuredForLoopback = parsedConfigured ? isLoopbackHost(parsedConfigured.hostname) : false;

  if (configuredForLoopback) {
    const pageHostIsLoopback = isLoopbackHost(window.location.hostname);
    const configuredPort = parsedConfigured?.port || "5001";
    const pagePort = window.location.port || "";

    if (!pageHostIsLoopback) {
      return buildLanApiUrl(window.location, normalizedConfiguredUrl);
    }

    if (pagePort && pagePort === configuredPort) {
      return buildSameHostApiUrl(window.location, normalizedConfiguredUrl);
    }
  }

  return normalizedConfiguredUrl;
};

export const API_BASE_URL = getApiBaseUrl();
const CONFIGURED_API_BASE_URL = normalizeApiUrl(configuredApiUrl);

const shouldRetryWithConfiguredLocalApi = (error) => {
  if (typeof window === "undefined" || error.response || error.config?._retriedConfiguredLocalApi) {
    return false;
  }

  if (!isLoopbackHost(window.location.hostname)) {
    return false;
  }

  const configuredForLocalhost =
    CONFIGURED_API_BASE_URL.includes("localhost") ||
    CONFIGURED_API_BASE_URL.includes("127.0.0.1");
  const activeUrl = normalizeApiUrl(error.config?.baseURL || API_BASE_URL);
  const usingLanDerivedUrl = activeUrl !== CONFIGURED_API_BASE_URL;

  return configuredForLocalhost && usingLanDerivedUrl;
};

const getRequestPath = (config = {}) => {
  const requestUrl = parseUrl(config.url || "", config.baseURL || API_BASE_URL);
  return requestUrl?.pathname || "";
};

const isLoginRequest = (config = {}) => getRequestPath(config).endsWith("/auth/login");

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
    if (shouldRetryWithConfiguredLocalApi(error)) {
      const retryConfig = {
        ...error.config,
        baseURL: CONFIGURED_API_BASE_URL,
        _retriedConfiguredLocalApi: true,
      };

      return apiClient.request(retryConfig);
    }

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
