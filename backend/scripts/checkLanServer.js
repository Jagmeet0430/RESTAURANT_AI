import dotenv from "dotenv";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT || "5000";
const mode = process.env.RESTAURANTAI_MODE || "online";
const allowLanOrigins = process.env.ALLOW_LAN_ORIGINS || "false";

const isPrivateIpv4 = (address) =>
  address.startsWith("10.") ||
  address.startsWith("192.168.") ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(address);

const privateIpv4Addresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((network) => network && network.family === "IPv4" && !network.internal)
  .map((network) => network.address)
  .filter(isPrivateIpv4);

const lanEnabled = host === "0.0.0.0" || host === "::";

console.log("RestaurantAI LAN Server Check");
console.log(`Mode: ${mode}`);
console.log(`Host: ${host}`);
console.log(`Port: ${port}`);
console.log(`LAN access: ${lanEnabled ? "enabled" : "disabled"}`);
console.log(`ALLOW_LAN_ORIGINS: ${allowLanOrigins}`);
console.log(`Local health URL: http://127.0.0.1:${port}/api/health`);

if (privateIpv4Addresses.length === 0) {
  console.log("Private IPv4 LAN addresses: none detected");
} else {
  console.log("Private IPv4 LAN addresses:");
  for (const address of privateIpv4Addresses) {
    console.log(`- ${address}`);
    console.log(`  LAN health URL: http://${address}:${port}/api/health`);
    console.log(`  Customer site: http://${address}:${port}/customer`);
  }
}

if (!lanEnabled) {
  console.log("Tip: set HOST=0.0.0.0 on the server PC to accept LAN clients.");
}
