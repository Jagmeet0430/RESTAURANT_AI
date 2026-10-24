# Automatic menu synchronization (1.4.7 candidate)

## Scope and architecture

Previously, Restaurant PC menu edits only changed local PostgreSQL. Vercel read a
different cloud database, images could be inline/local-only, and numeric menu IDs
were not guaranteed to match. Cloud order import existed; outbound catalog
replication did not.

Local Admin is the authoritative catalog editor. Migration 018 adds stable UUIDs,
versions, visibility and soft-delete metadata without changing existing numeric
IDs or historical sale amounts. PostgreSQL triggers capture a complete snapshot
in `menu_sync_outbox` in the same transaction as each category/product change.
Rollback therefore leaves no event. A serialized revision counter avoids missing
late commits. Initial catalog rows are queued once; rerunning the migration does
not duplicate bootstrap snapshots.

The local worker extends the existing machine-authenticated `/api/sync` transport:
outbound HTTPS `POST /api/sync/menu/batch`, existing server-only shared secret,
existing browser-Origin rejection and rate limit. It batches up to 20 snapshots,
coalesces offline edits to the latest version per stable identity, sends categories
before products, and retries with persisted bounded exponential backoff (5-300s).
A network timeout or lost acknowledgement does not mark a change delivered.
Only matching committed cloud acknowledgements mark that version and its older
superseded snapshots delivered. Worker restart resumes the durable outbox.

Cloud application is transaction-per-event with an advisory lock and a durable
highest-version receipt. Duplicate/older versions acknowledge without overwriting
newer data. Restaurant and source UUIDs must match configured identities. Existing
cloud rows are adopted only on a unique barcode or category/name identity; original
identity is retained for edits made before first publication. Ambiguous/conflicting
matches stop with an Admin-visible error, rather than guessing or deleting rows.
Both catalogs must be reconciled manually before activation if their legacy names,
barcodes or categories already differ. Never change source/restaurant UUIDs or point
a delivered outbox at another database without a reviewed reseeding plan.

Cloud browser CRUD is blocked when menu sync is enabled; edits belong on the
Restaurant PC. Normal role checks remain required locally. Deletes are soft
deletions; historical order references remain valid. Imported website orders prefer
the stable product UUID; existing barcode/name matching remains the legacy fallback.

## Images

New uploads accept JPEG, PNG and WebP only, validate decoded content and MIME,
limit input to 2 MiB, 16 million pixels and 6000px per edge, reject animation, and
resize without enlargement to fit 900x900 while preserving aspect ratio. Optimized
WebP bytes are persisted in local PostgreSQL, not Render's ephemeral filesystem.
The kiosk reads immutable `/api/menu/images/<sha256>.webp` URLs, including offline.
Bundled menu image paths are contained in the known assets directory; file URLs,
LAN/IP URLs and arbitrary local paths are not publishable.

Render uploads content-addressed objects to public Supabase Storage bucket
`menu-images`, under `<restaurant UUID>/<hash>.webp`. The server key is Render-only.
Successful upload plus a successful public image HEAD check is required before the
new menu version commits. On storage failure the old cloud product remains live;
the local save is retained and publication retries. Old image objects are never
deleted automatically. Existing valid public HTTPS image URLs are retained, not
copied; availability of those third-party URLs remains their provider's responsibility.
Bundled fallback photos retain a separate source photo ID, never used for orders.

