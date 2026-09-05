# RestaurantAI 1.0.0 Release Notes

Release target: offline/local Windows deployment.

## Scope

- Local Express backend, PostgreSQL database, Admin UI, POS, Kitchen, and Customer UI.
- Windows installer output: `RestaurantAI-Setup-1.0.0.exe`.
- Persistent state is stored outside the app install directory under `C:\ProgramData\RestaurantAI`.

## Phase 6 Hardening

- Added explicit `/api/ready` readiness checks so startup waits for PostgreSQL before declaring the app ready.
- Added authenticated `/api/diagnostics` for operators. It reports app version, local mode, DB status, LAN URLs, backup freshness, and writable storage checks without returning secrets.
- Added redacted structured backend logs for startup, database checks, request errors, CORS blocks, and fatal errors.
- Added shutdown handling that stops the order lifecycle worker, closes HTTP connections, and drains the PostgreSQL pool.
- Added launcher log rotation for `backend.log` and `backend-error.log`.
- Tightened operator routes for inventory, suppliers, coupons, settings, OCR, POS, menu/category management, AI prediction, and offline payment marking.
- Added rate limiting for login, initial registration, token verification, and token refresh.
- Hardened OCR upload filenames and restricted OCR to authenticated operator roles.
- Disabled dotfile serving from Admin and Customer static assets.
- Added POS counter-sale idempotency via `Idempotency-Key` and an additive `counter_sales.idempotency_key` schema guard.
- Added a read-only data integrity checker at `npm run diagnostics:data` from the `backend` directory.

## Data Notes

- Customer report totals are derived from committed orders/counter sales in reporting queries rather than trusting stale customer counters.
- Coupon usage counters are retained in schema and reports. This release does not apply coupons during checkout, so `used_count` remains an administrative/reporting field until checkout coupon redemption is implemented.
- Existing production data is not dropped or rewritten by the Phase 6 changes. Additive schema guards only add missing POS idempotency support.

## Known Operational Notes

- Keep a current full backup before upgrades and before pilot opening.
- Install and run on a private LAN. Avoid exposing the backend directly to the public internet.
- Optional AI/OCR runtimes remain optional; the core restaurant workflow runs without them.
- Code signing is not configured in this repository. Sign the installer with an organization certificate before broad distribution.
