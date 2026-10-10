import { pool } from "../config/database.js";
import { appConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { cloudSyncConfig, syncError, syncLog } from "../config/cloudSyncConfig.js";
import { importCloudOrder } from "./cloudOrderImportService.js";

export function createCloudOrderSyncWorker({ db = pool, config, fetchImpl = globalThis.fetch, log = logger } = {}) {
  let stopped = false, running = null, timer = null, controller = null, cursor = 0;
  async function request(path, body, method = "POST") {
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 10000);
    try {
      const response = await fetchImpl(`${config.baseUrl}/sync${path}`, {
        method: body === undefined ? "GET" : method,
        headers: { Authorization: `Bearer ${config.secret}`, Accept: "application/json", "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal, redirect: "error",
      });
      if (!response.ok) throw syncError(`SYNC_HTTP_${response.status}`, response.status);
      const payload = await response.json();
      if (!payload.success) throw syncError("SYNC_INVALID_RESPONSE");
      return payload.data;
    } finally { clearTimeout(timeout); controller = null; }
  }
  async function ack(order) {
    if (stopped) return;
    await request(`/orders/${order.cloud_order_id}/ack`, { local_order_id: order.id });
    await db.query(`UPDATE orders SET cloud_synced_at = CURRENT_TIMESTAMP,
      cloud_sync_status = CASE WHEN cloud_sync_version = 0 THEN 'synced' ELSE cloud_sync_status END WHERE id = $1`, [order.id]);
  }
  async function pushStatuses() {
    const result = await db.query(`SELECT e.*, o.cloud_order_id FROM cloud_order_sync_events e
      JOIN orders o ON o.id = e.order_id
      WHERE e.delivered_at IS NULL AND e.next_attempt_at <= CURRENT_TIMESTAMP
        AND o.cloud_synced_at IS NOT NULL AND o.cloud_sync_origin = $1
        AND NOT EXISTS (SELECT 1 FROM cloud_order_sync_events older
          WHERE older.order_id = e.order_id AND older.version < e.version AND older.delivered_at IS NULL)
      ORDER BY e.id LIMIT 50`, [config.baseUrl]);
    for (const event of result.rows) {
      if (stopped) break;
      try {
        await request(`/orders/${event.cloud_order_id}/status`, event.payload, "PATCH");
        await db.query("UPDATE cloud_order_sync_events SET delivered_at = CURRENT_TIMESTAMP, last_error_code = NULL WHERE id = $1", [event.id]);
        await db.query(`UPDATE orders SET cloud_sync_status = 'synced', cloud_synced_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND cloud_sync_version = $2`, [event.order_id, event.version]);
      } catch (error) {
        syncLog(log, "push_status", error, event.cloud_order_id);
        await db.query(`UPDATE cloud_order_sync_events SET attempts = attempts + 1,
          last_error_code = $2, next_attempt_at = CURRENT_TIMESTAMP + ($3::int * INTERVAL '1 second') WHERE id = $1`,
        [event.id, /^SYNC_HTTP_\d+$/.test(error.code || "") ? error.code : "SYNC_RETRY", Math.min(300, 10 * 2 ** Math.min(event.attempts, 5))]);
      }
    }
  }
  async function run() {
    // Recover a committed import even if the ACK response was lost or the
    // cloud has already acknowledged it and no longer returns it as pending.
    const unacked = await db.query(`SELECT id, cloud_order_id FROM orders
      WHERE cloud_order_id IS NOT NULL AND cloud_synced_at IS NULL AND cloud_sync_origin = $1 ORDER BY id LIMIT 50`, [config.baseUrl]);
    for (const order of unacked.rows) {
      if (stopped) return;
      try { await ack(order); } catch (error) { syncLog(log, "ack", error, order.cloud_order_id); }
    }
    if (stopped) return;
    await pushStatuses();
    if (stopped) return;
    const data = await request(`/orders/pending${cursor ? `?after_id=${cursor}` : ""}`);
    if (!Array.isArray(data?.orders) || data.orders.length > 50) throw syncError("SYNC_INVALID_RESPONSE");
    for (const order of data.orders) {
      if (stopped) return;
      try {
        const imported = await importCloudOrder(db, order, config.baseUrl);
        await ack(imported.order);
      } catch (error) { syncLog(log, "import", error, order?.cloud_order_id); }
    }
    cursor = Number(data.next_after_id) || 0;
  }
  function tick() {
    if (stopped || running) return running || Promise.resolve();
    running = run().catch(error => syncLog(log, "poll", error)).finally(() => { running = null; });
    return running;
  }
  return {
    tick,
    start() { if (!timer && !stopped) { void tick(); timer = setInterval(tick, config.intervalMs); timer.unref?.(); } },
    async stop() { stopped = true; clearInterval(timer); controller?.abort(); await running; },
  };
}

export function startCloudOrderSyncWorker() {
  if (appConfig.mode !== "local") return null;
  try {
    const config = cloudSyncConfig();
    if (!config.enabled) return null;
    const worker = createCloudOrderSyncWorker({ config });
    worker.start();
    logger.info("Cloud order sync worker started", { intervalSeconds: config.intervalMs / 1000 });
    return worker;
  } catch (error) {
    syncLog(logger, "configuration", error);
    return null;
  }
}