References: [Supabase standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads),
[Sharp input limits](https://sharp.pixelplumbing.com/api-constructor/),
[Sharp resize](https://sharp.pixelplumbing.com/api-resize/).

## Browser refresh and checkout

- Kiosk checks the lightweight menu revision every 10s; public website every 15s.
- Public focus, visibility, menu revisit and hover trigger refresh; hidden tabs skip
  polling. Cache lifetime is 60s; revision changes fetch the current catalog.
- Existing grid/checkout styling is unchanged. Refresh preserves cart quantities and
  customer details, reprices changed products, and marks removed products unavailable.
  Active submission snapshots are not mutated. Images load independently of menu data.
- Backend checkout locks and validates current products, category status, channel
  visibility and availability. An optional expected unit price causes a 409 re-quote
  if stale; supplied prices never determine the server total.
- Existing tax calculation, OTP policy, idempotency, fees and payments remain in
  their canonical services. There is no per-product tax configuration in the current
  menu model to replicate. Keep the existing global tax configuration consistent on
  both deployments; this feature does not introduce a second tax engine.
- Historical totals, tax, packing and payment values are not recalculated.

Admin Menu shows server-verified pending count, last cloud acknowledgement time,
local-save/sync status and safe errors, with authenticated Retry. A send attempt is
not a successful sync. Retries do not create new product identities.

## Configuration (default OFF)

No real environment file was changed. Do not put keys in Admin/Vercel bundles.

On both Restaurant PC and Render, after migration and identity review:

```dotenv
MENU_SYNC_ENABLED=false
MENU_SYNC_RESTAURANT_ID=<one stable UUID for this restaurant>
MENU_SYNC_SOURCE_ID=<one stable UUID for its authoritative local catalog>
```

Restaurant PC only: reuse the existing `CLOUD_SYNC_SECRET`, HTTPS
`CLOUD_SYNC_BASE_URL` and `CLOUD_SYNC_INTERVAL_SECONDS` (default 10, allowed 5-300).
`MENU_SYNC_ENABLED` controls outbound menu sync independently of the inbound
`CLOUD_SYNC_ENABLED` order worker. Do not change existing working order-sync settings.

Render only, in addition to the existing shared sync secret:

```dotenv
MENU_IMAGE_STORAGE_URL=https://<project-ref>.supabase.co
MENU_IMAGE_STORAGE_BUCKET=menu-images
MENU_IMAGE_STORAGE_SERVICE_KEY=<server-only Supabase storage service credential>
```

Create the public bucket explicitly in the approved Supabase project. Public means
image reads are public, not anonymous writes. Restrict upload types to image/webp
and size appropriately; do not grant anonymous write access. Grant the server key
the necessary storage upload/upsert permissions. Never send the key to the PC or
browser, log it, or package it. The implementation does not create production buckets.

## Safe deployment order

1. Review the complete dirty worktree release independently; this feature does not
   approve unrelated changes. Archive the older pre-menu-sync 1.4.7 installer.
2. Back up and verify restore for each real database. Check migration ledgers and
   actual schemas before proceeding. Do not assume manually applied migrations have
   ledger entries. In particular, do not blindly migrate the current development DB.
3. Cloud: follow `SUPABASE_MENU_RECEIVER_REVIEW.md` and obtain a verified backup and
   reviewed schema export first. Keep sync OFF. A fresh receiver uses the separate
   `backend/database/cloud/018_menu_sync_receiver.sql`, not local migration 018.
   An empty ledger does not authorize replaying 013-017 or inventing history.
   This is a separate approved Render/Supabase operation, not something the Windows
   installer performs remotely. Render code/dependencies require separate approval.
4. Configure the approved public bucket and Render-only credential. Reconcile legacy
   catalog identity conflicts. Set matching UUIDs and enable cloud menu acceptance.
5. Deploy the updated public frontend once. Thereafter individual menu edits require
   no Git push or Vercel redeploy. Preserve the existing production API configuration.
6. Upgrade the Restaurant PC only after approval and verified backup. Existing
   installer preparation applies 018 after 017, with the existing backup/transaction
   checks. AppId, persistent ProgramData .env, DB and printer settings are unchanged.
   Configure the stable UUIDs and explicitly enable local menu sync only afterwards.
   The local 019 import-DELETE fix is prepared separately and requires reviewed
   installer registration before the next local release; it is not auto-applied.
7. Observe initial queue drain, compare local/cloud categories, prices and photos,
   then test one authorized real order/import, unavailable-item rejection and an
   offline/reconnect edit. Check notification and actual EC58B output on hardware.
8. Keep backups and previous binaries. Disabling menu sync stops outbound publication;
   it does not remove 018. Do not drop added tables or overwrite historical data for
   rollback. Review compatibility before downgrading binaries.

The old EXE predates this feature. A newly built Windows candidate is not a cloud
deployment and does not activate production sync. No installation, service/task/
firewall changes, production migration, bucket creation, commit or push is automatic.

## Validation

`backend/tests/menu-sync.integration.test.js` creates a disposable PostgreSQL cluster
with separate local/cloud databases, real controllers/worker and browser clients.
Storage requests alone are mocked. It tests migration rollback/replay, mismatched
numeric IDs, coalesced rename adoption, auth/ownership, durable status, offline/restart,
image validation/public access, failed publication, stale/duplicate/lost ACK recovery,
kiosk/public image rendering, cart/details preservation, current-price/availability/
visibility validation, offline orders, stable cloud order import and historical totals.
It stops its own cluster and retains screenshots as evidence.

Also run the existing cloud-order, notification and Windows deployment integration
suites on their disposable clusters; public OTP/totals, printer/receipt unit tests;
customer API, checkout, kiosk, receipt and notification browser suites; Windows
package security tests; Admin build and final package checksum/secrets validation.
Do not run legacy DB tests that read the active development .env without isolation.

Validation on 2026-10-22: 57/57 isolated integration tests, 58/58 OTP/totals/printer/
receipt tests, and 83/83 browser/API/package tests passed (198 total, counting the
Node runner's parent tests). Admin Vite build and new JavaScript syntax checks
passed. All disposable PostgreSQL clusters stopped; no fixture processes remained.
An initial concurrent browser run had one desktop pixel comparison failure (plus
its parent); the unchanged test passed alone and in the full sequential rerun.
Use `--test-concurrency=1` for the screenshot suite on this Windows host.
Feature-scoped diff checks passed; the pre-existing extra EOF blank line in
`installer/RestaurantAI.iss` still causes the whole-worktree diff check to warn.
Admin retains its existing large-bundle warning. Dependency audit warnings require
separate review; functional test success alone is not production security sign-off.

Not proved by fixtures: real Supabase bucket permissions/key, Render reachability,
production catalog mapping, real internet outages/Windows reboot, physical printing
and audible speech. These remain approved rollout checks, not claimed passes.

## Files in this feature

New:
- `backend/database/migrations/018_menu_sync.sql`
- `backend/src/config/menuSyncConfig.js`
- `backend/src/controllers/menuSyncController.js`
- `backend/src/services/menuImageService.js`
- `backend/src/services/menuSyncApiService.js`
- `backend/src/services/menuSyncService.js`
- `backend/src/services/menuCheckoutService.js`
- `backend/tests/menu-sync.integration.test.js`
- `admin/src/components/menu/MenuSyncStatus.jsx`
- `docs/MENU_SYNC.md`

Extended (other existing work in these files is retained):
- `backend/.env.example`, `backend/package.json`, `backend/package-lock.json`
- `backend/scripts/deployment.js`
- `backend/src/controllers/menuController.js`, `categoriesController.js`,
  `ordersController.js`, `paymentController.js`
- `backend/src/routes/menuRoutes.js`, `categoriesRoutes.js`, `cloudSyncRoutes.js`
- `backend/src/server.js`
- `backend/src/services/cloudOrderSyncApiService.js`, `cloudOrderImportService.js`
- `backend/tests/public-order-otp.test.js`, `public-order-totals.test.js`,
  `windows-deployment.integration.test.js`
- `admin/src/components/menu/AddFoodDialog.jsx`, `MenuForm.jsx`
- `admin/src/pages/Menu/Menu.jsx`, `admin/src/pages/Categories/Categories.jsx`
- `frontend/script.js`
- `scripts/validate-windows-package.cjs`, `tests/windows-package.test.cjs`

No tax calculation or printer implementation edits are part of this feature.

## Missing local migration recovery

`categoriesController` joins `public.menu AS m`; its `m.deleted_at` predicate,
and the menu query's `sync_version`, require migration 018. The status endpoint
also needs `menu_sync_outbox`. Missing schema is not an empty catalog or an
internet failure. Admin now displays a menu load error with Retry; status returns
HTTP 503 / `MENU_SCHEMA_MISSING` for missing sync tables or columns.

The normal Windows upgrade runner includes 018 after 017, within the same
verified-backup transaction. New ledger entries include the migration SHA-256.
The packaged validator requires 018 and the catalog services. Rebuild the package
and installer after changing these files; do not deploy the older executable.

For a reviewed legacy local installation with recorded 017 but missing 013-016
ledger entries, do not blindly replay older billing migrations or invent ledger
history. The explicit database-only repair command is:

```powershell
node backend/scripts/deployment.js migrate-menu C:\absolute\path\to\config\.env
```

This requires local mode, loopback PostgreSQL 18+, baseline tables and recorded
017. It uses the existing backup/checksum verification, advisory lock,
transaction and ledger machinery, but applies only 018. Reruns leave catalog
snapshots and original rows intact. Review and reconcile historical migration
gaps before a subsequent general upgrade. Production configuration validation
still requires the configured secrets; this command does not modify configuration.

Sync remains opt-in. Disabled status is `disabled`, even if initial snapshots
are queued. Enabled status distinguishes `pending`, `synced`, `offline`
(cloud transport unreachable), `cloud_error` (HTTP rejection), `retrying`
(catalog/image rejection), and `configuration_error`. A transport failure does
not prove that the entire internet connection is down. Database failures remain
errors, not successful disabled responses.

Focused recovery coverage: `backend/tests/menu-sync-status.test.js`,
`tests/admin-menu-recovery.test.cjs`, plus the 018-only rollback/ledger/rerun
case in `backend/tests/windows-deployment.integration.test.js`.
