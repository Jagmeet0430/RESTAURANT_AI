import { isIP } from "node:net";

const stableFrontendOrigin = "https://restaurant-ai-nk2b.vercel.app";
const previewHostname = /^restaurant-ai-nk2b-[a-z0-9]+(?:-[a-z0-9]+)*-jagmeet0430s-projects\.vercel\.app$/;
const defaultOrigins = [
  "https://mahesh-bakery-menu.dwivedibharat969.chatgpt.site",
  "http://localhost:5500",
  "http://localhost:5501",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

export function createAllowedOriginValidator({ appConfig, corsConfig, frontendUrl, adminUrl }) {
  const explicitOrigins = new Set([
    stableFrontendOrigin, ...defaultOrigins, ...corsConfig.origins, frontendUrl, adminUrl,
  ].filter(Boolean));
  const isDevelopment = appConfig.nodeEnv !== "production";
  const localRuntime = isDevelopment || appConfig.mode === "local";
  const ports = new Set([...corsConfig.lanClientPorts, String(appConfig.port)].filter(Boolean));

  return function isAllowedOrigin(origin) {
    if (!origin) return true;
    // Preserve file-origin support in development and deliberate explicit entries.
    if (origin === "null") return explicitOrigins.has(origin) || isDevelopment;
    if (typeof origin !== "string") return false;

    try {
      const url = new URL(origin);
      // An Origin is a scheme/host/port tuple, never a URL with credentials or a path.
      if (origin !== url.origin || !["http:", "https:"].includes(url.protocol)) return false;
      if (explicitOrigins.has(origin)) return true;

      if (url.protocol === "https:" && !url.port && previewHostname.test(url.hostname)) return true;
      if (!localRuntime || !ports.has(url.port)) return false;

      const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      const isPrivateLan = isIP(url.hostname) === 4 && (
        url.hostname.startsWith("192.168.") || url.hostname.startsWith("10.") ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(url.hostname)
      );
      return isLocalHost || (corsConfig.allowLanOrigins && isPrivateLan);
    } catch {
      return false;
    }
  };
}

export function createCorsOptions(config) {
  const isAllowedOrigin = createAllowedOriginValidator(config);
  return {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      // Do not echo paths, credentials, control characters, or arbitrary header text.
      let safeOrigin = "<invalid-origin>";
      try {
        const url = new URL(origin);
        if (["http:", "https:"].includes(url.protocol)) safeOrigin = url.origin.slice(0, 253);
      } catch { /* Malformed origins have no safe URL representation. */ }
      config.onRejected?.(safeOrigin);
      return callback(new Error("CORS blocked origin"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "Idempotency-Key"],
    credentials: true,
    optionsSuccessStatus: 204,
  };
}
