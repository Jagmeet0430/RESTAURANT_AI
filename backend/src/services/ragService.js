import { spawn } from "node:child_process";
import { existsSync, openSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const RAG_BASE_URL = "http://127.0.0.1:8001";
export const RAG_CHATBOT_URL = `${RAG_BASE_URL}/chat`;

const projectRoot = path.resolve(__dirname, "../../..");
const ragDirectory = path.join(projectRoot, "ai", "Rag_chatbot");
const ragPython = path.join(ragDirectory, ".venv", "Scripts", "python.exe");
const ragLauncher = path.join(ragDirectory, "run_server.py");
const ragSyncScript = path.join(ragDirectory, "sync_database.py");
const ragOutLog = path.join(ragDirectory, "logs", "rag_server.out.log");
const ragErrLog = path.join(ragDirectory, "logs", "rag_server.err.log");
const ragSyncOutLog = path.join(ragDirectory, "logs", "rag_sync.out.log");
const ragSyncErrLog = path.join(ragDirectory, "logs", "rag_sync.err.log");

let startPromise = null;
let ragProcess = null;
let syncPromise = null;
let syncTimer = null;
let lastSyncStatus = {
  running: false,
  queued: false,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastExitCode: null,
  lastReason: null,
  lastError: null,
};

const sleep = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export const isRagServiceHealthy = async () => {
  try {
    await axios.get(`${RAG_BASE_URL}/health`, {
      timeout: 1500,
    });

    return true;
  } catch {
    return false;
  }
};

const startRagProcess = () => {
  if (!existsSync(ragPython)) {
    console.error(`RAG Python not found: ${ragPython}`);
    return;
  }

  const out = openSync(ragOutLog, "a");
  const err = openSync(ragErrLog, "a");

  ragProcess = spawn(ragPython, [ragLauncher], {
    cwd: ragDirectory,
    detached: true,
    stdio: ["ignore", out, err],
    windowsHide: true,
  });

  ragProcess.unref();

  ragProcess.on("error", (error) => {
    console.error("Failed to start RAG service:", error.message);
  });

  console.log(`Starting RAG service on ${RAG_BASE_URL}`);
};

export const getRagSyncStatus = () => ({ ...lastSyncStatus });

export const syncRagKnowledgeBase = async (reason = "manual") => {
  if (syncPromise) {
    lastSyncStatus.queued = true;
    return syncPromise;
  }

  if (!existsSync(ragPython)) {
    const error = `RAG Python not found: ${ragPython}`;
    lastSyncStatus = {
      ...lastSyncStatus,
      running: false,
      queued: false,
      lastReason: reason,
      lastError: error,
    };
    console.error(error);
    return { ok: false, error };
  }

  if (!existsSync(ragSyncScript)) {
    const error = `RAG sync script not found: ${ragSyncScript}`;
    lastSyncStatus = {
      ...lastSyncStatus,
      running: false,
      queued: false,
      lastReason: reason,
      lastError: error,
    };
    console.error(error);
    return { ok: false, error };
  }

  syncPromise = new Promise((resolve) => {
    const out = openSync(ragSyncOutLog, "a");
    const err = openSync(ragSyncErrLog, "a");
    const startedAt = new Date().toISOString();

    lastSyncStatus = {
      running: true,
      queued: false,
      lastStartedAt: startedAt,
      lastFinishedAt: null,
      lastExitCode: null,
      lastReason: reason,
      lastError: null,
    };

    console.log(`Starting RAG knowledge sync: ${reason}`);

    const child = spawn(ragPython, [ragSyncScript], {
      cwd: ragDirectory,
      stdio: ["ignore", out, err],
      windowsHide: true,
    });

    child.on("error", (error) => {
      lastSyncStatus = {
        ...lastSyncStatus,
        running: false,
        lastFinishedAt: new Date().toISOString(),
        lastError: error.message,
      };
      console.error("RAG knowledge sync failed:", error.message);
      resolve({ ok: false, error: error.message });
    });

    child.on("close", (code) => {
      lastSyncStatus = {
        ...lastSyncStatus,
        running: false,
        lastFinishedAt: new Date().toISOString(),
        lastExitCode: code,
        lastError: code === 0 ? null : `sync_database.py exited with code ${code}`,
      };

      console.log(`RAG knowledge sync finished with code ${code}`);
      resolve({ ok: code === 0, exitCode: code });
    });
  }).finally(() => {
    syncPromise = null;
  });

  return syncPromise;
};

export const scheduleRagKnowledgeSync = (reason = "menu_changed", delayMs = 3000) => {
  lastSyncStatus = {
    ...lastSyncStatus,
    queued: true,
    lastReason: reason,
  };

  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncRagKnowledgeBase(reason).catch((error) => {
      console.error("Scheduled RAG sync failed:", error.message);
    });
  }, delayMs);
};

export const ensureRagServiceRunning = async () => {
  if (await isRagServiceHealthy()) {
    return true;
  }

  if (!startPromise) {
    startPromise = (async () => {
      startRagProcess();

      for (let attempt = 0; attempt < 20; attempt += 1) {
        await sleep(750);

        if (await isRagServiceHealthy()) {
          return true;
        }
      }

      return false;
    })().finally(() => {
      startPromise = null;
    });
  }

  return startPromise;
};
