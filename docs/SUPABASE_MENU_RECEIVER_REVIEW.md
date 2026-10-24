# Menu sync migration review: cloud receiver versus local authority

Status: reviewed/tested candidate, NOT approved for production execution.
No production connection, migration, sync enablement or deployment was performed.
Production counts (185 menu, 23 categories, 11 orders) and empty ledger were
provided by the operator. A verified production schema export/backup is pending.

## Findings

1. Local `018_menu_sync.sql` initializes an authoritative publisher: 23 category
   plus 185 product snapshots. It is inappropriate as a fresh receiver migration.
2. Its import branch returns NEW for DELETE; NEW is null, silently suppressing
   the row deletion. The correct BEFORE DELETE return is OLD.
3. The applied development 018 checksum and current file both equal
   `30d37853e71c98f35eb4c0d69729ee89637ff3cb599b0ecd27cb8140253f063d`.
   Editing 018 would diverge from that recorded history. The local runner formerly
   skipped recorded names without validating hashes; it now rejects non-null
   checksum mismatches. Legacy null checksums remain unknown, not fabricated.
4. An empty cloud ledger does not justify replaying 001-018 or marking them applied.
   In particular, billing/data migrations must not be replayed based on ledger gaps.
5. Prior read-only public comparison matched all 185 identities and prices, but
   cloud products 244 and 245 were available while local copies were not. The
   public API exposed no timestamp/UUID ownership metadata; cloud recency and
   migration compatibility remain unproved. Re-run this comparison at release.

## Exact migration split

- Leave `backend/database/migrations/018_menu_sync.sql` byte-for-byte unchanged.
- Local-only `backend/database/migrations/019_menu_sync_import_delete.sql` replaces
  only the capture function, with OLD for imported DELETE. It does not queue seeds,
  rewrite history or replace triggers. Existing 208 events remain intact.
- Fresh cloud-only `backend/database/cloud/018_menu_sync_receiver.sql` adds receiver
  columns, UUID indexes, clock, receipts and image assets. It retains an empty
  compatibility outbox for the status reader, without capture triggers/functions
  or bootstrap UPDATEs. All pre-existing fields/IDs/rows remain unchanged.
- Use the distinct ledger name `cloud-018_menu_sync_receiver.sql`, baseline=false,
  and SHA-256 of the exact executed file. No entries for unexecuted migrations.
- `backend/scripts/menuReceiverMigration.js` is an explicit operator adapter, not
  an auto-running CLI. It requires a connected client, online mode, sync disabled,
  reviewed counts and a verified-backup callback. It verifies backup bytes, then
  applies SQL and the single true ledger entry atomically. Matching ledger/hash
  reruns are no-ops; mismatches fail. The callback must independently verify the
  archive/restore: passing a path and checksum alone is not a restore verification.

The receiver SQL is deliberately fail-closed, not blind IF NOT EXISTS DDL. Partial
sync columns, UUIDs or tables, local capture objects, duplicate identities, or
incompatible prerequisites require a reviewed adoption migration. No such objects
are dropped, reset or silently repurposed. Re-execution goes through the adapter,
not by rerunning raw SQL after it has already committed.

New internal tables enable RLS and revoke PUBLIC/anon/authenticated privileges.
Existing business-table policies/grants are untouched. Verify Render's SQL role:
it needs approved access (owner/BYPASSRLS or separately reviewed narrow policies
and grants). A Supabase Storage API key does not grant SQL table access.

## Production preflight: read only, after explicit operator action

Use `backend/database/cloud/menu_sync_preflight.sql` against the reviewed schema
export/disposable clone first. Later, an approved operator can run its read-only
inventory on production. It enumerates columns/types/defaults, constraints,
indexes, triggers, RLS/grants, role properties, ledger and identity duplicates.
It includes catalog-only rows for comparison; do not share embedded secrets.

Required checks:
- Confirm actual database host/name/user/server version from Dashboard Connect,
  not only the project display label `restaurantai-prod`.
- Verify fresh backup restores before mutation. Confirm current counts; the
  supplied 185/23/11 must be rechecked if customers place more orders meanwhile.
