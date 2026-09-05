param(
  [int]$Port = 5001,
  [string]$InstallRoot = "",
  [string]$StateRoot = "",
  [string]$NodePath = ""
)

$ErrorActionPreference = "Stop"

function Resolve-RestaurantRoot {
  param([string]$RequestedRoot)

  if ($RequestedRoot) {
    return (Resolve-Path $RequestedRoot).Path
  }

  return (Split-Path -Parent $PSScriptRoot)
}

function Get-AppPaths {
  param([string]$Root)

  $state = if ($StateRoot) {
    [System.IO.Path]::GetFullPath($StateRoot)
  } elseif ($env:RESTAURANTAI_STATE_ROOT) {
    [System.IO.Path]::GetFullPath($env:RESTAURANTAI_STATE_ROOT)
  } else {
    $Root
  }

  $packagedBackend = Join-Path $Root "app\backend"
  if (Test-Path (Join-Path $packagedBackend "src\server.js")) {
    return @{
      Root = $Root
      Backend = $packagedBackend
      State = $state
      Config = Join-Path $state "config\.env"
      Backups = Join-Path $state "backups\database"
      Runtime = Join-Path $state "runtime"
      Logs = Join-Path $state "logs"
    }
  }

  return @{
    Root = $Root
    Backend = Join-Path $Root "backend"
    State = $state
    Config = if ($StateRoot -or $env:RESTAURANTAI_STATE_ROOT) { Join-Path $state "config\.env" } else { Join-Path $Root "backend\.env" }
    Backups = Join-Path $state "backups\database"
    Runtime = Join-Path $state "runtime"
    Logs = Join-Path $state "logs"
  }
}

function Add-Check {
  param(
    [string]$Status,
    [string]$Name,
    [string]$Detail
  )

  [pscustomobject]@{
    Status = $Status
    Name = $Name
    Detail = $Detail
  }
}

function Find-CommandPath {
  param([string]$CommandName)

  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $common = @(
    "C:\Program Files\PostgreSQL\18\bin",
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\15\bin"
  )

  foreach ($dir in $common) {
    $candidate = Join-Path $dir $CommandName
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Test-WritableDirectory {
  param([string]$Path)

  New-Item -ItemType Directory -Path $Path -Force | Out-Null
  $probe = Join-Path $Path ".restaurantai-write-test"
  Set-Content -Path $probe -Value "ok" -Encoding ASCII
  Remove-Item -LiteralPath $probe -Force
}

$root = Resolve-RestaurantRoot $InstallRoot
$paths = Get-AppPaths $root
$checks = New-Object System.Collections.Generic.List[object]

$checks.Add((Add-Check "PASS" "Windows" "$([System.Environment]::OSVersion.VersionString)"))

$nodeExe = if ($NodePath) { $NodePath } else { "" }
if (-not $nodeExe) {
  $bundledNode = Join-Path $paths.Root "runtime\node\node.exe"
  if (Test-Path $bundledNode) {
    $nodeExe = $bundledNode
  }
}
if (-not $nodeExe) {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node) {
    $nodeExe = $node.Source
  }
}
if ($nodeExe -and (Test-Path $nodeExe)) {
  $version = (& $nodeExe --version)
  $major = [int]($version.TrimStart("v").Split(".")[0])
  $checks.Add((Add-Check ($(if ($major -ge 18) { "PASS" } else { "FAIL" })) "Node.js" $version))
} else {
  $checks.Add((Add-Check "FAIL" "Node.js" "node.exe not found on PATH"))
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($npm) {
  $checks.Add((Add-Check "PASS" "npm" (& npm.cmd --version)))
} else {
  $checks.Add((Add-Check "FAIL" "npm" "npm.cmd not found on PATH"))
}

foreach ($tool in @("psql.exe", "pg_dump.exe", "pg_restore.exe")) {
  $toolPath = Find-CommandPath $tool
  if ($toolPath) {
    $checks.Add((Add-Check "PASS" $tool $toolPath))
  } else {
    $checks.Add((Add-Check "FAIL" $tool "Not found. Set POSTGRES_BIN_DIR or add PostgreSQL bin to PATH."))
  }
}

$pgServices = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgServices) {
  $running = $pgServices | Where-Object { $_.Status -eq "Running" }
  if ($running) {
    $checks.Add((Add-Check "PASS" "PostgreSQL service" (($running | Select-Object -ExpandProperty Name) -join ", ")))
  } else {
    $checks.Add((Add-Check "WARN" "PostgreSQL service" "Service exists but is not running."))
  }
} else {
  $checks.Add((Add-Check "WARN" "PostgreSQL service" "No service named postgresql* found. PostgreSQL may be manual or not installed."))
}

$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
  $checks.Add((Add-Check "PASS" "Optional Python AI runtime" (& python --version)))
} else {
  $checks.Add((Add-Check "WARN" "Optional Python AI runtime" "Not found. Core RestaurantAI works without local AI/OCR."))
}

$ragPath = Join-Path $paths.Root "ai\Rag_chatbot"
if (Test-Path $ragPath) {
  $checks.Add((Add-Check "WARN" "Optional RAG chatbot" "Source present; configure Python dependencies only if AI assistant is needed."))
}

$ocrPath = Join-Path $paths.Root "ai\menu_digitization"
if (Test-Path $ocrPath) {
  $checks.Add((Add-Check "WARN" "Optional OCR" "Source present; configure Python dependencies only if OCR upload is needed."))
}

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  $checks.Add((Add-Check "WARN" "Backend port $Port" "Port is already listening. Stop existing RestaurantAI before starting another instance."))
} else {
  $checks.Add((Add-Check "PASS" "Backend port $Port" "Available"))
}

if (Test-Path $paths.Config) {
  $checks.Add((Add-Check "PASS" "Environment file" $paths.Config))
} else {
  $checks.Add((Add-Check "WARN" "Environment file" "Missing: $($paths.Config). Run setup-restaurantai.ps1."))
}

foreach ($dirName in @("Backups", "Runtime", "Logs")) {
  try {
    Test-WritableDirectory $paths[$dirName]
    $checks.Add((Add-Check "PASS" "$dirName directory writable" $paths[$dirName]))
  } catch {
    $checks.Add((Add-Check "FAIL" "$dirName directory writable" $_.Exception.Message))
  }
}

Write-Host "RestaurantAI System Check"
Write-Host "Root: $root"
Write-Host ""

$checks | Format-Table -AutoSize

if ($checks.Status -contains "FAIL") {
  exit 1
}

if ($checks.Status -contains "WARN") {
  exit 2
}

exit 0
