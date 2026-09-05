import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath =
  process.env.RESTAURANTAI_ENV_FILE ||
  process.env.RESTAURANTAI_ENV_PATH ||
  path.resolve(__dirname, "../.env");

dotenv.config({ path: envPath });

const { Pool } = pg;

const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment value: ${key}`);
    process.exit(1);
  }
}

const adminName = process.env.ADMIN_SETUP_NAME;
const adminEmail = process.env.ADMIN_SETUP_EMAIL;
const adminPassword = process.env.ADMIN_SETUP_PASSWORD;

if (!adminName || !adminEmail || !adminPassword) {
  console.error("ADMIN_SETUP_NAME, ADMIN_SETUP_EMAIL, and ADMIN_SETUP_PASSWORD are required.");
  process.exit(1);
}

if (adminPassword.length < 8) {
  console.error("Initial admin password must be at least 8 characters.");
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

try {
  const countResult = await pool.query("SELECT COUNT(*)::int AS count FROM admins");
  if (countResult.rows[0].count > 0) {
    console.log("Initial admin skipped because an admin already exists.");
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      `INSERT INTO admins (name, email, password, role, is_active)
       VALUES ($1, $2, $3, 'admin', true)`,
      [adminName, adminEmail, hashedPassword]
    );

    console.log("Initial admin account created.");
  }
} catch (error) {
  console.error(`Initial admin setup failed: ${error.message}`);
  process.exit(1);
} finally {
  await pool.end();
}
