# Durable Admin Order Notifications

Backend-only extension of the existing authenticated Admin orders API. No
Socket.IO, new worker, frontend audio, or competing order store is introduced.

## Activation

Migration `backend/database/migrations/017_admin_order_notifications.sql` is
additive and must be applied through the normal reviewed database migration
process before enabling the Admin notification reader. It is not run on startup.
This change does not update the pending Windows installer/deployment scripts.
No live database migration was run as part of implementation.

Existing orders remain notification-ineligible. Orders inserted after migration,
including imports carrying an older cloud creation timestamp, default to eligible.
This avoids replaying historical bills on first activation. Apply the migration
before accepting orders that must generate alerts.

## Delivery and recovery

- Creation hooks run only after successful COMMIT in both order controllers and
  the cloud importer. They use the pool, never the order transaction connection.
- Queue insertion reads committed eligible kiosk, website/customer_web and table
  QR orders. POS and unconfirmed/cancelled records are excluded.
- `order_id` is the queue primary key. Concurrent retries use `ON CONFLICT DO
  NOTHING`. Acknowledged rows are retained permanently, so neither cloud retries
  nor worker/backend restarts recreate acknowledged alerts.
- Hooks are non-blocking and contain notification errors. Order creation, payment
  totals and sync acknowledgements do not depend on queue insertion succeeding.
- Reading pending notifications reconciles up to 200 missing committed events,
  newest local order IDs first so older recovery backlogs cannot hide new arrivals.
  This repairs notification outages and crashes between order COMMIT and enqueue.
  No created-at cursor is used, so delayed imports are not skipped.
- Recovery requires a pending-reader request; there is no background timer added.
- Acknowledgement is restaurant-wide, not per user/device. It changes notification
  state only, not order status or payment. The first actor/time are preserved.

## API

Existing JWT authentication; roles `admin` and `staff`; rate-limited, no-store.

- `GET /api/admin/orders/notifications?limit=50&cursor=<next_cursor>` (limit 1-100;
  omit cursor for the newest page):
  `data: { notifications: [{ order_id, event_type, payload, created_at, item_count, grand_total, status }], has_more, next_cursor }`.
  Payload contains order ID/number, source/type, table and token, not customer PII.
  `item_count` counts item lines (matching the existing Admin popup), not units.
  `grand_total` is the saved `orders.total_amount` decimal, never recalculated.
  Only unacknowledged orders currently Confirmed are pending; Accepted, Preparing,
  Ready, Completed and Cancelled orders are excluded without altering their events.
  Results use descending local order IDs; `next_cursor` is an exclusive order ID
  boundary, or null on the last page. Follow it while `has_more` is true. Start at
  the newest page again to discover concurrent arrivals; old cloud timestamps do
  not affect ordering. Existing response fields and acknowledgement behavior remain.
- `POST /api/admin/orders/notifications/:orderId/ack`: no request body fields needed.
  Returns the saved order ID, acknowledgement timestamp and actor; repeat is safe.
- Missing migration/database outage returns generic 503, not an empty successful
  result. Invalid IDs/limits/cursors return 400; unknown notification 404.

Pending delivery is intentionally at-least-once until acknowledged. The future
Admin client must deduplicate popup/audio by stable `order_id` and acknowledge
explicitly. Unique persisted events alone cannot guarantee exactly-once audio
across browser crashes or simultaneous tabs.

## Admin sound and device preferences

- The existing Admin provider polls the pending API; notification metadata now
  comes directly from that response, without per-order detail requests.
- `GET /api/settings/order-notifications` returns only notification policy to
  authenticated admin/staff. Admin saves it through the existing `PUT /api/settings`
  and `app_settings` restaurant record. Public settings do not expose the policy.
- Policy fields: `orderNotificationPopup`, `orderNotificationSound`,
  `orderNotificationVoice`, `orderNotificationLanguage` (`en`/`hi`),
  `orderNotificationRepeatSeconds` (`0`, `30`, `60`, `120`, `300`), and
  `orderNotificationAutoNavigate`. Booleans follow the existing string convention.
  Popup/sound default on; voice, reminders and auto-navigation default off.
- Volume, audio-unlock preference and the desktop permission mirror are browser
  only. A saved unlock preference never bypasses the new document's gesture gate.
  Browser permission is authoritative. Desktop notifications need a supported,
  secure browser context; permission is requested only by the Enable button.
- A local Web Audio chime and installed speechSynthesis voices require no remote
  audio API. Hindi falls back to a local English voice, otherwise visual feedback.
  Chatbot and order speech share one bounded queue and a cross-tab speech lease.
  Closing chatbot cancels only its speech; logout clears alert speech and notices.
- Announced IDs/reminder times persist locally before dispatch (at-most-once
  attempts, not proof of audible delivery). Snooze/dismiss suppress device audio
  without acknowledging orders. The bounded 5,000-ID ledger fails visibly rather
  than evicting IDs and replaying old announcements; storage failures also leave
  visual alerts available. Uncertain browser/audio crashes can lose an attempt.
- Auto-navigation is opt-in and restricted to Dashboard with no inputs, editable
  content or dialogs. It never automatically leaves Settings, forms or payments.
- Browser tests mock audio, voices and desktop permission. They do not certify
  actual speakers, installed Hindi voices or operating-system notification delivery.

## Isolated regression test

`node --experimental-test-module-mocks --test backend/tests/admin-order-notifications.integration.test.js`

Requires local PostgreSQL binaries (default Windows PostgreSQL 18 path; override
`RESTAURANTAI_TEST_PG_BIN` elsewhere). Starts a fresh temporary loopback-only
cluster on an unused port, mocks the installed database/printer, and stops that
cluster in cleanup. It never opens restaurant_db or a cloud database. Fixture
files remain in the OS temp directory for diagnosis.
