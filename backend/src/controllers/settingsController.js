import bcrypt from "bcryptjs";
import { pool } from "../config/database.js";
import { asyncHandler, errorResponse, successResponse } from "../utils/index.js";

const SETTINGS_KEY = "restaurant";

const defaultSettings = {
  restaurantName: "Restaurant AI",
  gst: "27ABCDE1234F1Z5",
  address: "123 Main Street, Bengaluru",
  phone: "+91 98765 43210",
  email: "hello@restaurantai.com",
  openingTime: "10:00",
  closingTime: "22:00",
  logo: "",
  theme: "light",
};

const editableFields = Object.keys(defaultSettings);
const publicFields = [
  "restaurantName",
  "gst",
  "address",
  "phone",
  "email",
  "openingTime",
  "closingTime",
  "logo",
];

async function ensureSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(80) PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_by INT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function normalizeSettings(value = {}) {
  return editableFields.reduce((settings, field) => {
    settings[field] =
      value[field] === undefined || value[field] === null
        ? defaultSettings[field]
        : String(value[field]);
    return settings;
  }, {});
}

async function readSettings() {
  await ensureSettingsTable();

  const result = await pool.query("SELECT value FROM app_settings WHERE key = $1", [SETTINGS_KEY]);
  if (!result.rowCount) return { ...defaultSettings };

  return normalizeSettings({ ...defaultSettings, ...result.rows[0].value });
}

function publicSettings(settings) {
  return publicFields.reduce((publicData, field) => {
    publicData[field] = settings[field];
    return publicData;
  }, {});
}

function validateSettings(settings) {
  if (!settings.restaurantName.trim()) {
    return "Restaurant name is required because customers see it on the website.";
  }

  if (!settings.phone.trim()) {
    return "Phone number is required so customers can contact the restaurant.";
  }

  if (settings.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
    return "Enter a valid email address or leave it blank.";
  }

  return "";
}

export const getSettings = asyncHandler(async (req, res) => {
  const settings = await readSettings();
  return successResponse(res, { ...settings, password: "" }, "Settings retrieved successfully");
});

export const getPublicSettings = asyncHandler(async (req, res) => {
  const settings = await readSettings();
  return successResponse(res, publicSettings(settings), "Public settings retrieved successfully");
});

export const updateSettings = asyncHandler(async (req, res) => {
  const current = await readSettings();
  const next = { ...current };

  editableFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      next[field] = String(req.body[field] ?? "");
    }
  });

  const validationError = validateSettings(next);
  if (validationError) {
    return errorResponse(res, validationError, 400);
  }

  let passwordUpdated = false;
  const password = String(req.body.password || "");

  if (password) {
    if (password.length < 6) {
      return errorResponse(res, "New password must be at least 6 characters.", 400);
    }

    const adminId = req.user?.id;
    if (!adminId) {
      return errorResponse(res, "Authentication required to update password.", 401);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "UPDATE admins SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [hashedPassword, adminId]
    );
    passwordUpdated = true;
  }

  await ensureSettingsTable();
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value,
                   updated_by = EXCLUDED.updated_by,
                   updated_at = CURRENT_TIMESTAMP`,
    [SETTINGS_KEY, JSON.stringify(next), req.user?.id || null]
  );

  return successResponse(
    res,
    { ...next, password: "", password_updated: passwordUpdated },
    passwordUpdated ? "Settings and password updated successfully" : "Settings updated successfully"
  );
});
