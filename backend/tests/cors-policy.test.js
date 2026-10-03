import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import express from "express";
import cors from "cors";
import { createAllowedOriginValidator, createCorsOptions } from "../src/config/corsPolicy.js";

const currentPreview = "https://restaurant-ai-nk2b-git-main-jagmeet0430s-projects.vercel.app";
const hashPreview = "https://restaurant-ai-nk2b-abc123-jagmeet0430s-projects.vercel.app";
const config = {
  appConfig: { nodeEnv: "production", mode: "online", port: 5001 },
  corsConfig: { origins: ["https://explicit.example"], allowLanOrigins: false, lanClientPorts: ["3000", "5173", "5500"] },
  frontendUrl: "https://frontend.example",
  adminUrl: "https://admin.example",
};
const allowed = createAllowedOriginValidator(config);

for (const origin of [undefined, "", "https://restaurant-ai-nk2b.vercel.app", currentPreview, hashPreview,
  "https://restaurant-ai-nk2b-git-feature-orders-jagmeet0430s-projects.vercel.app",
  "https://explicit.example", "https://frontend.example", "https://admin.example", "http://localhost:5173"]) {
  test(`allows ${origin || "missing Origin"}`, () => assert.equal(allowed(origin), true));
}

const rejected = [
  "https://malicious-project.vercel.app",
  "https://restaurant-ai-nk2b-abc123-other-team.vercel.app",
  "https://other-project-abc123-jagmeet0430s-projects.vercel.app",
  "https://restaurant-ai-nk2b-abc123-jagmeet0430-attacker.vercel.app",
  "https://restaurant-ai-nk2b-abc123-jagmeet0430s-projects.vercel.app.evil.example",
  "https://restaurant-ai-nk2b-abc123-jagmeet0430s-projects.evil.vercel.app",
  "https://evil.example/restaurant-ai-nk2b-abc123-jagmeet0430s-projects.vercel.app",
  "https://evil.example?origin=" + currentPreview,
  "https://restaurant-ai-nk2b--jagmeet0430s-projects.vercel.app",
  currentPreview + "/path", currentPreview + "/", currentPreview + "#fragment", currentPreview + ":8443",
  currentPreview.replace("https:", "http:"),
  currentPreview.replace("https://", "https://user:password@"),
  "null", "*", "not a url", "https://restaurant-ai-nk2b.vercel.app\r\nX-Fake: allowed",
  "http://localhost:5001", "http://192.168.1.20:5001",
];
for (const origin of rejected) {
  test(`rejects ${JSON.stringify(origin)}`, () => assert.equal(allowed(origin), false));
}

test("local and LAN policy retains environment, port, and ALLOW_LAN_ORIGINS gates", () => {
  for (const appConfig of [{ ...config.appConfig, mode: "local" }, { ...config.appConfig, nodeEnv: "development" }]) {
    const local = createAllowedOriginValidator({ ...config, appConfig });
    assert.equal(local("http://localhost:5001"), true);
    assert.equal(local("http://127.0.0.1:3000"), true);
    assert.equal(local("http://localhost:9999"), false);
    assert.equal(local("http://192.168.1.20:5001"), false);
    assert.equal(local("null"), appConfig.nodeEnv !== "production");
    const lan = createAllowedOriginValidator({ ...config, appConfig, corsConfig: { ...config.corsConfig, allowLanOrigins: true } });
    for (const host of ["192.168.1.20", "10.0.0.4", "172.16.0.4", "172.31.255.4"]) assert.equal(lan(`http://${host}:5001`), true);
    for (const origin of ["http://192.168.1.20:9999", "http://172.32.0.4:5001", "http://10.evil.example:5001", "http://192.168.evil.example:5001"]) {
      assert.equal(lan(origin), false);
    }
  }
});

test("rejected-origin logs omit credentials, paths, queries and invalid text", () => {
  const logs = [];
  const options = createCorsOptions({ ...config, onRejected: origin => logs.push(origin) });
  options.origin("https://user:password@evil.example/secret?token=sensitive", error => assert.equal(error.message, "CORS blocked origin"));
  options.origin("invalid\r\nsecret", error => assert.ok(error));
  assert.deepEqual(logs, ["https://evil.example", "<invalid-origin>"]);
});

test("real CORS middleware reflects trusted origins, handles preflight, and blocks untrusted origins", async () => {
  const app = express();
  app.use(cors(createCorsOptions(config)));
  // Fixture handlers isolate middleware behavior from the restaurant database.
  app.get(["/api/menu", "/api/settings/public"], (req, res) => res.json({ success: true, data: [] }));
  app.use((error, req, res, next) => res.status(403).json({ message: error.message }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const origin of [currentPreview, hashPreview, "https://restaurant-ai-nk2b.vercel.app"]) {
      for (const endpoint of ["/api/menu?available=true", "/api/settings/public"]) {
        const result = await fetch(base + endpoint, { headers: { Origin: origin } });
        assert.equal(result.status, 200);
        assert.equal(result.headers.get("access-control-allow-origin"), origin);
        assert.equal(result.headers.get("access-control-allow-credentials"), "true");
        assert.match(result.headers.get("vary"), /Origin/);
        await result.text();
      }
      const preflight = await fetch(base + "/api/customers/otp/send", {
        method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,authorization,idempotency-key" },
      });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
      assert.match(preflight.headers.get("access-control-allow-methods"), /POST/);
      assert.match(preflight.headers.get("access-control-allow-headers"), /Idempotency-Key/);
      assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
    }
    for (const method of ["GET", "OPTIONS"]) {
      const result = await fetch(base + "/api/menu", { method, headers: { Origin: "https://malicious-project.vercel.app" } });
      assert.equal(result.status, 403);
      assert.equal(result.headers.get("access-control-allow-origin"), null);
      await result.text();
    }
    const noOrigin = await fetch(base + "/api/menu");
    assert.equal(noOrigin.status, 200);
    assert.equal(noOrigin.headers.get("access-control-allow-origin"), null);
    await noOrigin.text();
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
