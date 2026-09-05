# RestaurantAI Windows Deployment

This guide is for running RestaurantAI on a restaurant Windows server PC. It is not a final signed installer yet; it describes the portable/operator setup created for Phase 4.

## 1. Supported Windows Version

Use Windows 10 or Windows 11 on the server PC. Keep the machine on a Private network profile, not Public Wi-Fi mode.

## 2. Server PC Requirements

Recommended minimum:

- Windows 10/11
- 8 GB RAM
- Reliable SSD storage
- Stable Wi-Fi or Ethernet
- Administrator access for PostgreSQL, firewall, and startup-task setup

Preferred installed layout:

```text
C:\RestaurantAI\
  app\
    backend\
    admin\
    frontend\
  config\
    .env
  data\
  backups\
  logs\
  runtime\
  docs\
  scripts\
```

Application code lives under `app`. Mutable operator files live outside `app`, so updates can replace app files without overwriting config, logs, runtime state, data, or backups.

## 3. PostgreSQL Requirement

Phase 4 uses an existing PostgreSQL installation. Do not bundle or redistribute PostgreSQL binaries until packaging/licensing is reviewed.

The setup checks for:

- PostgreSQL service
- `psql.exe`
- `pg_dump.exe`
- `pg_restore.exe`
- compatible local PostgreSQL, tested with PostgreSQL 18

Do not reset or overwrite an existing PostgreSQL installation. Do not open PostgreSQL port `5432` to LAN devices.

## 4. Node Requirement

Install Node.js 18 or newer on the server PC. The backend production command is:

```powershell
node src/server.js
```

Production/operator startup does not use `nodemon`, Vite dev server, VS Code, or a Python virtual environment.

## 5. Preflight Command

From the RestaurantAI folder:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\check-system.ps1
```

The report uses:

- `PASS` for ready core requirements
- `WARN` for fixable or optional items
- `FAIL` for missing core requirements

Missing optional AI/OCR is a warning, not a blocker for core restaurant operation.

## 6. Fresh Installation

1. Install PostgreSQL and Node.js.
2. Copy the portable package to `C:\RestaurantAI`.
3. Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\setup-restaurantai.ps1
```

4. Enter PostgreSQL connection details.
5. If the database is missing, choose whether to create it.
6. If it is a fresh database, apply the offline-v1 bootstrap schema when prompted.
7. Start RestaurantAI.
8. Open Admin and register the first admin account.

The setup wizard generates new `JWT_SECRET` and `OTP_SECRET` for fresh installs. It does not print secrets.

Fresh DB flow:

```text
create database
  |
apply backend/database/bootstrap/offline_v1_schema.sql
  |
register offline-v1 baseline in schema_migrations
  |
register first admin through Admin UI
  |
health test
```

Do not replay historical migrations `001` through `011` blindly for a fresh install.

## 7. Existing Database Installation

If `restaurant_db` already exists, setup detects it and does not overwrite it. Use this path for upgrades or server moves where the database has already been restored.

Upgrade flow:

```text
preserve database
  |
preserve config\.env
  |
replace app files
  |
run only new approved migrations
  |
health test
```

## 8. Config Location

Development uses:

```text
backend\.env
```

Installed portable layout uses:

```text
config\.env
```

The launcher sets `RESTAURANTAI_ENV_PATH` to the external config file. The backend also accepts `RESTAURANTAI_ENV_FILE`. It logs which env file was loaded but never prints secret values.

Protect `config\.env` with Windows account permissions because it contains database and JWT secrets.

## 9. LAN Mode

For local-only server access:

```env
HOST=127.0.0.1
ALLOW_LAN_ORIGINS=false
```

For LAN devices:

```env
HOST=0.0.0.0
ALLOW_LAN_ORIGINS=true
PORT=5001
```

Do not hard-code a LAN IP in application source. The launcher prints detected LAN URLs.

## 10. Firewall

