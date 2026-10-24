param(
  [string]$InstallRoot = "",
  [string]$StateRoot = "",
  [switch]$DryRun,
  [switch]$SkipDatabaseCheck
)

$ErrorActionPreference = "Stop"

function Read-Default {
  param(
    [string]$Prompt,
    [string]$Default
  )

  $value = Read-Host "$Prompt [$Default]"
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $Default
  }
  return $value.Trim()
}

function Read-YesNo {
  param(
    [string]$Prompt,
    [bool]$Default = $false
  )

  $label = if ($Default) { "Y/n" } else { "y/N" }
  $value = Read-Host "$Prompt [$label]"
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $Default
  }
  return $value.Trim().ToLowerInvariant().StartsWith("y")
}

function New-Secret {
  $bytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
  } finally {
    $rng.Dispose()
  }
}

function Get-ExistingOrDefault {
  param(
    [hashtable]$Values,
    [string]$Key,
    [string]$Default
  )

  if ($Values.ContainsKey($Key) -and -not [string]::IsNullOrWhiteSpace($Values[$Key])) {
    return $Values[$Key]
  }

  return $Default
}

function Convert-SecureStringToPlainText {
  param([securestring]$Secret)

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Find-PostgresTool {
  param([string]$Name, [string]$BinDir)

  if ($BinDir) {
    $candidate = Join-Path $BinDir $Name
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  foreach ($dir in @(
    "C:\Program Files\PostgreSQL\18\bin",
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\15\bin"
  )) {
    $candidate = Join-Path $dir $Name
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Test-DatabaseExists {
  param(
    [string]$Psql,
    [string]$HostName,
    [string]$Port,
    [string]$User,
    [string]$Password,
    [string]$Database
  )

  $env:PGPASSWORD = $Password
  try {
    $result = & $Psql -h $HostName -p $Port -U $User -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$($Database.Replace("'", "''"))';" 2>$null
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL connection check failed. No database will be created." }
    return (($result | Select-Object -First 1) -eq "1")
  } finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  }
}

function Create-Database {
  param(
    [string]$Createdb,
    [string]$HostName,
    [string]$Port,
    [string]$User,
    [string]$Password,
    [string]$Database
  )

  $env:PGPASSWORD = $Password
  try {
    & $Createdb -h $HostName -p $Port -U $User $Database
    if ($LASTEXITCODE -ne 0) {
      throw "createdb failed for $Database"
    }
  } finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  }
}

function Invoke-BootstrapSchema {
  param(
    [string]$Psql,
    [string]$HostName,
    [string]$Port,
    [string]$User,
    [string]$Password,
    [string]$Database,
    [string]$SchemaPath
  )

  if (-not (Test-Path $SchemaPath)) {
    throw "Bootstrap schema not found: $SchemaPath"
  }

  $env:PGPASSWORD = $Password
  try {
    & $Psql -h $HostName -p $Port -U $User -d $Database -v ON_ERROR_STOP=1 -f $SchemaPath
    if ($LASTEXITCODE -ne 0) {
      throw "Bootstrap schema failed for $Database"
    }
  } finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  }
}

function Invoke-InitialAdminSetup {
  param(
    [string]$BackendPath,
    [string]$ConfigPath,
    [string]$Name,
    [string]$Email,
    [string]$Password
  )

  $adminScript = Join-Path $BackendPath "scripts\createInitialAdmin.js"
  if (-not (Test-Path $adminScript)) {
    throw "Initial admin script not found: $adminScript"
  }

  $previousEnvPath = $env:RESTAURANTAI_ENV_PATH
  $previousEnvFile = $env:RESTAURANTAI_ENV_FILE
  $previousName = $env:ADMIN_SETUP_NAME
  $previousEmail = $env:ADMIN_SETUP_EMAIL
  $previousPassword = $env:ADMIN_SETUP_PASSWORD

  try {
    $env:RESTAURANTAI_ENV_PATH = $ConfigPath
    $env:RESTAURANTAI_ENV_FILE = $ConfigPath
    $env:ADMIN_SETUP_NAME = $Name
    $env:ADMIN_SETUP_EMAIL = $Email
    $env:ADMIN_SETUP_PASSWORD = $Password

    Push-Location $BackendPath
    try {
      node scripts\createInitialAdmin.js
      if ($LASTEXITCODE -ne 0) {
        throw "Initial admin creation failed."
      }
    } finally {
      Pop-Location
    }
  } finally {
    if ($null -eq $previousEnvPath) { Remove-Item Env:\RESTAURANTAI_ENV_PATH -ErrorAction SilentlyContinue } else { $env:RESTAURANTAI_ENV_PATH = $previousEnvPath }
    if ($null -eq $previousEnvFile) { Remove-Item Env:\RESTAURANTAI_ENV_FILE -ErrorAction SilentlyContinue } else { $env:RESTAURANTAI_ENV_FILE = $previousEnvFile }
    if ($null -eq $previousName) { Remove-Item Env:\ADMIN_SETUP_NAME -ErrorAction SilentlyContinue } else { $env:ADMIN_SETUP_NAME = $previousName }
    if ($null -eq $previousEmail) { Remove-Item Env:\ADMIN_SETUP_EMAIL -ErrorAction SilentlyContinue } else { $env:ADMIN_SETUP_EMAIL = $previousEmail }
    if ($null -eq $previousPassword) { Remove-Item Env:\ADMIN_SETUP_PASSWORD -ErrorAction SilentlyContinue } else { $env:ADMIN_SETUP_PASSWORD = $previousPassword }
  }
}

function Merge-SetupConfig {
  param([string[]]$Defaults, [hashtable]$Existing)
  $merged = @{}
  foreach ($line in $Defaults) { $pair = $line -split '=', 2; $merged[$pair[0]] = $pair[1] }
  foreach ($key in $Existing.Keys) { $merged[$key] = $Existing[$key] }
  foreach ($key in @('PORT','HOST','ALLOW_LAN_ORIGINS','DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD','POSTGRES_BIN_DIR')) {
    $line = $Defaults | Where-Object { $_.StartsWith("$key=") } | Select-Object -First 1
    if ($line) { $merged[$key] = ($line -split '=', 2)[1] }
  }
  foreach ($key in ($merged.Keys | Sort-Object)) {
    $value = [string]$merged[$key]
    if ($value -match '[\r\n]') { throw "Multiline setting not supported by Windows setup: $key" }
    if ($value -match '[#\s\x22\x27\x60]') {
      $quote = @([char]39, [char]34, [char]96) | Where-Object { -not $value.Contains([string]$_) } | Select-Object -First 1
      if (-not $quote) { throw "Setting contains all quoting delimiters; configure it manually: $key" }
      $value = "$quote$value$quote"
    }
    "$key=$value"
  }
}

if ($env:RESTAURANTAI_SCRIPT_TEST_MODE -eq '1') { return }

$root = if ($InstallRoot) { $InstallRoot } else { Split-Path -Parent $PSScriptRoot }
$stateRoot = if ($StateRoot) {
  [System.IO.Path]::GetFullPath($StateRoot)
} elseif ($env:RESTAURANTAI_STATE_ROOT) {
  [System.IO.Path]::GetFullPath($env:RESTAURANTAI_STATE_ROOT)
} elseif (Test-Path (Join-Path $root 'app\backend\src\server.js')) {
  Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'RestaurantAI'
} else {
  $root
}
$packagedBackend = Join-Path $root "app\backend"
$backendPath = if (Test-Path (Join-Path $packagedBackend "src\server.js")) { $packagedBackend } else { Join-Path $root "backend" }
$configDir = if ($StateRoot -or $env:RESTAURANTAI_STATE_ROOT -or (Test-Path (Join-Path $root "app"))) { Join-Path $stateRoot "config" } else { $backendPath }
$configPath = Join-Path $configDir ".env"
$bootstrapSchema = Join-Path $backendPath "database\bootstrap\offline_v1_schema.sql"

New-Item -ItemType Directory -Path $configDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stateRoot "backups\database") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stateRoot "backups\logs") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stateRoot "data") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stateRoot "logs") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stateRoot "runtime") -Force | Out-Null
$uploadsDir = Join-Path $stateRoot "data\uploads"

