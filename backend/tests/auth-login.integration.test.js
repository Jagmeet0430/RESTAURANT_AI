import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import bcrypt from "bcryptjs";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
process.env.OTP_SECRET = process.env.OTP_SECRET || crypto.randomBytes(32).toString("hex");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendEnv = path.resolve(__dirname, "../.env");
const programDataEnv = path.join(process.env.ProgramData || "C:\\ProgramData", "RestaurantAI", "config", ".env");
if (!process.env.RESTAURANTAI_ENV_FILE && !process.env.RESTAURANTAI_ENV_PATH) {
  if (fs.existsSync(backendEnv)) {
    process.env.RESTAURANTAI_ENV_PATH = backendEnv;
  } else if (fs.existsSync(programDataEnv)) {
    process.env.RESTAURANTAI_ENV_PATH = programDataEnv;
  }
}

const { default: app } = await import("../src/app.js");
const { pool } = await import("../src/config/database.js");

function listen() {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function postJson(server, path, body) {
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return { status: response.status, json };
}

test("admin login validates credentials through the configured application pool", async (t) => {
  const suffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const email = `codex-auth-${suffix}@example.local`;
  const inactiveEmail = `codex-auth-inactive-${suffix}@example.local`;
  const password = `Correct-${suffix}!`;
  const hash = await bcrypt.hash(password, 10);

  const identity = await pool.query("SELECT current_database() AS database_name, current_user AS database_user");
  assert.ok(identity.rows[0].database_name);
  assert.ok(identity.rows[0].database_user);

  const activeAdmin = await pool.query(
    `INSERT INTO admins (name, email, password, role, is_active)
     VALUES ($1, $2, $3, 'admin', true)
     RETURNING id, last_login`,
    ["Codex Auth Test", email, hash]
  );
  const inactiveAdmin = await pool.query(
    `INSERT INTO admins (name, email, password, role, is_active)
     VALUES ($1, $2, $3, 'admin', false)
     RETURNING id`,
    ["Codex Inactive Auth Test", inactiveEmail, hash]
  );

  t.after(async () => {
    await pool.query("DELETE FROM admins WHERE email = ANY($1::text[])", [[email, inactiveEmail]]);
    await pool.end();
  });

  const server = await listen();
  t.after(() => close(server));

  const success = await postJson(server, "/api/auth/login", {
    email: `  ${email.toUpperCase()}  `,
    password,
  });
  assert.equal(success.status, 200);
  assert.equal(success.json.success, true);
  assert.ok(success.json.data.token);
  assert.equal(success.json.data.user.email, email);
  assert.equal(success.json.data.user.role, "admin");

  const updated = await pool.query("SELECT last_login FROM admins WHERE id = $1", [activeAdmin.rows[0].id]);
  assert.ok(updated.rows[0].last_login);

  const wrongPassword = await postJson(server, "/api/auth/login", {
    email,
    password: "wrong-password",
  });
  assert.equal(wrongPassword.status, 401);
  assert.equal(wrongPassword.json.message, "Invalid email or password");

  const unknown = await postJson(server, "/api/auth/login", {
    email: `missing-${suffix}@example.local`,
    password,
  });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.json.message, "Invalid email or password");

  const inactive = await postJson(server, "/api/auth/login", {
    email: inactiveEmail,
    password,
  });
  assert.equal(inactive.status, 403);

  const missingPassword = await postJson(server, "/api/auth/login", { email });
  assert.equal(missingPassword.status, 400);

  const missingEmail = await postJson(server, "/api/auth/login", { password });
  assert.equal(missingEmail.status, 400);

  const inactiveUnchanged = await pool.query("SELECT last_login FROM admins WHERE id = $1", [inactiveAdmin.rows[0].id]);
  assert.equal(inactiveUnchanged.rows[0].last_login, null);
});