Optional helper:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\configure-firewall.ps1 -Action Add -Port 5001
```

It creates a Private-profile inbound rule for the RestaurantAI API port only. It refuses port `5432`.

Remove it:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\configure-firewall.ps1 -Action Remove
```

## 11. Start

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\start-restaurantai.ps1
```

The launcher:

- Validates config exists.
- Starts the backend production process.
- Writes logs.
- Writes PID/runtime metadata.
- Waits for `/api/health`.
- Prints local, hostname, and LAN URLs.

Optional browser launch:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\start-restaurantai.ps1 -OpenBrowser
```

## 12. Stop

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\stop-restaurantai.ps1
```

The stop script uses `runtime\restaurantai.pid` and `runtime\restaurantai.process.json`. It stops only the matching RestaurantAI Node process and removes stale PID files safely.

## 13. Admin URL

```text
http://SERVER:5001/admin
```

Local example:

```text
http://127.0.0.1:5001/admin
```

## 14. POS URL

Actual route:

```text
http://SERVER:5001/admin/barcode-pos
```

## 15. Kitchen URL

Actual route:

```text
http://SERVER:5001/admin/kitchen
```

## 16. Customer URL

```text
http://SERVER:5001/customer
```

The backend serves the customer frontend directly.

## 17. Backup

Database backup:

```powershell
cd app\backend
npm run backup
```

Full app backup:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\backup-restaurantai.ps1
```

Before updates, migrations, or restore, make a verified backup first.

## 18. Restore

Do not expose restore as a one-click normal UI action.

Operator flow:

```text
stop RestaurantAI
  |
backup current DB
  |
run restore test
  |
restore target DB only after confirmation
  |
start RestaurantAI
  |
health check
  |
verify reports
```

See `docs\BACKUP_RESTORE.md`.

## 19. Auto-Start

Recommended Phase 4 strategy: Windows Task Scheduler at startup.

Reason:

- Built into Windows.
- No third-party service wrapper.
- Easy to remove.
- Good enough for this Node/web architecture.

Optional helper:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install-startup-task.ps1 -Action Install
```

Remove:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install-startup-task.ps1 -Action Remove
```

Phase 5 uses this same Task Scheduler approach through the installer. A future Windows Service wrapper can still be evaluated if the product needs service recovery policies and formal service management.

## 20. Updating RestaurantAI

Safe update flow:

```text
stop server
  |
verified DB backup
  |
replace app files only
  |
preserve config/data/backups/logs/runtime
  |
apply new approved migration
  |
start
  |
health test
  |
rollback app files if needed
```

Do not implement cloud auto-update in this phase.

## 20A. Installer Installation

Phase 5 adds an Inno Setup based installer:

```text
RestaurantAI-Setup-1.0.0.exe
```

The installer copies application binaries to:

```text
C:\Program Files\RestaurantAI
```

Machine-wide mutable state is kept separately in:

```text
C:\ProgramData\RestaurantAI
```

ProgramData contains:

- `config`
- `data`
- `backups`
- `backups\database`
- `backups\logs`
- `logs`
- `runtime`

The installer does not include a real `.env`, real backups, database dumps, customer data, or developer secrets. It only installs a `.env.example` template if one is not already present.

During a normal interactive install, the installer can offer these choices:

- Configure RestaurantAI now
- Allow RestaurantAI on this private network
- Start RestaurantAI automatically when Windows starts
- Start RestaurantAI and open Admin
- Create a desktop shortcut

During silent install:

```powershell
RestaurantAI-Setup-1.0.0.exe /VERYSILENT
```

files are installed only. Interactive database and admin setup is skipped. Configure the machine afterward with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Program Files\RestaurantAI\scripts\setup-restaurantai.ps1" -InstallRoot "C:\Program Files\RestaurantAI" -StateRoot "C:\ProgramData\RestaurantAI"
```

Do not pass database passwords on the command line for normal restaurant installs.

## 20B. Installer Upgrade

Future installers must keep the same Inno `AppId` so Windows upgrades the existing RestaurantAI installation instead of installing a duplicate product.

Upgrade behavior:

```text
stop RestaurantAI
  |
