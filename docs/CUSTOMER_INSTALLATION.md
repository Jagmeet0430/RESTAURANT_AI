# RestaurantAI 1.4.6: Restaurant PC Deployment

This is the current technician checklist. Older phase documents are historical.
Do not run Setup, task installers, or firewall commands on a development PC as a test.
Use an isolated Windows 10/11 x64 VM for installer acceptance before customer rollout.

## Prerequisites and locations

- Install Node.js 22+ **x64** explicitly, with Node on the system PATH.
- Install PostgreSQL **18+** and its command-line tools explicitly as an administrator.
  The shipped bootstrap was produced by PostgreSQL 18 (including transaction_timeout
  and psql restrict commands); older PostgreSQL installations need a separately
  validated upgrade plan. This release no longer advertises untested 15+ compatibility.
- Keep PostgreSQL listening on loopback. Do not open port 5432 in the firewall,
  router, or cloud security rules. LAN workstations require only a browser.
- Application files: `C:\Program Files\RestaurantAI`.
- Credentials and persistent state: `C:\ProgramData\RestaurantAI`.
- PostgreSQL owns its own data directory; never move/delete it during application upgrades.
- Configuration contains secrets. Restrict access to trusted Windows accounts.
  Installed runtime/config access must be reviewed for the customer's Windows users.

