import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { appConfig, backupConfig, dbConfig, fileConfig, isLocalMode } from "../config/index.js";
import { pool } from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const DEFAULT_BACKUP_STALE_HOURS = Number(process.env.BACKUP_STALE_WARNING_HOURS || 24);

const isPrivateIpv4 = (address) =>
  address.startsWith("10.") ||
  address.startsWith("192.168.") ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(address);

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readPackageVersion() {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

async function newestBackupFile(backupDir) {
  if (!(await pathExists(backupDir))) {
    return null;
  }

  const entries = await fs.readdir(backupDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(backupDir, entry.name);
    if (entry.isDirectory()) {
      files.push(await newestBackupFile(fullPath));
      continue;
    }

    if (!/\.(dump|sql|json|zip)$/i.test(entry.name)) {
      continue;
    }

    const stat = await fs.stat(fullPath);
    files.push({
      path: fullPath,
      modifiedAt: stat.mtime,
      sizeBytes: stat.size,
    });
  }

  return files.filter(Boolean).sort((a, b) => b.modifiedAt - a.modifiedAt)[0] || null;
}

async function checkWritableDirectory(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
  const probe = path.join(targetPath, `.restaurantai-probe-${process.pid}-${Date.now()}`);
  await fs.writeFile(probe, "ok", "utf8");
  await fs.unlink(probe);
  return true;
}

export function getLanUrls() {
  if (!(appConfig.host === "0.0.0.0" || appConfig.host === "::")) {
    return [];
  }

  return Object.values(os.networkInterfaces())
    .flat()
    .filter((network) => network && network.family === "IPv4" && !network.internal)
    .map((network) => network.address)
    .filter(isPrivateIpv4)
    .map((address) => `http://${address}:${appConfig.port}`);
}

export async function getReadiness() {
  try {
    await pool.query("SELECT 1");
    return {
      ready: true,
      checks: {
        database: "connected",
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ready: false,
      checks: {
        database: "disconnected",
      },
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function getDiagnostics() {
  const version = await readPackageVersion();
  const backupDir = path.resolve(backupConfig.dir);
  const uploadDir = path.resolve(fileConfig.uploadDir);
  const latestBackup = await newestBackupFile(backupDir);
  const now = Date.now();
  const backupAgeHours = latestBackup
    ? Number(((now - latestBackup.modifiedAt.getTime()) / 36e5).toFixed(2))
    : null;
  const backupStatus = !latestBackup
    ? "warn"
    : backupAgeHours > DEFAULT_BACKUP_STALE_HOURS
      ? "warn"
      : "ok";

  const readiness = await getReadiness();
  let baseline = "unknown";
  try {
    const result = await pool.query(
      "SELECT baseline FROM schema_migrations WHERE migration_name = $1 LIMIT 1",
      ["offline-v1-baseline"]
    );
    baseline = result.rowCount > 0 ? "present" : "missing";
  } catch {
    baseline = "unavailable";
  }

  const writable = {};
  for (const [name, targetPath] of Object.entries({ backupDir, uploadDir })) {
    try {
      await checkWritableDirectory(targetPath);
      writable[name] = "ok";
    } catch (error) {
      writable[name] = `failed: ${error.message}`;
    }
  }

  return {
    success: true,
    status: readiness.ready && backupStatus === "ok" ? "ok" : "warn",
    app: {
      name: "RestaurantAI",
      version,
      mode: appConfig.mode,
      nodeEnv: appConfig.nodeEnv,
      localMode: isLocalMode,
    },
    server: {
      host: appConfig.host,
      port: appConfig.port,
      localUrl: `http://127.0.0.1:${appConfig.port}`,
      lanUrls: getLanUrls(),
    },
    database: {
      status: readiness.checks.database,
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      baseline,
    },
    backup: {
      status: backupStatus,
      directory: backupDir,
      staleWarningHours: DEFAULT_BACKUP_STALE_HOURS,
      latest: latestBackup
        ? {
            path: latestBackup.path,
            modifiedAt: latestBackup.modifiedAt.toISOString(),
            ageHours: backupAgeHours,
            sizeBytes: latestBackup.sizeBytes,
          }
        : null,
    },
    storage: {
      uploadDir,
      writable,
    },
    timestamp: new Date().toISOString(),
  };
}
