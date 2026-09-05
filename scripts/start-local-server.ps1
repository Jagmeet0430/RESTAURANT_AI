$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $repoRoot "backend"

$env:RESTAURANTAI_MODE = "local"
$env:HOST = "0.0.0.0"
$env:ALLOW_LAN_ORIGINS = "true"

if (-not $env:PORT) {
  $env:PORT = "5001"
}

Write-Host "Starting RestaurantAI backend in LAN mode..."
Write-Host "Mode: $env:RESTAURANTAI_MODE"
Write-Host "Host: $env:HOST"
Write-Host "Port: $env:PORT"
Write-Host "LAN CORS: $env:ALLOW_LAN_ORIGINS"

Push-Location $backendPath
try {
  npm.cmd start
} finally {
  Pop-Location
}
