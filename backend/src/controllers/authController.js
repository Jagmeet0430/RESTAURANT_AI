// Authentication Controller
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";
import {
  successResponse,
  errorResponse,
  asyncHandler,
} from "../utils/index.js";
import { jwtConfig } from "../config/index.js";

const getBearerToken = (authHeader = "") =>
  authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

// Register Admin
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role = "admin" } = req.body;

  if (!name || !email || !password) {
    return errorResponse(
      res,
      "Name, email and password are required",
      400
    );
  }

  const adminCount = await pool.query("SELECT COUNT(*)::int AS count FROM admins");
  if (Number(adminCount.rows[0]?.count || 0) > 0) {
    return errorResponse(res, "Admin registration is only available during initial setup", 403);
  }

  const normalizedRole = String(role || "admin").trim();
  if (!["admin", "staff", "kitchen_staff"].includes(normalizedRole)) {
    return errorResponse(res, "Invalid role", 400);
  }

  const existingAdmin = await pool.query(
    "SELECT * FROM admins WHERE email = $1",
    [String(email).trim().toLowerCase()]
  );

  if (existingAdmin.rows.length > 0) {
    return errorResponse(res, "Admin already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO admins
    (name,email,password,role,is_active)
    VALUES ($1,$2,$3,$4,true)
    RETURNING id,name,email,role`,
    [String(name).trim(), String(email).trim().toLowerCase(), hashedPassword, normalizedRole]
  );

  const admin = result.rows[0];

  const token = jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
    jwtConfig.secret,
    {
      expiresIn: jwtConfig.expire,
    }
  );

  return successResponse(
    res,
    {
      admin,
      token,
    },
    "Admin registered successfully",
    201
  );
});

// Login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(
      res,
      "Email and password are required",
      400
    );
  }

  const result = await pool.query(
    "SELECT * FROM admins WHERE email = $1",
    [String(email).trim().toLowerCase()]
  );

  if (result.rows.length === 0) {
    return errorResponse(
      res,
      "Invalid email or password",
      401
    );
  }

  const admin = result.rows[0];

  if (!admin.is_active) {
    return errorResponse(
      res,
      "Account is inactive",
      403
    );
  }

  const match = await bcrypt.compare(password, admin.password);

  if (!match) {
    return errorResponse(
      res,
      "Invalid email or password",
      401
    );
  }

  await pool.query(
    "UPDATE admins SET last_login=CURRENT_TIMESTAMP WHERE id=$1",
    [admin.id]
  );

  const token = jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
    jwtConfig.secret,
    {
      expiresIn: jwtConfig.expire,
    }
  );

  return successResponse(
    res,
    {
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    },
    "Login successful"
  );
});

// Get current admin profile
export const getProfile = asyncHandler(async (req, res) => {
  const adminId = req.user?.id;

  if (!adminId) {
    return errorResponse(res, "Authentication required", 401);
  }

  const result = await pool.query(
    "SELECT id, name, email, role, is_active, last_login, created_at FROM admins WHERE id = $1",
    [adminId]
  );

  if (result.rows.length === 0) {
    return errorResponse(res, "Admin profile not found", 404);
  }

  return successResponse(res, result.rows[0], "Profile retrieved successfully");
});

// Logout
export const logout = asyncHandler(async (req, res) => {
  return successResponse(res, null, "Logout successful");
});

// Verify Token
export const verifyToken = asyncHandler(async (req, res) => {
  const token = getBearerToken(req.headers.authorization || "");

  if (!token) {
    return errorResponse(res, "No token provided", 401);
  }

  try {
    const decoded = jwt.verify(token, jwtConfig.secret);

    return successResponse(
      res,
      decoded,
      "Token is valid"
    );
  } catch {
    return errorResponse(
      res,
      "Invalid or expired token",
      401
    );
  }
});

// Refresh Token
export const refreshToken = asyncHandler(async (req, res) => {
  const token = getBearerToken(req.headers.authorization || "");

  if (!token) {
    return errorResponse(res, "No token provided", 401);
  }

  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      ignoreExpiration: true,
    });

    const newToken = jwt.sign(
      {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      },
      jwtConfig.secret,
      {
        expiresIn: jwtConfig.expire,
      }
    );

    return successResponse(
      res,
      { token: newToken },
      "Token refreshed successfully"
    );
  } catch {
    return errorResponse(
      res,
      "Invalid token",
      401
    );
  }
});
