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

const isPortStillListening = () => {
  const currentOutput = execFileSync("netstat", ["-ano"], {
    encoding: "utf8",
  });

  return currentOutput.split(/\r?\n/).some((line) => {
    const columns = line.trim().split(/\s+/);
    const localAddress = columns[1] || "";
    const state = columns[3] || "";

    return state === "LISTENING" && localAddress.endsWith(`:${port}`);
  });
};

for (const processId of processIds) {
  console.log(`Stopping existing process ${processId} on port ${port}`);
  try {
    execFileSync("taskkill", ["/PID", processId, "/F"]);
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
      );
    } catch {
      console.warn(
        `Could not stop process ${processId}. If npm run dev still fails, run PowerShell as Administrator and use: Stop-Process -Id ${processId} -Force`
      );
    }
  }
}

if (processIds.size > 0 && isPortStillListening()) {
  console.error(
    `Port ${port} is still in use. Close the existing backend window or run PowerShell as Administrator and stop the process above.`
  );
  process.exit(1);
}
