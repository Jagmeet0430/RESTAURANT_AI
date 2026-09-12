import React, { createContext, useContext, useEffect, useState } from "react";
import authService from "../services/auth";

const AuthContext = createContext(null);

const clearStoredSession = () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const storedToken = localStorage.getItem("authToken");

      if (!storedToken) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const response = await authService.getProfile();
        if (!isMounted) return;

        if (response.success && response.data) {
          localStorage.setItem("user", JSON.stringify(response.data));
          setUser(response.data);
        } else {
          clearStoredSession();
          setUser(null);
        }
      } catch (err) {
        if (!isMounted) return;

        if (err.response?.status === 401) {
          clearStoredSession();
        }
        setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    try {
      setError(null);

      const response = await authService.login(email, password);

      if (response.success) {
        const profileResponse = await authService.getProfile();
        const currentUser =
          profileResponse.success && profileResponse.data
            ? profileResponse.data
            : response.data.user;

        localStorage.setItem("user", JSON.stringify(currentUser));
        setUser(currentUser);
        return { success: true, user: currentUser };
      }

      setError(response.message);
      return { success: false, message: response.message };
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      console.error("AuthContext login error:", {
        status: err.response?.status,
        message,
      });
      setError(message);
      return { success: false, message };
    }
  };

  const register = async (name, email, password, role = "admin") => {
    try {
      setError(null);
      const response = await authService.register(name, email, password, role);

      if (response.success) {
        setUser(response.data.user);
        return { success: true, user: response.data.user };
      }

      setError(response.message);
      return { success: false, message: response.message };
    } catch (err) {
      const message = err.response?.data?.message || "Registration failed";
      setError(message);
      return { success: false, message };
    }
  };

  const logout = async () => {
    setUser(null);
    setError(null);
    await authService.logout();
  };

  const hasRole = (requiredRole) => {
    if (!user) return false;
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user.role);
    }
    return user.role === requiredRole;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        isAuthenticated: !!user,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export default AuthContext;
