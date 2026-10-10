import crypto from "node:crypto";
import express from "express";
import { pool } from "../config/database.js";
import { appConfig } from "../config/index.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import { logger } from "../utils/logger.js";
import { syncError, syncLog } from "../config/cloudSyncConfig.js";
import { pendingCloudOrders, acknowledgeCloudOrder, applyCloudOrderStatus } from "../services/cloudOrderSyncApiService.js";

const digest = value => crypto.createHash("sha256").update(value).digest();
const positiveId = value => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw syncError("SYNC_INVALID_ID", 400);
  return id;
};

export function createCloudSyncRouter({ db = pool, mode = appConfig.mode, secret = () => process.env.CLOUD_SYNC_SECRET || "" } = {}) {
  const router = express.Router();
  router.use(createRateLimiter({ windowMs: 60_000, max: 240, keyPrefix: "cloud-sync" }));
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (mode !== "online") return res.status(404).json({ success: false, message: "Not found" });
    const expected = secret();
    const token = /^Bearer ([^\s]+)$/.exec(req.get("Authorization") || "")?.[1] || "";
    if (expected.length < 32 || expected.length > 512) return res.status(503).json({ success: false, message: "Sync is not configured" });
    if (req.get("Origin") || token.length > 512 || !crypto.timingSafeEqual(digest(token), digest(expected))) {
      return res.status(401).json({ success: false, message: "Sync authentication required" });
    }
    next();
  });
  const handle = action => async (req, res) => {
    try { res.json({ success: true, data: await action(req) }); }
    catch (error) {
      syncLog(logger, "cloud_api", error, req.params.cloudOrderId);
      res.status(error.statusCode || 503).json({ success: false,
        code: /^SYNC_[A-Z_]+$/.test(error.code || "") ? error.code : "SYNC_RETRY",
        message: "Unable to synchronize this order right now." });
    }
  };
  router.get("/orders/pending", handle(async req => {
    const after = req.query.after_id == null ? 0 : positiveId(req.query.after_id);
    const orders = await pendingCloudOrders(db, after);
    return { orders, next_after_id: orders.length === 50 ? orders.at(-1).cloud_order_id : null };
  }));
  router.post("/orders/:cloudOrderId/ack", handle(req => acknowledgeCloudOrder(db,
    positiveId(req.params.cloudOrderId), positiveId(req.body.local_order_id))));
  router.patch("/orders/:cloudOrderId/status", handle(req => applyCloudOrderStatus(db,
    positiveId(req.params.cloudOrderId), req.body)));
  return router;
}

export default createCloudSyncRouter();