- Require compatible menu/category fields used by the receiver and deployed API,
  valid PK/FK/sequence defaults, non-null valid identities, price and veg_type
  values, and ledger name uniqueness/defaults. Check ID sequences exceed max IDs.
- Inspect every existing trigger/event trigger and extension for side effects.
  This cannot be inferred from counts or the public API.
- Compare name+category and barcode mappings across both catalogs. Check duplicate
  normalized categories/product names and duplicate nonblank barcodes.
- If UUID metadata already exists, stop this fresh-install migration. Compare each
  UUID's entity, original numeric ID, barcode/category/name and owner/source across
  databases. A shared UUID pointing to a different product must not be imported.
  Random generation plus unique indexes prevents intra-table duplicates, not all
  semantic cross-database identity collisions.
- Compare updated_at, prices, availability, image mappings and receipt versions
  on the actual clone/export. Sync receipt versions only protect against replay
  from the same source; first adoption is NOT timestamp-based conflict resolution.
- Preserve retired test products and their historical links. Approve their
  unavailable/category-inactive treatment before any initial publication.
- Confirm cloud menu-version/status endpoint compatibility. A current 500 must be
  diagnosed, not mistaken for proof of a particular missing migration.
- Receiver DDL does not require replay of local migration 017. This does not prove
  the full deployed application has all 013-017 prerequisites: audit orders,
  notifications, billing and cloud-order sync independently without rewriting them.

## Release sequence (future approval required)

1. Operator follows `SUPABASE_BACKUP_POWERSHELL.md`. No passwords/URLs in chat.
2. Review the schema export and RLS/roles; rehearse on a compatible isolated clone.
   Resolve strict preflight failures explicitly; do not weaken them blindly.
3. Run the receiver, local follow-up and existing menu/cloud-order/deployment tests.
4. Choose the real Restaurant PC as the sole publisher, not this development DB.
   Keep MENU_SYNC_ENABLED=false on both. Stage the compatible Render code/config
   for a maintenance window, with an explicit no-automatic-migration startup.
5. After fresh verified backup, use one direct/session PostgreSQL connection to
   the reviewed target, not transaction-pooling or the Windows local-only runner.
   Call the adapter with expectedCounts and verified backup. Maintain the same
   connection/transaction for DDL and ledger. Never insert ledger rows manually.
6. Verify unchanged original row fingerprints, prices/history, empty receiver
   outbox, UUID uniqueness, true ledger/checksum and API reads. Do not enable sync.
7. Local 019 needs a separately reviewed installer/runner registration after 018,
   plus package-required-file checks and migration/upgrade tests. It is NOT wired
   into the installer in this review and has NOT been applied to development.
   Rebuild a release only after that approval; the existing installer lacks 019.
8. Before later sync activation, reconcile identities/data, configure stable
   restaurant/source UUIDs and server-only secret. Configure public menu-images
   Storage with Render-only credentials and no anonymous writes; test images.
9. Explicitly approve receiver acceptance then the authoritative PC publisher.
   Observe matching ACKs, no receiver outbox growth, identity adoption, stock,
   cloud order import and historical receipts. Do not reset pending counts.

On failure before commit, rollback leaves schema/history unchanged. After commit,
leave additive columns/tables in place and sync disabled; do not drop objects or
restore an old dump over newer orders. Any post-commit rollback needs its own plan.

## Test evidence and limits

`backend/tests/menu-receiver-migration.integration.test.js` supports the checked-in
baseline schema or `RESTAURANTAI_TEST_SCHEMA_DUMP` (schema-only restore of a trusted
archive into a disposable cluster). It seeds synthetic 185/23/11 counts, never
loads production credentials, and stops its cluster. An untrusted dump can execute
code: review the source before restoring it.

It tests 018 immutability, old DELETE failure, 019 fix/rollback/replay, zero seed
queue on cloud, backup/count rejection, atomic ledger rollback, preservation,
UUID uniqueness, schema/identity conflicts, RLS, real receive/ACK replay and
historical orders unchanged. The Windows suite verifies local hash enforcement.
The copied pre-018 local schema is evidence, not a substitute for the actual
Supabase schema, managed extensions, privileges, backup or production rehearsal.