Write-Host "RestaurantAI Setup Wizard"
Write-Host "Config file: $configPath"
Write-Host "Secrets are written to .env but are not printed."
Write-Host ""

$existing = @{}
if (Test-Path $configPath) {
  $json = & node -e "const fs=require('fs');const req=require('module').createRequire(process.argv[1]);process.stdout.write(JSON.stringify(req('dotenv').parse(fs.readFileSync(process.argv[2]))));" (Join-Path $backendPath 'package.json') $configPath
  if ($LASTEXITCODE -ne 0) { throw 'Cannot read existing configuration safely.' }
  $parsed = $json | ConvertFrom-Json
  foreach ($property in $parsed.PSObject.Properties) { $existing[$property.Name] = $property.Value }
}

$port = if ($DryRun) { Get-ExistingOrDefault $existing "PORT" "5001" } else { Read-Default "Backend port" (Get-ExistingOrDefault $existing "PORT" "5001") }
$enableLan = if ($DryRun) { (Get-ExistingOrDefault $existing "HOST" "127.0.0.1") -eq "0.0.0.0" } else { Read-YesNo "Allow LAN devices to connect" ((Get-ExistingOrDefault $existing "HOST" "127.0.0.1") -eq "0.0.0.0") }
$hostValue = if ($enableLan) { "0.0.0.0" } else { "127.0.0.1" }
$allowLanOrigins = if ($enableLan) { "true" } else { "false" }

