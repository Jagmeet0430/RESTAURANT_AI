import apiClient from "./api";

// Authentication Service
export const authService = {
  // Register new admin
  register: async (name, email, password, role = "admin") => {
    const response = await apiClient.post("/auth/register", {
      name,
      email,
      password,
      role,
    });
    return response.data;
  },

  // Admin login
  login: async (email, password) => {
    const response = await apiClient.post("/auth/login", {
      email,
      password,
    });

    if (response.data.success) {
      localStorage.setItem("authToken", response.data.data.token);
      localStorage.setItem(
        "user",
        JSON.stringify(response.data.data.user)
      );
    }

    return response.data;
  },

  // Logout
  logout: async () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    return { success: true };
  },

  // Verify token
  verifyToken: async () => {
    const response = await apiClient.get("/auth/verify");
    return response.data;
  },

  getProfile: async () => {
    const response = await apiClient.get("/auth/profile");
    return response.data;
  },

  // Refresh token
  refreshToken: async () => {
    const response = await apiClient.post("/auth/refresh");
    if (response.data.success) {
      localStorage.setItem("authToken", response.data.data.token);
    }
    return response.data;
  },

  // Get current user from localStorage
  getCurrentUser: () => {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem("authToken");
  },
};

export default authService;
