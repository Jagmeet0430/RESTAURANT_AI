param(
  [string]$InstallRoot = "",
  [string]$StateRoot = ""
)

$ErrorActionPreference = "Stop"

function Import-EnvFileForBackup {
  param(
    [string]$Path,
    [string[]]$Keys
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  $json = & node -e "const fs=require('fs');const req=require('module').createRequire(process.argv[1]);process.stdout.write(JSON.stringify(req('dotenv').parse(fs.readFileSync(process.argv[2]))));" (Join-Path $backendPath 'package.json') $Path
  if ($LASTEXITCODE -ne 0) { throw 'Cannot read backup configuration.' }
  $parsed = $json | ConvertFrom-Json
  foreach ($property in $parsed.PSObject.Properties) {
    if ($Keys -contains $property.Name) { [Environment]::SetEnvironmentVariable($property.Name, $property.Value, 'Process') }
  }
}

function Restore-EnvValues {
  param([hashtable]$Values)

  foreach ($key in $Values.Keys) {
    [Environment]::SetEnvironmentVariable($key, $Values[$key], "Process")
  }
}

function Resolve-BackupConfigPath {
  param(
    [string]$StateRootPath,
    [string]$RepositoryRoot,
    [string]$BackendRoot
  )

  $candidates = @()
  if ($StateRootPath) {
    $candidates += Join-Path $StateRootPath "config\.env"
  }
  $candidates += Join-Path $RepositoryRoot "config\.env"
  $candidates += Join-Path $BackendRoot ".env"

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw "RestaurantAI config file was not found. Checked: $($candidates -join ', ')"
}

$repoRoot = if ($InstallRoot) { [System.IO.Path]::GetFullPath($InstallRoot) } else { Split-Path -Parent $PSScriptRoot }
$stateRoot = if ($StateRoot) {
  [System.IO.Path]::GetFullPath($StateRoot)
} elseif ($env:RESTAURANTAI_STATE_ROOT) {
  [System.IO.Path]::GetFullPath($env:RESTAURANTAI_STATE_ROOT)
} elseif (Test-Path (Join-Path $repoRoot 'app\backend\src\server.js')) {
  Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'RestaurantAI'
} else {
  $repoRoot
}
$packagedBackend = Join-Path $repoRoot "app\backend"
$backendPath = if (Test-Path (Join-Path $packagedBackend "src\server.js")) { $packagedBackend } else { Join-Path $repoRoot "backend" }
$configPath = Resolve-BackupConfigPath -StateRootPath $stateRoot -RepositoryRoot $repoRoot -BackendRoot $backendPath
$timestamp = (Get-Date -Format "yyyy-MM-dd_HHmmss") + '_' + [guid]::NewGuid().ToString('N').Substring(0,8)
$fullBackupRoot = Join-Path $stateRoot "backups\full"
$fullBackupDir = Join-Path $fullBackupRoot "restaurantai_$timestamp"
$databaseBackupDir = Join-Path $fullBackupDir "database"
$filesBackupDir = Join-Path $fullBackupDir "files"

New-Item -ItemType Directory -Path $databaseBackupDir -Force | Out-Null
New-Item -ItemType Directory -Path $filesBackupDir -Force | Out-Null

$configEnvKeys = @(
  "RESTAURANTAI_MODE",
  "HOST",
  "PORT",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "JWT_SECRET",
  "BACKUP_RETENTION_DAYS",
  "BACKUP_RETENTION_COUNT",
  "POSTGRES_BIN_DIR"
)
$previousEnvValues = @{}
foreach ($key in @($configEnvKeys + @("BACKUP_DIR", "RESTAURANTAI_ENV_PATH", "RESTAURANTAI_ENV_FILE"))) {
  $item = Get-Item "Env:\$key" -ErrorAction SilentlyContinue
  $previousEnvValues[$key] = if ($item) { $item.Value } else { $null }
}

$env:BACKUP_DIR = $databaseBackupDir
$env:RESTAURANTAI_ENV_PATH = $configPath
$env:RESTAURANTAI_ENV_FILE = $configPath
Import-EnvFileForBackup -Path $configPath -Keys $configEnvKeys
$env:BACKUP_DIR = $databaseBackupDir
if ($env:RESTAURANTAI_MODE -ne 'local' -or $env:DB_HOST -notin @('127.0.0.1','localhost','::1')) {
  Restore-EnvValues -Values $previousEnvValues
  throw 'Windows backup requires the local PostgreSQL database on this PC.'
}

Write-Host "Creating RestaurantAI full backup..."
Write-Host "Destination: $fullBackupDir"

Push-Location $backendPath
try {
  node scripts\backupDatabase.js
  $backupExitCode = $LASTEXITCODE
  if ($backupExitCode -ne 0) {
    throw "Database backup failed with exit code $backupExitCode."
  }
} finally {
  Pop-Location
  Restore-EnvValues -Values $previousEnvValues
}

$persistentCandidates = @(
  "data\uploads",
  "uploads",
  "backend\uploads",
  "frontend\assets\uploads",
  "assets\uploads",
  "documents",
  "backend\documents",
  "chroma",
  "vector_store",
  "ai\chroma",
  "ai\vector_store"
)

$copied = @()

foreach ($relativePath in $persistentCandidates) {
  $source = Join-Path $stateRoot $relativePath
  if (-not (Test-Path $source)) {
    $source = Join-Path $repoRoot $relativePath
  }
  if (Test-Path $source) {
    $destination = Join-Path $filesBackupDir $relativePath
    $destinationParent = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
    Copy-Item -Path $source -Destination $destination -Recurse -Force
    $copied += $relativePath
  }
}

$dump = Get-ChildItem -Path $databaseBackupDir -Filter "*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$metadata = Get-ChildItem -Path $databaseBackupDir -Filter "*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $dump -or -not $metadata -or $dump.Length -le 0) { throw 'Backup verification failed: dump/metadata missing.' }
$dumpMetadata = Get-Content -LiteralPath $metadata.FullName -Raw | ConvertFrom-Json
if ((Get-FileHash -LiteralPath $dump.FullName -Algorithm SHA256).Hash -ne $dumpMetadata.checksum_sha256) { throw 'Backup checksum mismatch.' }

# Configuration contains credentials. Keep its recovery copy separate and ACL-restricted.
$privateDir = Join-Path $fullBackupDir 'configuration'
New-Item -ItemType Directory -Path $privateDir -Force | Out-Null
$operatorSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $privateDir /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)(F)' '*S-1-5-32-544:(OI)(CI)(F)' "*$($operatorSid):(OI)(CI)(F)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot protect configuration backup; backup incomplete.' }
Copy-Item -LiteralPath $configPath -Destination (Join-Path $privateDir '.env')
foreach ($name in @('printer.json', 'kiosk.json')) {
  $source = Join-Path (Split-Path $configPath -Parent) $name
  if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination $privateDir }
}

$manifest = [ordered]@{
  created_at = (Get-Date).ToString("o")
  backup_type = "restaurantai-full"
  database_dump = if ($dump) { $dump.FullName } else { $null }
  database_metadata = if ($metadata) { $metadata.FullName } else { $null }
  copied_persistent_paths = $copied
  excluded_paths = @("node_modules", ".venv", "venv", ".env", ".env.*", "dist", "build", "backups")
  secrets_included = $true
  configuration_backup = 'configuration (restricted to Administrators, SYSTEM and the backup operator; do not share)'
}

$manifestPath = Join-Path $fullBackupDir "manifest.json"
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host "Full backup completed."
Write-Host "Manifest: $manifestPath"