$dbHost = if ($DryRun) { Get-ExistingOrDefault $existing "DB_HOST" "127.0.0.1" } else { Read-Default "PostgreSQL host" (Get-ExistingOrDefault $existing "DB_HOST" "127.0.0.1") }
$dbPort = if ($DryRun) { Get-ExistingOrDefault $existing "DB_PORT" "5432" } else { Read-Default "PostgreSQL port" (Get-ExistingOrDefault $existing "DB_PORT" "5432") }
$dbName = if ($DryRun) { Get-ExistingOrDefault $existing "DB_NAME" "restaurant_db" } else { Read-Default "Database name" (Get-ExistingOrDefault $existing "DB_NAME" "restaurant_db") }
$dbUser = if ($DryRun) { Get-ExistingOrDefault $existing "DB_USER" "postgres" } else { Read-Default "Database user" (Get-ExistingOrDefault $existing "DB_USER" "postgres") }

$dbPassword = ""
if ($DryRun) {
  $dbPassword = Get-ExistingOrDefault $existing "DB_PASSWORD" "dry-run-password-not-written"
} else {
  $securePassword = Read-Host "Database password (not shown)" -AsSecureString
  $dbPassword = Convert-SecureStringToPlainText $securePassword
}
if ([string]::IsNullOrEmpty($dbPassword) -and $existing.ContainsKey("DB_PASSWORD")) {
  $dbPassword = $existing.DB_PASSWORD
}

$postgresBinDir = if ($DryRun) { Get-ExistingOrDefault $existing "POSTGRES_BIN_DIR" "C:\Program Files\PostgreSQL\18\bin" } else { Read-Default "PostgreSQL bin folder" (Get-ExistingOrDefault $existing "POSTGRES_BIN_DIR" "C:\Program Files\PostgreSQL\18\bin") }
$psql = Find-PostgresTool "psql.exe" $postgresBinDir
$createdb = Find-PostgresTool "createdb.exe" $postgresBinDir

