param(
  [string]$IsccPath = "",
  [switch]$SkipPortableBuild
)

$ErrorActionPreference = "Stop"

function Find-Iscc {
  param([string]$RequestedPath)

  if ($RequestedPath) {
    if (Test-Path -LiteralPath $RequestedPath) {
      return (Resolve-Path -LiteralPath $RequestedPath).Path
    }
    throw "ISCC.exe not found at requested path: $RequestedPath"
  }

  $command = Get-Command ISCC.exe -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  foreach ($path in @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
  )) {
    if (Test-Path -LiteralPath $path) {
      return $path
    }
  }

  return $null
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$issPath = Join-Path $repoRoot "installer\RestaurantAI.iss"
$portableRoot = Join-Path $repoRoot "dist\RestaurantAI-Windows"
$outputDir = Join-Path $repoRoot "dist\installer"

if (-not (Test-Path -LiteralPath $issPath)) {
  throw "Installer script not found: $issPath"
}

if (-not $SkipPortableBuild) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\build-windows-package.ps1")
  if ($LASTEXITCODE -ne 0) {
    throw "Portable package build failed."
  }
}

foreach ($required in @(
  "app\backend\src\server.js",
  "app\backend\node_modules",
  "app\admin\dist\index.html",
  "app\frontend\index.html",
  "app\backend\database\bootstrap\offline_v1_schema.sql",
  "scripts\setup-restaurantai.ps1",
  "scripts\start-restaurantai.ps1",
  "config\.env.example"
)) {
  $path = Join-Path $portableRoot $required
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Portable package is missing required installer input: $path"
  }
}

$leakedFiles = Get-ChildItem -LiteralPath $portableRoot -Force -Recurse -File |
  Where-Object { $_.Name -eq ".env" -or $_.Extension -in @(".dump", ".bak") -or $_.Name -in @("backend.log", "backend-error.log", "server.log") }

if ($leakedFiles) {
  $paths = ($leakedFiles | Select-Object -ExpandProperty FullName) -join [Environment]::NewLine
  throw "Portable package contains files that must not be embedded in the installer:$([Environment]::NewLine)$paths"
}

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

$iscc = Find-Iscc $IsccPath
if (-not $iscc) {
  Write-Warning "Inno Setup Compiler was not found. Install Inno Setup 6 or pass -IsccPath to compile."
  Write-Host "Installer source is ready: $issPath"
  exit 2
}

Push-Location (Join-Path $repoRoot "installer")
try {
  & $iscc $issPath
  if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup compilation failed."
  }
} finally {
  Pop-Location
}

$version = (Get-Content -LiteralPath (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json).version
$installerPath = Join-Path $outputDir "RestaurantAI-Setup-$version.exe"

if (-not (Test-Path -LiteralPath $installerPath)) {
  throw "Expected installer was not created: $installerPath"
}

$installer = Get-Item -LiteralPath $installerPath
Write-Host "Installer built successfully."
Write-Host "Path: $($installer.FullName)"
Write-Host "Size: $([Math]::Round($installer.Length / 1MB, 2)) MB"
