# Supabase backup before menu receiver migration

These are operator instructions, not an automatic production operation. Nothing
here enables synchronization or runs a migration. Do not paste passwords or
connection strings into chat. Do not restore into Supabase or `restaurant_db`.

## 1. Prepare

1. Open ordinary Windows PowerShell on a trusted PC. Do not enable transcripts.
2. In Supabase Dashboard, open the correct project, then **Connect**. Prefer the
   direct connection for backups. If the PC has no IPv6, use the **Session pooler**
   connection (normally port 5432), not Transaction pooler (normally 6543).
3. Record host, port, database name and user privately. `restaurantai-prod` may be
   the project label; use the actual database field, often `postgres`, not a guess.
4. Obtain the project's database SSL root certificate through Supabase's database
   settings. Use a verified TLS connection. If certificate validation fails, stop;
   do not disable verification to get a backup through.
5. Use PostgreSQL client tools at least as new as the source server major version.
   The installed PostgreSQL 18 tools work for servers up to version 18. Do not use
   an older `pg_dump` against a newer server.
6. Choose a quiet window without catalog/order edits for the fingerprint comparison.
   `pg_dump` itself creates a consistent snapshot even with concurrent activity,
   but independent before/after fingerprint queries cannot share that snapshot.

## 2. Export schema and full database

Run this block from the RestaurantAI repository in a fresh PowerShell window.
It prompts privately and temporarily passes the password through this process's
environment, never through command arguments or a saved connection string.
The backup contains personal data; keep the folder private and encrypted, outside
Git and shared/cloud-synchronized folders.

```powershell
Set-Location 'C:\Users\Gopesh\Desktop\RestaurantAI'
$ErrorActionPreference = 'Stop'
$pg = 'C:\Program Files\PostgreSQL\18\bin'
& "$pg\pg_dump.exe" --version
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL tools unavailable' }
$folder = Join-Path $env:LOCALAPPDATA ('RestaurantAI-Backups\supabase-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $folder -ErrorAction Stop | Out-Null
$schema = Join-Path $folder 'schema-only.sql'
$dump = Join-Path $folder 'full-database.dump'
$env:PGHOST = Read-Host 'Supabase DIRECT or SESSION-pooler host (not a URL)'
$env:PGPORT = Read-Host 'Port from Connect (normally 5432)'
$env:PGDATABASE = Read-Host 'Actual database field from Connect'
$env:PGUSER = Read-Host 'Database user from Connect'
$env:PGSSLROOTCERT = Read-Host 'Absolute path to the Supabase SSL root certificate'
$env:PGSSLMODE = 'verify-full'
$env:PGCONNECT_TIMEOUT = '20'
$env:PGOPTIONS = '-c default_transaction_read_only=on'
$password = Read-Host 'Database password (hidden)' -AsSecureString
$env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $password).Password
try {
  & "$pg\psql.exe" -X --no-password -v ON_ERROR_STOP=1 -c 'SELECT current_database(), current_user, version();'
  if ($LASTEXITCODE -ne 0) { throw 'Connection/version check failed' }
  if ((Read-Host 'Confirm this is the intended source database: type BACKUP') -cne 'BACKUP') { throw 'Cancelled' }

  $fingerprintFile = (Resolve-Path 'backend\database\cloud\menu_backup_fingerprint.sql').Path
  $before = & "$pg\psql.exe" -X --no-password -qAt -v ON_ERROR_STOP=1 -f $fingerprintFile
  if ($LASTEXITCODE -ne 0) { throw 'Source fingerprint failed' }

  & "$pg\pg_dump.exe" --no-password --schema-only --file $schema
  if ($LASTEXITCODE -ne 0) { throw 'Schema export FAILED; do not migrate' }
  & "$pg\pg_dump.exe" --no-password --format=custom --file $dump
  if ($LASTEXITCODE -ne 0) { throw 'Full backup FAILED; do not migrate' }

  $after = & "$pg\psql.exe" -X --no-password -qAt -v ON_ERROR_STOP=1 -f $fingerprintFile
  if ($LASTEXITCODE -ne 0) { throw 'Post-backup fingerprint failed' }
  if (($before -join "`n") -cne ($after -join "`n")) {
    throw 'Source changed during backup. Preserve files, but repeat in a quiet window for reconciliation.'
  }
  $before | Set-Content -LiteralPath (Join-Path $folder 'source-fingerprint.txt') -Encoding UTF8

  $toc = & "$pg\pg_restore.exe" --list $dump
  if ($LASTEXITCODE -ne 0) { throw 'Archive listing FAILED' }
  $toc | Set-Content -LiteralPath (Join-Path $folder 'archive-contents.txt') -Encoding UTF8
  if ((Get-Item -LiteralPath $dump).Length -le 0) { throw 'Empty backup' }
  Get-FileHash -LiteralPath $schema,$dump -Algorithm SHA256 |
    Select-Object Path,Hash | ConvertTo-Json |
    Set-Content -LiteralPath (Join-Path $folder 'checksums.json') -Encoding UTF8
  Write-Host "Exports created at $folder. Restore verification is still required."
} finally {
  foreach ($key in @('PGPASSWORD','PGHOST','PGPORT','PGDATABASE','PGUSER','PGSSLROOTCERT','PGSSLMODE','PGCONNECT_TIMEOUT','PGOPTIONS')) {
    Remove-Item -LiteralPath "Env:\$key" -ErrorAction SilentlyContinue
  }
  $password = $null
}
```