if ($DryRun -or $SkipDatabaseCheck) {
  Write-Host "Database check skipped."
} elseif ($psql -and $createdb -and $dbPassword) {
  $exists = Test-DatabaseExists $psql $dbHost $dbPort $dbUser $dbPassword $dbName
  $databaseReadyForAdmin = $false
  if ($exists) {
    Write-Host "Database exists: $dbName"
    $databaseReadyForAdmin = $true
  } elseif (Read-YesNo "Database $dbName was not detected. Create it now" $false) {
    Create-Database $createdb $dbHost $dbPort $dbUser $dbPassword $dbName
    Write-Host "Database created: $dbName"
    if (Read-YesNo "Apply RestaurantAI offline-v1 bootstrap schema now" $true) {
      Invoke-BootstrapSchema $psql $dbHost $dbPort $dbUser $dbPassword $dbName $bootstrapSchema
      Write-Host "Bootstrap schema applied."
      $databaseReadyForAdmin = $true
    } else {
      throw "Setup incomplete: bootstrap schema was not applied."
    }
  } else {
    throw "Setup incomplete: database was not created."
  }
} else {
  throw "Setup requires PostgreSQL tools and database credentials."
}

$jwtSecret = Get-ExistingOrDefault $existing "JWT_SECRET" (New-Secret)
$otpSecret = Get-ExistingOrDefault $existing "OTP_SECRET" (New-Secret)

$envLines = @(
  "RESTAURANTAI_MODE=local",
  "NODE_ENV=production",
  "PORT=$port",
  "HOST=$hostValue",
  "ALLOW_LAN_ORIGINS=$allowLanOrigins",
  "LAN_CLIENT_PORTS=3000,5173,5174,5175,5500,5501,8080",
  "CORS_ORIGINS=http://localhost:$port",
  "DB_HOST=$dbHost",
  "DB_PORT=$dbPort",
  "DB_NAME=$dbName",
  "DB_USER=$dbUser",
  "DB_PASSWORD=$dbPassword",
  "UPLOAD_DIR=$uploadsDir",
  "JWT_SECRET=$jwtSecret",
  "JWT_EXPIRE=7d",
  "OTP_SECRET=$otpSecret",
  "BACKUP_DIR=../backups/database",
  "POSTGRES_BIN_DIR=$postgresBinDir",
  "BACKUP_RETENTION_DAYS=30",
  "BACKUP_RETENTION_COUNT=30",
  "WHATSAPP_ENABLED=false",
  "CLOUD_SYNC_ENABLED=false",
  "CLOUD_SYNC_BASE_URL=https://restaurant-ai-4myq.onrender.com/api",
  "CLOUD_SYNC_INTERVAL_SECONDS=10"
)

if ($DryRun) {
  Write-Host "Dry run: configuration was not written."
  Write-Host "Dry run target config: $configPath"
} else {
  # Preserve every existing setting, including sync, messaging and receipt configuration.
  $merged = @(Merge-SetupConfig -Defaults $envLines -Existing $existing)
  $pendingPath = "$configPath.pending"
  Set-Content -LiteralPath $pendingPath -Value $merged -Encoding UTF8
  try {
    if (-not $SkipDatabaseCheck) {
      & node (Join-Path $backendPath 'scripts\deployment.js') migrate $pendingPath
      if ($LASTEXITCODE -ne 0) { throw 'Database preparation failed. Existing configuration was preserved.' }
    }
    Move-Item -LiteralPath $pendingPath -Destination $configPath -Force
  } finally {
    Remove-Item -LiteralPath $pendingPath -Force -ErrorAction SilentlyContinue
  }
}

if (-not $DryRun -and $databaseReadyForAdmin -and (Read-YesNo "Create the first admin account now if the admins table is empty" $true)) {
  $adminName = Read-Default "Initial admin name" "RestaurantAI Admin"
  $adminEmail = Read-Default "Initial admin email" "admin@restaurantai.local"
  $adminSecurePassword = Read-Host "Initial admin password (not shown)" -AsSecureString
  $adminPassword = Convert-SecureStringToPlainText $adminSecurePassword
  if ([string]::IsNullOrWhiteSpace($adminPassword)) {
    throw "Initial admin password cannot be empty."
  }
  Invoke-InitialAdminSetup $backendPath $configPath $adminName $adminEmail $adminPassword
}

Write-Host ""
if (-not $DryRun) {
  Write-Host "Setup file written."
}
Write-Host "Protect this file with Windows account permissions: $configPath"
Write-Host "Next: run scripts\check-system.ps1, then scripts\start-restaurantai.ps1."