create verified backup if an existing config is present
  |
replace application binaries/scripts/docs
  |
preserve ProgramData config/data/backups/logs/runtime
  |
start and health check if selected
```

The installer must not overwrite:

- `C:\ProgramData\RestaurantAI\config\.env`
- database data
- backups
- persistent restaurant data

For schema changes, do not replay migrations `001` through `011` during upgrade. Fresh installs use `offline_v1_schema.sql`. Future releases should add a migration runner that applies only new migrations beyond the recorded `schema_migrations` baseline.

## 20C. Installer Uninstall

Uninstall removes the application binaries, Start Menu shortcuts, and desktop shortcut. It also attempts to:

- stop RestaurantAI using `stop-restaurantai.ps1`
- remove the optional startup task
- remove the optional RestaurantAI firewall rule

Uninstall preserves by default:

- `C:\ProgramData\RestaurantAI`
- `config\.env`
- `backups`
- `data`
- PostgreSQL
- `restaurant_db`

Do not drop or reset PostgreSQL databases during uninstall. If business data must be removed, a restaurant owner or administrator should make that decision after taking an export/backup.

## 20D. Unsigned Installer Warning

Phase 5 development installers are unsigned. Windows SmartScreen may warn operators before running them.

For production distribution, sign the installer with a trusted Authenticode code-signing certificate. Do not treat a self-signed certificate as the final production signing solution.

## 21. Desktop Shortcuts

Optional helper:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\create-shortcuts.ps1 -HostName localhost -Port 5001
```

It can create shortcuts for:

- RestaurantAI Admin
- RestaurantAI POS
- RestaurantAI Kitchen
- RestaurantAI Start Server
- RestaurantAI Backup

Do not create shortcuts automatically during package tests.

## 22. Optional AI Dependencies

Core RestaurantAI does not require Python, model files, Chroma, OCR, or internet LLM access.

Optional local AI:

- RAG chatbot: Python, Python dependencies, Chroma/vector store, local service on `127.0.0.1:8001`; may use Gemini depending on configuration.
- Prediction service: Python dependencies and local model files.
- OCR/menu digitization: Python dependencies and OCR runtime on `127.0.0.1:8003`.

Optional cloud/internet:

- Razorpay payments and checkout script.
- WhatsApp/Twilio messaging.
- Gemini or other external LLM APIs.
- Social links/maps in the customer footer/contact area.

If these optional services are missing, core auth, menu, POS, inventory, kitchen, and reports should still run.

## 23. Troubleshooting

`Environment file missing`

Run setup first:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\setup-restaurantai.ps1
```

`Port is already listening`

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\stop-restaurantai.ps1
```

`PostgreSQL tools not found`

Set `POSTGRES_BIN_DIR` in `config\.env`, for example:

```env
POSTGRES_BIN_DIR=C:\Program Files\PostgreSQL\18\bin
```

`Admin route refresh shows 404`

Make sure the backend is serving `app\admin\dist` and the admin app was built with base path `/admin/`.

## 24. Installer Recommendation

Recommended and selected for Phase 5: Inno Setup.

Why:

- Mature Windows installer tooling.
- Good fit for copying Node/web app files.
- Can create folders, shortcuts, and uninstall entries.
- Can preserve `config`, `data`, `backups`, and `logs` during upgrades.
- Can run or launch PowerShell setup helpers.
- Simpler than WiX/MSI for this maturity stage.

NSIS is also viable, but Inno Setup is easier to maintain for this operator-style installer. WiX/MSI is more formal but heavier. MSIX is less convenient for local server/database apps that need mutable folders and operator-controlled services.
