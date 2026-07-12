import { spawn } from "node:child_process";
import { openSync } from "node:fs";
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
const ragOutLog = path.join(ragDirectory, "logs", "rag_server.out.log");
const ragErrLog = path.join(ragDirectory, "logs", "rag_server.err.log");

let startPromise = null;
let ragProcess = null;

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
