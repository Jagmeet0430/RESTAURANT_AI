# Cloud-to-Local Order Sync

## Architecture

The public site continues to use Render/Supabase. Admin, Kitchen, POS, kiosk and
table QR continue to use local PostgreSQL. The local backend polls the cloud
over outbound HTTPS. No inbound firewall rule, public Admin access or exposed
PostgreSQL port is needed.

Both sides use the existing orders, order_items, customers, bills, payments and
order_status_history tables. New cloud orders use source `website`; existing
`customer_web` orders are also eligible. Local customer-web, kiosk, POS and QR
sources retain their existing behavior. Per the restaurant's requested policy,
website pay-at-counter orders appear in Kitchen before payment. They remain
unpaid, retain Mark paid controls, and do not become paid on completion.
Unpaid Razorpay orders still wait for successful payment before import.

## Deployment

1. Back up both databases. Deploy the updated backend on Render and locally.
2. Apply migration `backend/database/migrations/016_cloud_order_sync.sql` to
   **each** database after migrations 014 and 015. It adds metadata, a unique
   cloud-order index and a durable delivery queue; it does not rewrite orders.
   From `backend`, with the correct environment loaded, the explicit command is:

   ```powershell
   node scripts/migrateCloudOrderSync.js
   ```

   This uses the existing `RESTAURANTAI_MODE`/database configuration. On Render,
   run it in the backend service environment. Locally, use the installed local
   environment file via `RESTAURANTAI_ENV_FILE` when applicable. Verify the
   selected database before running. Migration reruns are safe.
3. Generate a dedicated random secret of at least 32 characters using a secure
   password generator and set the same value on Render and the local backend.
   Never put it in Vercel, VITE variables, frontend/config.js, Git, or screenshots.
4. Render configuration:

   ```env
   RESTAURANTAI_MODE=online
   CLOUD_SYNC_ENABLED=false
   CLOUD_SYNC_SECRET=<dedicated-secret>
   ```

5. Local configuration:

   ```env
   RESTAURANTAI_MODE=local
   CLOUD_SYNC_ENABLED=true
   CLOUD_SYNC_BASE_URL=https://restaurant-ai-4myq.onrender.com/api
   CLOUD_SYNC_SECRET=<same-dedicated-secret>
   CLOUD_SYNC_INTERVAL_SECONDS=10
   ```

6. Restart both backends; rebuild/deploy Admin for the website workflow-button
   exception. No customer frontend deployment or installer rebuild is needed
   for this source implementation. Installed binaries still need an updated
   release before they can run the worker.
7. Place a clearly identified real website test order; verify local Admin and
   Kitchen, change its status, and verify the original cloud tracking URL.
   Do not assume local integration tests prove Render deployment is configured.

Setting `CLOUD_SYNC_ENABLED=false` stops polling after restart. Local orders still
work. Imported-order changes remain queued so re-enabling resumes delivery.
An unset/short cloud secret disables sync APIs. Rotate both secrets together.

## Protocol and Safety

- `GET /api/sync/orders/pending?after_id=<id>`: up to 50 unacknowledged website
  orders; keyset pagination prevents one unmappable order from blocking backlog.
- `POST /api/sync/orders/:cloudOrderId/ack`: `{ "local_order_id": 123 }`.
- `PATCH /api/sync/orders/:cloudOrderId/status`: immutable queue snapshot with
  local_order_id, version, status, payment status/method and timing fields.
- All endpoints require `Authorization: Bearer <CLOUD_SYNC_SECRET>`. They are
  disabled in local mode, reject browser Origin headers, use constant-time
  secret comparison, return no-store responses, and are rate-limited.
- The worker uses HTTPS, refuses redirects, times out HTTP requests after 10
  seconds, never overlaps its own runs, and aborts requests during shutdown.
- Imports use an advisory transaction lock plus a unique partial index on
  cloud_order_id. Customer, order, item, inventory and bill changes commit
  together. Only then is the cloud acknowledged. Lost acknowledgements and
  concurrent/repeated imports do not create duplicate sales or deduct stock twice.
- Order-level prices/taxes/packing/discounts come from the authenticated cloud
  payload, not the local menu price or browser. Totals are checked for consistency.
  Original order time/number and normalized phone are preserved. Local daily
  tokens are newly allocated to avoid colliding with kiosk/POS token numbers.
- Menu mapping uses a barcode when present. Otherwise it requires exactly one
  case-insensitive name + category match. Menu IDs need not match. Missing or
  ambiguous mapping, insufficient tracked stock or conflicting order numbers
  rolls back the import and leaves the cloud order pending. Never create dummy
  items to bypass mapping. Tables, when present, map by table number, not ID.
