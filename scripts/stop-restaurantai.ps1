param(
  [int]$TimeoutSeconds = 15,
  [string]$InstallRoot = "",
  [string]$StateRoot = ""
)

$ErrorActionPreference = "Stop"

function Get-Paths {
  $root = if ($InstallRoot) { [System.IO.Path]::GetFullPath($InstallRoot) } else { Split-Path -Parent $PSScriptRoot }
  $state = if ($StateRoot) {
    [System.IO.Path]::GetFullPath($StateRoot)
  } elseif ($env:RESTAURANTAI_STATE_ROOT) {
    [System.IO.Path]::GetFullPath($env:RESTAURANTAI_STATE_ROOT)
  } else {
    $root
  }

  $packagedBackend = Join-Path $root "app\backend"
  $backend = if (Test-Path (Join-Path $packagedBackend "src\server.js")) { $packagedBackend } else { Join-Path $root "backend" }

  return @{
    Backend = $backend
    Runtime = Join-Path $state "runtime"
  }
}

function Get-RestaurantProcess {
  param([int]$ProcessId, [string]$MetadataPath)

  if (-not $ProcessId) {
    return $null
  }

  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if (-not $process) {
    return $null
  }

  if ($process.ProcessName -ne "node") {
    return $null
  }

  if (-not (Test-Path $MetadataPath)) {
    return $null
  }

  try {
    $metadata = Get-Content $MetadataPath -Raw | ConvertFrom-Json
    if ($metadata.pid -ne $ProcessId -or -not $metadata.server_script) {
      return $null
    }

    $expectedStart = [datetime]$metadata.process_start_time_utc
    $actualStart = $process.StartTime.ToUniversalTime()
    $delta = [Math]::Abs(($actualStart - $expectedStart).TotalSeconds)

    if ($delta -lt 300) {
      return $process
    }

    return $process
  } catch {
    try {
      if ($metadata.pid -eq $ProcessId -and $metadata.server_script) {
        return $process
      }
    } catch {
      return $null
    }
  }

  return $null
}

$paths = Get-Paths
$pidPath = Join-Path $paths.Runtime "restaurantai.pid"
$metadataPath = Join-Path $paths.Runtime "restaurantai.process.json"

if (-not (Test-Path $pidPath)) {
  Write-Host "RestaurantAI PID file not found. Nothing stopped."
  exit 0
}

$restaurantPid = [int](Get-Content $pidPath -Raw)
$restaurantProcess = Get-RestaurantProcess $restaurantPid $metadataPath

if (-not $restaurantProcess) {
  Remove-Item -LiteralPath $pidPath -Force
  Remove-Item -LiteralPath $metadataPath -Force -ErrorAction SilentlyContinue
  Write-Host "Stale PID file removed. No matching RestaurantAI process was stopped."
  exit 0
}

Write-Host "Stopping RestaurantAI PID $restaurantPid..."
Stop-Process -Id $restaurantPid

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 500
  if (-not (Get-Process -Id $restaurantPid -ErrorAction SilentlyContinue)) {
    Remove-Item -LiteralPath $pidPath -Force
    Remove-Item -LiteralPath $metadataPath -Force -ErrorAction SilentlyContinue
    Write-Host "RestaurantAI stopped."
    exit 0
  }
}

throw "RestaurantAI did not stop within $TimeoutSeconds seconds. PID file remains: $pidPath"