Stop on permission errors or missing extensions; do not silently exclude schemas
or tables and call the result a full backup. A schema export contains definitions,
including function bodies, policies and grants. Inspect it for embedded secrets
before sharing it. Never share the full dump in chat.

This is a full **single-database logical** backup, not a backup of Supabase account
configuration, cluster roles/passwords, secrets or the actual Storage image objects.
Keep a separate inventory/backup of Storage objects and required role/grant setup.
Do not use `pg_dumpall --globals-only` to export password hashes into a shareable file.

## 3. Verify on an isolated local PostgreSQL cluster

An archive listing or checksum alone does not prove recoverability. This block
restores only into a newly created loopback-only cluster on a free port. It does
not use the existing PostgreSQL service, `restaurant_db`, or Supabase.
Use the same PowerShell window, or set `$pg` and `$folder` to the values above.

`initdb` asks for a NEW temporary verification password twice. Do not reuse the
production password. Supply that temporary password at the later hidden prompt.

```powershell
$ErrorActionPreference = 'Stop'
$pg = 'C:\Program Files\PostgreSQL\18\bin'
# If using a new window, enter the export folder here:
if (-not $folder) { $folder = Read-Host 'Absolute export folder path' }
$dump = Join-Path $folder 'full-database.dump'
$savedHashes = Get-Content -LiteralPath (Join-Path $folder 'checksums.json') -Raw | ConvertFrom-Json
foreach ($entry in $savedHashes) {
  if ((Get-FileHash -LiteralPath $entry.Path -Algorithm SHA256).Hash -ne $entry.Hash) { throw 'Backup checksum mismatch' }
}
$root = Join-Path $env:LOCALAPPDATA ('RestaurantAI-BackupVerification\' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $root | Out-Null
$data = Join-Path $root 'postgres'
$probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
$probe.Start()
$port = ([int]$probe.LocalEndpoint.Port).ToString([Globalization.CultureInfo]::InvariantCulture)
$probe.Stop()
$started = $false
try {
  & "$pg\initdb.exe" -D $data -U postgres --auth=scram-sha-256 --pwprompt --encoding=UTF8 --no-locale
  if ($LASTEXITCODE -ne 0) { throw 'Temporary initdb failed' }
  & "$pg\pg_ctl.exe" -D $data -l (Join-Path $root 'postgres.log') -o "-h 127.0.0.1 -p $port" -w start
  if ($LASTEXITCODE -ne 0) { throw 'Temporary PostgreSQL start failed' }
  $started = $true
  $temporaryPassword = Read-Host 'NEW temporary verification password' -AsSecureString
  $env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $temporaryPassword).Password
  $env:PGSSLMODE = 'disable' # loopback ONLY
  & "$pg\createdb.exe" --no-password -h 127.0.0.1 -p $port -U postgres verify_menu
  if ($LASTEXITCODE -ne 0) { throw 'Temporary database creation failed' }
  & "$pg\pg_restore.exe" --no-password --exit-on-error --single-transaction --no-owner --no-privileges -h 127.0.0.1 -p $port -U postgres -d verify_menu $dump
  if ($LASTEXITCODE -ne 0) { throw 'Restore FAILED; backup is not yet restore-verified' }
  $fingerprintFile = (Resolve-Path 'backend\database\cloud\menu_backup_fingerprint.sql').Path
  $restored = & "$pg\psql.exe" -X --no-password -qAt -h 127.0.0.1 -p $port -U postgres -d verify_menu -v ON_ERROR_STOP=1 -f $fingerprintFile
  if ($LASTEXITCODE -ne 0) { throw 'Restored fingerprint failed' }
  $expected = Get-Content -LiteralPath (Join-Path $folder 'source-fingerprint.txt')
  if (($restored -join "`n") -cne ($expected -join "`n")) { throw 'Restored data differs from source fingerprint' }
  $restored | Set-Content -LiteralPath (Join-Path $folder 'restored-fingerprint.txt') -Encoding UTF8
  Write-Host 'Full archive restored. Menu/categories/orders/order_items fingerprints match.'
  Write-Host 'Production compatibility, role/grant behavior and remaining business-table reconciliation still need review.'
} finally {
  Remove-Item Env:\PGPASSWORD,Env:\PGSSLMODE -ErrorAction SilentlyContinue
  $temporaryPassword = $null
  if ($started -or (Test-Path -LiteralPath (Join-Path $data 'postmaster.pid'))) {
    & "$pg\pg_ctl.exe" -D $data -m fast -w stop
    if ($LASTEXITCODE -ne 0) { Write-Warning "Temporary PostgreSQL stop failed; inspect only $data" }
  }
}
```

Supabase-managed schemas can depend on roles, extensions and functions absent
from ordinary PostgreSQL. If restore fails for that reason, retain the log and
schema export for review. Do not ignore errors, strip objects blindly, or claim a
full verified restore; a compatible isolated Supabase environment may be required.
The verification restore deliberately omits ownership/grants; its success does
not validate production RLS or the Render database role. Review these separately.

The stopped temporary cluster still contains private data. Keep it protected;
do not upload it or add it to Git. No cleanup/deletion is automatic.

## 4. What to provide for the next review

- Schema-only export, after checking for embedded secrets.
- PostgreSQL server/client versions and any export/restore error messages, redacted.
- SHA-256 values and source/restored row counts/fingerprints (not row contents).
- Confirm whether the full restore completed without errors.

Do not provide the password, connection URL, service-role key or full database dump.
Do not run either menu migration until the export review and backup checks pass.

References:
- [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [PostgreSQL pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html)
- [Supabase backup scope](https://supabase.com/docs/guides/platform/backups)