- A database trigger on imported orders records status/payment/timing changes
  in `cloud_order_sync_events` in the same transaction. It does nothing for
  ordinary local orders. There are no HTTP calls in the Kitchen/Admin mutation
  path. An unavailable network cannot block local order processing.
- Events are delivered sequentially per order. The cloud checks the acknowledged
  local ID and next version, applies the existing lifecycle transition validator,
  and treats repeated versions as already delivered. Counter payment settlement
  reuses billingService. Terminal orders cannot regress. Customer tracking reads
  the updated cloud order with the original tracking token.
- Failed status events use persistent exponential retries (10-300 seconds).
  Other orders can continue. Logs contain phase, numeric order ID and safe error
  codes only, never tokens, payloads, phone numbers or raw database errors.
- Imported orders send status WhatsApp notifications from cloud only, avoiding
  duplicate local/cloud messages. Notification delivery remains non-blocking.

## Operations and Limitations

This is a single restaurant/local-database integration, not multi-tenant routing.
Do not run separate restaurant databases against the same cloud queue or change
the cloud base URL to another dataset. An origin mismatch refuses an existing
import; restore/replacement of the local database requires reconciliation of
cloud acknowledgements and delivery versions. Retain both database backups.

Local becomes the lifecycle authority after import. Concurrent cloud staff edits,
refunds or unsupported payment changes return a conflict and need operator review;
the worker does not overwrite them or initiate gateway refunds. Menu/stock sync
and historical refund reconciliation are not included. Cancelled/completed
backlog orders import for history without deducting current stock.

Before enabling on an existing cloud database, inspect the pending backlog:
unacknowledged historical website orders are eligible, not only new orders.
Completed/cancelled orders follow existing Admin history visibility rules and
are not active Kitchen tickets. Repair mapping conflicts and retry; never
delete real orders or zero financial values. Queue retention/monitoring can be
added later; delivered events are retained for audit in this phase.

Useful local diagnostics (read-only):

```sql
SELECT cloud_order_id, cloud_sync_status, cloud_synced_at FROM orders
WHERE cloud_order_id IS NOT NULL ORDER BY id DESC;
SELECT order_id, version, attempts, last_error_code, next_attempt_at
FROM cloud_order_sync_events WHERE delivered_at IS NULL ORDER BY id;
```

## Verification

```powershell
node --experimental-test-module-mocks --test backend/tests/cloud-order-sync.integration.test.js
```

Requires local PostgreSQL with CREATE DATABASE permission; uses local connection
credentials from backend/.env but forces localhost and creates two fresh
`restaurantai_sync_test_<timestamp>_*` databases. Only those disposable databases
are removed afterward. No real customer database is opened or modified. Printer
hardware is stubbed. Cloud HTTP is loopback transport behind an HTTPS-asserting
test adapter, not a live Render/Supabase test.

Coverage includes additive migration reruns, real public checkout/controller
queries, authenticated Admin/Kitchen visibility before counter payment, barcode
mapping across different IDs, preserved totals/time, uniqueness/concurrency,
ACK loss, status replay, ordered offline/restart recovery, tracking progression,
cancellation, payment/bill consistency, mapping failures, valid/invalid secrets,
version/ownership conflicts, local kiosk isolation and worker shutdown.

## Files

Added:
- `backend/database/migrations/016_cloud_order_sync.sql`
- `backend/scripts/migrateCloudOrderSync.js`
- `backend/src/config/cloudSyncConfig.js`
- `backend/src/routes/cloudSyncRoutes.js`
- `backend/src/services/cloudOrderImportService.js`
- `backend/src/services/cloudOrderSyncApiService.js`
- `backend/src/services/cloudOrderSyncService.js`
- `backend/tests/cloud-order-sync.integration.test.js`
- `docs/CLOUD_ORDER_SYNC.md`

Updated:
- `backend/.env.example`: safe opt-in configuration.
- `backend/src/app.js`: dedicated sync route registration.
- `backend/src/server.js`: worker lifecycle.
- `backend/src/services/tableQrService.js`: canonical cloud website source.
- `backend/src/services/orderStatusService.js`: avoid duplicate local/cloud notifications.
- `backend/src/controllers/ordersController.js`: website counter-payment workflow exception.
- `backend/src/routes/kitchenRoutes.js`: show unpaid website tickets.
- `admin/src/components/orders/OrderBoard.jsx`: enable website workflow before payment.

Local-only browser harness/screenshots are in ignored `temp/cloud-sync-ui-check.cjs`,
`temp/cloud-sync-admin-orders.png`, and `temp/cloud-sync-kitchen.png`.
