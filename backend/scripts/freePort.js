import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";

const getEnvPort = () => {
  try {
    const envFile = readFileSync(".env", "utf8");
    const match = envFile.match(/^PORT=(\d+)$/m);

    return match?.[1];
  } catch {
    return null;
  }
};

const port = process.argv[2] || getEnvPort() || "5000";

if (!port || !/^\d+$/.test(port)) {
  console.error("Usage: node scripts/freePort.js <port>");
  process.exit(1);
}

if (process.platform !== "win32") {
  process.exit(0);
}

const output = execFileSync("netstat", ["-ano"], {
  encoding: "utf8",
});

const processIds = new Set();

for (const line of output.split(/\r?\n/)) {
  const columns = line.trim().split(/\s+/);
  const localAddress = columns[1] || "";
  const state = columns[3] || "";
  const processId = columns[4] || "";

  if (
    state === "LISTENING" &&
    localAddress.endsWith(`:${port}`) &&
    /^\d+$/.test(processId)
  ) {
    processIds.add(processId);
  }
}

for (const processId of processIds) {
  console.log(`Stopping existing process ${processId} on port ${port}`);
  try {
    execFileSync("taskkill", ["/PID", processId, "/F"], {
      stdio: "inherit",
    });
  } catch {
    try {
      execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          `Stop-Process -Id ${processId} -Force`,
        ],
        {
          stdio: "inherit",
        }
      );
    } catch {
      console.warn(
        `Could not stop process ${processId}. If npm run dev still fails, run PowerShell as Administrator and use: Stop-Process -Id ${processId} -Force`
      );
    }
  }
}
