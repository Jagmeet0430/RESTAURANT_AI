// Authentication middleware
import jwt from "jsonwebtoken";
import { jwtConfig } from "../config/index.js";

const getBearerToken = (authHeader = "") =>
  authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

export const authMiddleware = (req, res, next) => {
  try {
    const token = getBearerToken(req.headers.authorization || "");
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, jwtConfig.secret);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

export const authorizeRoles = (roles = []) => (req, res, next) => {
  try {
    const userRole = req.user?.role;
    if (!userRole) return res.status(403).json({ success: false, message: 'Role missing' });
    if (!roles.includes(userRole)) return res.status(403).json({ success: false, message: 'Forbidden' });
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
};

// Error handling middleware
export const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