## Build and inspect (development PC only)

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\build-installer.ps1
node scripts\validate-windows-package.cjs dist\RestaurantAI-Windows
Get-FileHash dist\installer\RestaurantAI-Setup-1.4.6.exe -Algorithm SHA256
```

The build runs Admin's production build with `/admin/`, installs locked backend
production dependencies using `npm ci --omit=dev --ignore-scripts`, inventories
files with SHA-256, checks templates/secret files/known development secrets, and
then invokes Inno Setup 6. Runtime code uses existing pure-JS dependencies; no
developer Node installation or development .env is copied into the installer.
The Node runtime and PostgreSQL are prerequisites, **not bundled**.

The scanner is a release gate, not proof against every possible encoded secret.
Review new dependencies and configuration templates before each release. Generated
installers are unsigned until an authorized code-signing certificate is provided.

## New installation

1. Prepare a new Windows VM first; snapshot it. Install the prerequisites above.
2. Verify the delivered installer SHA-256 against the release report.
3. Run Setup elevated. Setup blocks missing prerequisites, rather than reporting
   an operational installation without them.
4. Configure loopback PostgreSQL host, database `restaurant_db`, and credentials.
   Creation of a missing database requires explicit interactive approval.
   Bootstrap is applied only to that newly created database, never an existing DB.
5. A verified PostgreSQL backup precedes the supported migrations 013 through 016.
   Migration history is tracked in `schema_migrations` as `windows-<filename>`.
   The migration transaction rolls back on error. No migrations 001-012 are replayed.
6. Create the first admin with a unique password. Do not use test credentials.
7. For LAN use select LAN access in setup (`HOST=0.0.0.0`, `PORT=5001`).
8. Optionally select the private-network firewall task. It opens TCP 5001 for
   `Private` profile / `LocalSubnet` only, never PostgreSQL.
9. Setup runs database preparation, starts the backend, and waits for readiness.
   A failed step is a failed installation, even if files were copied. Inspect the
   error, correct the prerequisite/configuration, and rerun setup. Do not trade.
10. Start-now leaves the validated backend running; otherwise it is stopped after
    the readiness test. Open the Admin shortcut manually when ready.

Fresh silent installs without provisioned configuration are deliberately rejected.
Never pass DB passwords as installer command-line arguments.

## Upgrades

- Schedule downtime; close POS, kiosk and LAN clients. Keep a copy of the prior installer.
- Keep the stable AppId `{9A7811B0-8392-4C65-8A3E-5D7F9F86E35A}`.
- Setup stops the old application and requires its external configuration.
- The incoming backup script creates and verifies a custom-format DB archive and
  checksum **before replacing application files**. Missing backup tooling or a
  failed backup aborts the upgrade. A stopped old backend may need restarting
  manually after an aborted upgrade.
- Setup reuses the registered install directory and blocks version downgrades.
- When .env already exists, Setup skips the configuration wizard entirely,
  preserving it byte-for-byte, including sync and messaging configuration.
  Run the separate setup tool only for an intentional configuration change.
  The example is never a real .env. Printer/kiosk JSON and uploads are not replaced.
- After replacement, database preparation verifies the target, creates another
  safety backup, and applies only unrecorded supported migrations transactionally.
- Migration 016 adds columns/indexes/outbox and replaces its own trigger in that
  transaction. It does not delete orders. Duplicate legacy cloud IDs cause a safe
  failure, not silent merging. Existing 014/015 changes are idempotent backfills;
  baseline compatibility and isolated rerun tests are required.
- If readiness fails after replacement, do not call the upgrade successful. Retain
  the backup, logs and previous installer for technician recovery. Full file-level
  rollback is not automatic; database migrations roll back on SQL failure.

## Cloud sync: only on the restaurant server

Development/test configuration remains `RESTAURANTAI_MODE=local` and
`CLOUD_SYNC_ENABLED=false`. Setup defaults to sync disabled.

On the **designated Restaurant PC only**, securely edit ProgramData\RestaurantAI\config\.env:

```dotenv
RESTAURANTAI_MODE=local
DB_HOST=127.0.0.1
CLOUD_SYNC_ENABLED=true
CLOUD_SYNC_BASE_URL=https://restaurant-ai-4myq.onrender.com/api
CLOUD_SYNC_SECRET=<securely-provisioned-shared-secret>
CLOUD_SYNC_INTERVAL_SECONDS=10
```

The secret must match the already configured Render backend and be at least 32
characters. Never put it in Vercel/frontend variables. Only outbound authenticated
HTTPS is required. Inspect menu mapping and backlog before enabling; only one local
database may consume this restaurant's cloud queue. See CLOUD_ORDER_SYNC.md.
This release does not change or provision Render/Supabase.

## Startup, shutdown and LAN

From an elevated PowerShell on the Restaurant PC:

```powershell
$install = 'C:\Program Files\RestaurantAI'
$state = 'C:\ProgramData\RestaurantAI'
& "$install\scripts\start-restaurantai.ps1" -InstallRoot $install -StateRoot $state
& "$install\scripts\stop-restaurantai.ps1" -InstallRoot $install -StateRoot $state
& "$install\scripts\install-startup-task.ps1" -InstallRoot $install -StateRoot $state
```

The backend boot task runs as SYSTEM, without an interactive login. The launcher
waits up to 60 seconds for PostgreSQL, rejects duplicate startup/occupied ports,
then waits for readiness. Failed task startup is retried up to three times.
It is a launch task, not a continuous Windows-service supervisor: a later crash
needs operator restart. Logs are under ProgramData\RestaurantAI\logs.
The new backend supports graceful shutdown via a per-process Windows named pipe;
old backends use verified PID termination with PostgreSQL transaction rollback.

The optional kiosk task is separate and runs after interactive login. Test the
actual browser, display, printer and user-account permissions in the VM/customer
acceptance environment. SYSTEM printers can differ from the logged-in user's.

Verify on PC 1, then separately from PC 2 using PC 1's LAN IP:

```text
http://127.0.0.1:5001/api/health
http://127.0.0.1:5001/api/ready
http://127.0.0.1:5001/admin
http://127.0.0.1:5001/admin/orders
http://127.0.0.1:5001/admin/kitchen
http://127.0.0.1:5001/admin/barcode-pos
http://127.0.0.1:5001/customer?kiosk=1
```

Admin uses same-origin `/api`; PC 2 does not need Vite/5173, Node, Git or PostgreSQL.
Unknown `/api` routes must return JSON 404, not the Admin SPA. Custom backend ports
require corresponding shortcut/firewall changes; the stock installer uses 5001.

## Backup and recovery

```powershell
& "$install\scripts\backup-restaurantai.ps1" -InstallRoot $install -StateRoot $state
```

Full backups contain a pg_dump custom archive verified with pg_restore --list,
SHA-256 metadata, persistent files, and an Administrators/SYSTEM/backup-operator-only configuration
directory. **These backups now contain credentials: do not email/share them.**
Use BitLocker/encrypted off-site storage. Same-disk backups do not protect against
disk loss. No scheduled backup is installed automatically; an administrator can
schedule this same command daily with the appropriate account. Full backup sets
are not automatically deleted. Review disk capacity and retention manually.

Recover on an isolated replacement first, never the only live database:

```powershell
$env:RESTAURANTAI_ENV_FILE = "$state\config\.env"
node "$install\app\backend\scripts\restoreDatabase.js" 'D:\verified-backup.dump' --test --yes
```

Restore tests create a unique temporary database, verify the required schema and
report table/revenue comparisons, then remove only that newly created database.
Historical backups can legitimately differ from today's database. These comparisons
are informational, not a requirement to make the two time points equal.
For an approved real recovery: stop all writers, retain the old DB and backup,
restore configuration/uploads to the correct protected directories, then run the
same restore command with `--target restaurant_db` and type its confirmation.
It creates a safety backup and validates the source before a transactional restore.
Restart, check totals, inventory, admin login, printer and cloud acknowledgement
consistency. Never resume sync blindly after restoring an old local database.

## Uninstall and troubleshooting

Uninstall removes application files/tasks/shortcuts and its firewall rule; it does
not drop PostgreSQL or delete ProgramData business state. Archive state securely.
For missing configuration, run setup. For occupied ports, identify the owner;
do not kill arbitrary Node processes. For SQL failure, inspect safe error codes
and verify the target DB and backup before retrying migrations. If startup fails,
check backend-error.log and deployment prerequisites; never bypass readiness.

## Required release acceptance

- [ ] Fresh installation in a clean Windows 10 and Windows 11 x64 VM.
- [ ] Existing populated installation upgrade and rejected-backup upgrade.
- [ ] Reboot without login, followed by login/kiosk startup.
- [ ] PC 2 LAN login/Admin/Kitchen, private firewall and no public DB exposure.
- [ ] Real thermal printer under the selected startup account.
- [ ] Backup restored to an isolated database and reconciled.
- [ ] Sync outage/reconnect and idempotency in isolated tests; approved customer
      acceptance against the configured cloud only after release authorization.
- [ ] Installer signature/SmartScreen decision and SHA-256 verified.

Do not mark customer deployment ready until these environment-specific checks pass.
