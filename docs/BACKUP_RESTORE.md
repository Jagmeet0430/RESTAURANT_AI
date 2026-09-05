# RestaurantAI Backup, Restore, and Disaster Recovery

RestaurantAI stores sales, customers, inventory, products, payments, admin users, and report source data in PostgreSQL. A good backup protects the restaurant from Windows failure, accidental deletion, database corruption, server replacement, software update failure, and disk failure.

## Backup Location

Default database backups are stored here:

```text
RestaurantAI/backups/database
```

Logs are stored here:

```text
RestaurantAI/backups/logs/backup.log
```

Backups use PostgreSQL custom format:

```text
restaurant_db_YYYY-MM-DD_HHMMSS.dump
```

Each dump has a matching JSON metadata file with database name, creation time, mode, file size, PostgreSQL dump version, and SHA-256 checksum. Metadata does not contain passwords or secrets.

## Manual Database Backup

From `backend`:

```powershell
npm run backup
```

Or directly:

```powershell
node scripts/backupDatabase.js
```

The script:

- Reads database settings from `backend/.env`.
- Locates `pg_dump` and `pg_restore`.
- Creates the backup directory if needed.
- Runs `pg_dump -Fc`.
- Verifies the dump with `pg_restore --list`.
- Writes metadata and a log entry.
- Applies retention only after a new backup succeeds.

It never prints the database password.

## Configuration

In `backend/.env`:

```env
BACKUP_DIR=../backups/database
POSTGRES_BIN_DIR=C:\Program Files\PostgreSQL\18\bin
BACKUP_RETENTION_DAYS=30
BACKUP_RETENTION_COUNT=30
```

If PostgreSQL is already on `PATH`, `POSTGRES_BIN_DIR` can be empty. If backup commands say `pg_dump not found`, set `POSTGRES_BIN_DIR` to your PostgreSQL `bin` folder.

## Verify a Backup

The backup script automatically verifies the dump. To verify manually:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" --list "C:\Users\Gopesh\Desktop\RestaurantAI\backups\database\restaurant_db_YYYY-MM-DD_HHMMSS.dump"
```

A readable object list means PostgreSQL can inspect the backup.

## Restore Test

Always test a backup before trusting it for disaster recovery.

From `backend`:

```powershell
npm run restore -- "..\backups\database\restaurant_db_YYYY-MM-DD_HHMMSS.dump" --test --yes
```

The restore test:

- Validates the dump with `pg_restore --list`.
- Creates `restaurant_db_restore_test`.
- Restores the dump into that temporary database.
- Compares table counts and revenue totals with the live database.
- Drops only `restaurant_db_restore_test` after success.

It does not modify `restaurant_db`.

## Full Restore Procedure

Use this only when you intentionally want to replace the configured local database from a verified dump.

1. Stop the RestaurantAI backend and any frontend clients.
2. Confirm the backup path and timestamp.
3. Run a restore test first.
4. Run:

```powershell
npm run restore -- "..\backups\database\restaurant_db_YYYY-MM-DD_HHMMSS.dump" --target restaurant_db
```

5. Type the exact confirmation phrase shown by the script.
6. The script creates a safety backup of the current target database before restoring.
7. Start the backend.
8. Check:

```text
http://127.0.0.1:5001/api/health
```

9. Login and verify sales, inventory, reports, kitchen orders, and POS.

Never delete `restaurant_db` before confirming that you have a valid backup.

## Moving RestaurantAI to a New PC

Disaster recovery flow:

```text
OLD SERVER DEAD
      |
Install PostgreSQL
      |
Install RestaurantAI
      |
Configure backend/.env
      |
Create target DB
      |
Restore latest verified dump
      |
Restore uploads/files
      |
Start backend
      |
Health check
      |
Login
      |
Verify sales/inventory/reports
```

## Full RestaurantAI Backup

The database dump does not include local files such as uploads, documents, or local vector stores.

From the repository root:

```powershell
.\scripts\backup-restaurantai.ps1
```

This creates:

```text
RestaurantAI/backups/full/restaurantai_YYYY-MM-DD_HHMMSS
```

It includes:

- A verified database dump.
- Matching database metadata.
- Existing persistent file directories when present.
- A `manifest.json`.

It excludes:

- `node_modules`
- `.venv` and `venv`
- `.env` and `.env.*`
- `dist` and `build`
- existing `backups`

## Persistent Files to Back Up

Database backups do not include these possible local data paths:

- `uploads`
- `backend/uploads`
- `frontend/assets/uploads`
- `assets/uploads`
- `documents`
- `backend/documents`
- `chroma`
- `vector_store`
- `ai/chroma`
- `ai/vector_store`

The full backup script copies only paths that exist.

## Scheduled Backups

Use Windows Task Scheduler for a daily backup during a quiet period, for example 2:00 AM.

Recommended action:

```text
Program: powershell.exe
Arguments: -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Gopesh\Desktop\RestaurantAI\scripts\backup-restaurantai.ps1"
Start in: C:\Users\Gopesh\Desktop\RestaurantAI
```

Do not create scheduled tasks automatically unless the restaurant operator approves it.

## Backup Retention

Defaults:

- Keep at least the newest successful managed backup.
- Keep the latest 30 managed backups.
- Delete managed backups older than 30 days.

Retention only deletes files matching the managed dump naming pattern for the configured database. It does not remove random manually created files.

## Before Migrations or Updates

Operational rule for future updates:

```text
backup
  |
verify backup
  |
apply migration/update
  |
health test
```

Do not modify historical migrations. Before any future destructive migration, require a successful verified backup.

## Backup Destination Levels

Level 1: Same-disk local backups under `RestaurantAI/backups`.

Level 2: Copy backups to an external USB drive or NAS.

Level 3: Optional encrypted cloud or off-site backup.

Cloud backup is optional. RestaurantAI must remain fully usable offline.

## Encryption and Permissions

Backups contain sensitive business and customer data. Store them on:

- A BitLocker encrypted server disk.
- An encrypted external drive.
- Equivalent OS or disk-level encryption.

Do not invent custom encryption casually. Use trusted OS/storage encryption.

The backup directory is not under Express static serving. Express serves only the customer frontend at `/customer`, not `RestaurantAI/backups`.

## Troubleshooting

`pg_dump not found`

Set:

```env
POSTGRES_BIN_DIR=C:\Program Files\PostgreSQL\18\bin
```

`password authentication failed`

Check `DB_USER` and `DB_PASSWORD` in `backend/.env`. The scripts do not print passwords.

`backup file is empty`

Treat the backup as failed. Do not restore from it.

`restore reconciliation failed`

Do not restore over `restaurant_db`. Keep the failed dump for investigation and use a newer verified backup.

## What Not To Do

- Do not drop or delete `restaurant_db` before a verified backup exists.
- Do not open PostgreSQL port `5432` to the LAN.
- Do not store `.env` files inside backups sent to other people.
- Do not commit `.dump` files or the `backups` folder to Git.
- Do not make cloud backup mandatory for offline operation.
- Do not allow normal LAN users to trigger restore.
