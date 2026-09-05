import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import dotenv from "dotenv";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendRoot, "..");
const envPath =
  process.env.RESTAURANTAI_ENV_FILE ||
  process.env.RESTAURANTAI_ENV_PATH ||
  path.resolve(backendRoot, ".env");
const configBaseDir = path.dirname(envPath);
const runtimeOverrides = {
  BACKUP_DIR: process.env.BACKUP_DIR,
  POSTGRES_BIN_DIR: process.env.POSTGRES_BIN_DIR,
};

const envResult = dotenv.config({
  path: envPath,
  override: true,
});

for (const [key, value] of Object.entries(runtimeOverrides)) {
  if (value !== undefined) {
    process.env[key] = value;
  }
}

const parsedEnv = envResult.parsed || {};
const effectiveEnv = {
  ...process.env,
  ...parsedEnv,
};

for (const [key, value] of Object.entries(runtimeOverrides)) {
  if (value !== undefined) {
    effectiveEnv[key] = value;
  }
}

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeMode = (value) => {
  const mode = String(value || "online").trim().toLowerCase();
  return ["online", "local"].includes(mode) ? mode : "online";
};

const appConfig = {
  mode: normalizeMode(effectiveEnv.RESTAURANTAI_MODE),
};

const dbConfig = {
  host: effectiveEnv.DB_HOST || "localhost",
  port: parseNumber(effectiveEnv.DB_PORT, 5432),
  database: effectiveEnv.DB_NAME || "restaurantai",
  user: effectiveEnv.DB_USER || "postgres",
  password: effectiveEnv.DB_PASSWORD || "",
};

const backupConfig = {
  dir: effectiveEnv.BACKUP_DIR || "../backups/database",
  postgresBinDir: effectiveEnv.POSTGRES_BIN_DIR || "",
  retentionDays: parseNumber(effectiveEnv.BACKUP_RETENTION_DAYS, 30),
  retentionCount: parseNumber(effectiveEnv.BACKUP_RETENTION_COUNT, 30),
};

const isWindows = process.platform === "win32";
const executableName = (name) => (isWindows ? `${name}.exe` : name);

const timestamp = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    "-",
    pad(now.getMonth() + 1),
    "-",
    pad(now.getDate()),
    "_",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
};

const sanitizeFilenamePart = (value) =>
  String(value || "database").replace(/[^a-zA-Z0-9_-]/g, "_");

const resolveFromConfig = (value) =>
  path.isAbsolute(value) ? value : path.resolve(configBaseDir, value);

export const getBackupPaths = () => {
  const backupDir = resolveFromConfig(backupConfig.dir);
  const logsDir = path.resolve(path.dirname(backupDir), "logs");

  return { backupDir, logsDir, repoRoot, backendRoot };
};

const appendLog = async (message) => {
  const { logsDir } = getBackupPaths();
  await fs.mkdir(logsDir, { recursive: true });
  await fs.appendFile(
    path.join(logsDir, "backup.log"),
    `${new Date().toISOString()} ${message}${os.EOL}`,
    "utf8"
  );
};

const pathCandidates = (toolName) => {
  const candidates = [];
  const exe = executableName(toolName);

  if (backupConfig.postgresBinDir) {
    return [path.join(backupConfig.postgresBinDir, exe)];
  }

  for (const part of (process.env.PATH || "").split(path.delimiter)) {
    if (part) {
      candidates.push(path.join(part, exe));
    }
  }

  if (isWindows) {
    candidates.push(
      path.join("C:\\Program Files\\PostgreSQL\\18\\bin", exe),
      path.join("C:\\Program Files\\PostgreSQL\\17\\bin", exe),
      path.join("C:\\Program Files\\PostgreSQL\\16\\bin", exe),
      path.join("C:\\Program Files\\PostgreSQL\\15\\bin", exe)
    );
  }

  return [...new Set(candidates)];
};

export const findPostgresTool = async (toolName) => {
  for (const candidate of pathCandidates(toolName)) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next location.
    }
  }

  throw new Error(
    `${toolName} not found. Set POSTGRES_BIN_DIR to the PostgreSQL bin folder, for example C:\\Program Files\\PostgreSQL\\18\\bin.`
  );
};

export const postgresEnv = () => ({
  ...process.env,
  ...(dbConfig.password ? { PGPASSWORD: dbConfig.password } : {}),
});

export const runPostgresTool = async (toolPath, args, options = {}) => {
  try {
    return await execFileAsync(toolPath, args, {
      env: postgresEnv(),
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
      ...options,
    });
  } catch (error) {
    const message = String(error.stderr || error.stdout || error.message || "")
      .replaceAll(dbConfig.password || "__never__", "[redacted]")
      .trim();
    throw new Error(message || `${path.basename(toolPath)} failed`);
  }
};

const sha256File = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });

const readBackups = async (backupDir) => {
  try {
    const entries = await fs.readdir(backupDir, { withFileTypes: true });
    const safeDatabase = sanitizeFilenamePart(dbConfig.database);
    const managedPattern = new RegExp(
      `^${safeDatabase}_\\d{4}-\\d{2}-\\d{2}_\\d{6}\\.dump$`
    );

    const backups = [];
    for (const entry of entries) {
      if (!entry.isFile() || !managedPattern.test(entry.name)) {
        continue;
      }

      const filePath = path.join(backupDir, entry.name);
      const stats = await fs.stat(filePath);
      backups.push({ name: entry.name, filePath, mtimeMs: stats.mtimeMs });
    }

    return backups.sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const applyRetention = async (backupDir) => {
  const backups = await readBackups(backupDir);
  const retentionCount = Math.max(1, Number(backupConfig.retentionCount || 30));
  const retentionDays = Math.max(0, Number(backupConfig.retentionDays || 30));
  const cutoffMs =
    retentionDays > 0 ? Date.now() - retentionDays * 24 * 60 * 60 * 1000 : 0;
  const deleted = [];

  for (let index = 0; index < backups.length; index += 1) {
    const backup = backups[index];
    const keepNewest = index === 0;
    const exceedsCount = index >= retentionCount;
    const exceedsAge = cutoffMs > 0 && backup.mtimeMs < cutoffMs;

    if (keepNewest || (!exceedsCount && !exceedsAge)) {
      continue;
    }

    await fs.rm(backup.filePath, { force: true });
    await fs.rm(backup.filePath.replace(/\.dump$/, ".json"), { force: true });
    deleted.push(backup.name);
  }

  if (deleted.length > 0) {
    await appendLog(`retention deleted=${deleted.join(",")}`);
  }

  return deleted;
};

export const runBackup = async () => {
  const { backupDir } = getBackupPaths();
  const pgDump = await findPostgresTool("pg_dump");
  const pgRestore = await findPostgresTool("pg_restore");

  await fs.mkdir(backupDir, { recursive: true });

  const safeDatabase = sanitizeFilenamePart(dbConfig.database);
  const createdAt = new Date().toISOString();
  const fileName = `${safeDatabase}_${timestamp()}.dump`;
  const backupPath = path.join(backupDir, fileName);
  const metadataPath = backupPath.replace(/\.dump$/, ".json");

  await appendLog(
    `backup config env_path=${envPath} host=${dbConfig.host} port=${dbConfig.port} database=${dbConfig.database} backup_dir=${backupDir}`
  );
  await appendLog(`backup started file=${fileName} database=${dbConfig.database}`);

  const dumpArgs = [
    "-h",
    dbConfig.host,
    "-p",
    String(dbConfig.port),
    "-U",
    dbConfig.user,
    "-d",
    dbConfig.database,
    "-Fc",
    "-f",
    backupPath,
  ];

  try {
    await runPostgresTool(pgDump, dumpArgs);
  } catch (error) {
    await fs.rm(backupPath, { force: true });
    throw error;
  }

  const stats = await fs.stat(backupPath);
  if (!stats.isFile() || stats.size <= 0) {
    throw new Error(`Backup file was not created correctly: ${backupPath}`);
  }

  await runPostgresTool(pgRestore, ["--list", backupPath]);
  const checksum = await sha256File(backupPath);
  const version = await runPostgresTool(pgDump, ["--version"]);

  const metadata = {
    database: dbConfig.database,
    created_at: createdAt,
    restaurantai_mode: appConfig.mode,
    format: "postgresql-custom",
    file: fileName,
    size_bytes: stats.size,
    checksum_sha256: checksum,
    pg_dump_version: version.stdout.trim(),
  };

  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}${os.EOL}`, "utf8");

  const deleted = await applyRetention(backupDir);
  await appendLog(
    `backup success file=${fileName} size=${stats.size} checksum=${checksum} retention_deleted=${deleted.length}`
  );

  return {
    backupPath,
    metadataPath,
    fileName,
    sizeBytes: stats.size,
    checksum,
    retentionDeleted: deleted,
  };
};

const main = async () => {
  try {
    const result = await runBackup();
    console.log("RestaurantAI database backup completed.");
    console.log(`Database: ${dbConfig.database}`);
    console.log(`Backup: ${result.backupPath}`);
    console.log(`Metadata: ${result.metadataPath}`);
    console.log(`Size bytes: ${result.sizeBytes}`);
    console.log(`SHA-256: ${result.checksum}`);
    console.log(
      result.retentionDeleted.length > 0
        ? `Retention deleted: ${result.retentionDeleted.join(", ")}`
        : "Retention deleted: none"
    );
  } catch (error) {
    await appendLog(`backup failed error=${error.message}`);
    console.error(`Backup failed: ${error.message}`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
