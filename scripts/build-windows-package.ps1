param(
  [switch]$SkipAdminBuild,
  [switch]$SkipBackendInstall
)

$ErrorActionPreference = "Stop"

function Copy-Directory {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (Test-Path $Source) {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
      Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force
    }
  }
}

function Copy-FileIfExists {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (Test-Path $Source) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
    Copy-Item -Path $Source -Destination $Destination -Force
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$packageRoot = Join-Path $repoRoot "dist\RestaurantAI-Windows"
$appRoot = Join-Path $packageRoot "app"
$backendOut = Join-Path $appRoot "backend"
$adminOut = Join-Path $appRoot "admin"
$frontendOut = Join-Path $appRoot "frontend"

$resolvedPackageRoot = [System.IO.Path]::GetFullPath($packageRoot)
$resolvedRepoRoot = [System.IO.Path]::GetFullPath($repoRoot)
$appVersion = (Get-Content -LiteralPath (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json).version
if (-not $resolvedPackageRoot.StartsWith($resolvedRepoRoot)) {
  throw "Refusing to build package outside repository: $resolvedPackageRoot"
}

if (Test-Path $packageRoot) {
  Remove-Item -LiteralPath $packageRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $backendOut -Force | Out-Null
New-Item -ItemType Directory -Path $adminOut -Force | Out-Null
New-Item -ItemType Directory -Path $frontendOut -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot "config") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot "data") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot "backups") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot "logs") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot "runtime") -Force | Out-Null

if (-not $SkipAdminBuild) {
  Push-Location (Join-Path $repoRoot "admin")
  try {
    $previousBasePath = $env:VITE_BASE_PATH
    $env:VITE_BASE_PATH = "/admin/"
    npm.cmd run build
  } finally {
    if ($null -eq $previousBasePath) {
      Remove-Item Env:\VITE_BASE_PATH -ErrorAction SilentlyContinue
    } else {
      $env:VITE_BASE_PATH = $previousBasePath
    }
    Pop-Location
  }
}

Copy-FileIfExists (Join-Path $repoRoot "backend\package.json") (Join-Path $backendOut "package.json")
Copy-FileIfExists (Join-Path $repoRoot "backend\package-lock.json") (Join-Path $backendOut "package-lock.json")
Copy-FileIfExists (Join-Path $repoRoot "backend\.env.example") (Join-Path $packageRoot "config\.env.example")
Copy-Directory (Join-Path $repoRoot "backend\src") (Join-Path $backendOut "src")
Copy-Directory (Join-Path $repoRoot "backend\scripts") (Join-Path $backendOut "scripts")
Copy-Directory (Join-Path $repoRoot "backend\database") (Join-Path $backendOut "database")
Copy-Directory (Join-Path $repoRoot "admin\dist") (Join-Path $adminOut "dist")
Copy-Directory (Join-Path $repoRoot "frontend") $frontendOut
Copy-Directory (Join-Path $repoRoot "docs") (Join-Path $packageRoot "docs")
Copy-Directory (Join-Path $repoRoot "scripts") (Join-Path $packageRoot "scripts")

foreach ($path in @(
  (Join-Path $frontendOut "server.log"),
  (Join-Path $frontendOut "frontend\server.log"),
  (Join-Path $packageRoot "scripts\build-windows-package.ps1")
)) {
  Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
}

if (-not $SkipBackendInstall) {
  Push-Location $backendOut
  try {
    npm.cmd install --omit=dev --ignore-scripts
  } finally {
    Pop-Location
  }
}

$manifest = [ordered]@{
  created_at = (Get-Date).ToString("o")
  name = "RestaurantAI"
  version = $appVersion
  package_type = "portable-windows"
  requires = @("Windows", "Node.js 18+", "PostgreSQL 15+")
  entrypoints = @{
    setup = "scripts\setup-restaurantai.ps1"
    preflight = "scripts\check-system.ps1"
    start = "scripts\start-restaurantai.ps1"
    stop = "scripts\stop-restaurantai.ps1"
    backup = "scripts\backup-restaurantai.ps1"
    smoke = "scripts\smoke-release.ps1"
  }
  urls = @{
    admin = "http://SERVER:5001/admin"
    pos = "http://SERVER:5001/admin/barcode-pos"
    kitchen = "http://SERVER:5001/admin/kitchen"
    customer = "http://SERVER:5001/customer"
    health = "http://SERVER:5001/api/health"
  }
  excludes = @(".git", ".env", ".env.*", "backups", ".venv", "venv", "node_modules dev dependencies", "dist source cache")
  secrets_included = $false
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $packageRoot "package-manifest.json") -Encoding UTF8

@"
RestaurantAI Windows Portable Package

1. Install Node.js 18+ and PostgreSQL 15+ on the server PC.
2. Run scripts\setup-restaurantai.ps1.
3. Run scripts\check-system.ps1.
4. Run scripts\start-restaurantai.ps1.
5. Open http://127.0.0.1:5001/admin.

No real .env file, database dump, or secret is included in this package.
"@ | Set-Content -Path (Join-Path $packageRoot "README.txt") -Encoding UTF8

Write-Host "RestaurantAI portable package built."
Write-Host "Package: $packageRoot"
