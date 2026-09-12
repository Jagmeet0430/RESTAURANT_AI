param(
  [int]$TimeoutSeconds = 10,
  [string]$InstallRoot = "",
  [string]$StateRoot = "",
  [switch]$NoMessageBox
)

$ErrorActionPreference = "Stop"

function Show-OperatorMessage {
  param(
    [string]$Message,
    [string]$Title = "RestaurantAI Customer Kiosk"
  )

  Write-Host $Message
  try {
    if ($NoMessageBox) {
      return
    }

    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    [System.Windows.Forms.MessageBox]::Show($Message, $Title, "OK", "Information") | Out-Null
  } catch {
    # Console output is enough when Windows Forms is unavailable.
  }
}

function Get-Paths {
  $root = if ($InstallRoot) {
    [System.IO.Path]::GetFullPath($InstallRoot)
  } else {
    Split-Path -Parent $PSScriptRoot
  }

  $packagedBackend = Join-Path $root "app\backend"
  $isInstalledLayout = Test-Path (Join-Path $packagedBackend "src\server.js")
  $state = if ($StateRoot) {
    [System.IO.Path]::GetFullPath($StateRoot)
  } elseif ($env:RESTAURANTAI_STATE_ROOT) {
    [System.IO.Path]::GetFullPath($env:RESTAURANTAI_STATE_ROOT)
  } elseif ($isInstalledLayout) {
    Join-Path $env:ProgramData "RestaurantAI"
  } else {
    $root
  }

  return @{
    Runtime = Join-Path $state "runtime"
  }
}

function Get-ProcessCommandLine {
  param([int]$ProcessId)

  try {
    $escaped = [string]$ProcessId
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $escaped" -ErrorAction Stop
    return [string]$process.CommandLine
  } catch {
    return ""
  }
}

function Find-KioskEdgeProcessesByProfile {
  param([string]$ExpectedProfilePath)

  try {
    $escapedProfile = $ExpectedProfilePath.Replace("\", "\\")
    Get-CimInstance Win32_Process -Filter "name = 'msedge.exe'" -ErrorAction Stop |
      Where-Object { [string]$_.CommandLine -like "*$escapedProfile*" -or [string]$_.CommandLine -like "*$ExpectedProfilePath*" } |
      ForEach-Object { Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue } |
      Where-Object { $_ }
  } catch {
    @()
  }
}

function Find-KioskEdgeProcessIdsByProfile {
  param([string]$ExpectedProfilePath)

  try {
    Get-CimInstance Win32_Process -Filter "name = 'msedge.exe'" -ErrorAction Stop |
      Where-Object { [string]$_.CommandLine -like "*$ExpectedProfilePath*" } |
      Select-Object -ExpandProperty ProcessId -Unique
  } catch {
    @()
  }
}

function Get-TrackedKioskProcess {
  param([string]$MetadataPath)

  if (-not (Test-Path $MetadataPath)) {
    return $null
  }

  try {
    $metadata = Get-Content $MetadataPath -Raw | ConvertFrom-Json
    if (-not $metadata.profile_path -or -not $metadata.url) {
      return $null
    }

    $profileProcesses = @(Find-KioskEdgeProcessesByProfile $metadata.profile_path)
    if ($profileProcesses.Count -gt 0) {
      return $profileProcesses
    }

    $pid = [int]$metadata.pid
    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if (-not $process -or $process.ProcessName -ne "msedge") {
      Remove-Item -LiteralPath $MetadataPath -Force -ErrorAction SilentlyContinue
      return $null
    }

    $expectedStart = [datetime]$metadata.process_start_time_utc
    $actualStart = $process.StartTime.ToUniversalTime()
    $delta = [Math]::Abs(($actualStart - $expectedStart).TotalSeconds)
    if ($delta -gt 300) {
      return $null
    }

    $commandLine = Get-ProcessCommandLine $pid
    if ($commandLine -and ($commandLine -notlike "*$($metadata.profile_path)*" -or $commandLine -notlike "*customer?kiosk=1*")) {
      return $null
    }

    return $process
  } catch {
    Remove-Item -LiteralPath $MetadataPath -Force -ErrorAction SilentlyContinue
    return $null
  }
}

$paths = Get-Paths
$metadataPath = Join-Path $paths.Runtime "customer-kiosk.json"
$profilePath = Join-Path $paths.Runtime "edge-kiosk-profile"
$processIds = @()

if (-not (Test-Path $metadataPath)) {
  $processIds = @(Find-KioskEdgeProcessIdsByProfile $profilePath)
  if ($processIds.Count -eq 0) {
    Show-OperatorMessage "RestaurantAI Customer Kiosk is not running."
    exit 0
  }

  $processes = @()
} else {
  $processes = @(Get-TrackedKioskProcess $metadataPath | Where-Object { $_ })
}

if ($processIds.Count -eq 0 -and $processes.Count -eq 0) {
  Start-Sleep -Seconds 1
  $processIds = @(Find-KioskEdgeProcessIdsByProfile $profilePath)
  if ($processIds.Count -eq 0) {
    Remove-Item -LiteralPath $metadataPath -Force -ErrorAction SilentlyContinue
    Show-OperatorMessage "Stale Customer Kiosk record removed. No kiosk browser was stopped."
    exit 0
  }
}

if ($processIds.Count -eq 0) {
  $processIds = @(
    $processes |
      ForEach-Object {
        if ($_.Id) {
          [int]$_.Id
        } elseif ($_.ProcessId) {
          [int]$_.ProcessId
        }
      } |
      Select-Object -Unique
  )
}

if ($processIds.Count -eq 0) {
  Remove-Item -LiteralPath $metadataPath -Force -ErrorAction SilentlyContinue
  Show-OperatorMessage "Stale Customer Kiosk record removed. No kiosk browser was stopped."
  exit 0
}

Write-Host "Stopping RestaurantAI Customer Kiosk PID(s): $($processIds -join ', ')..."
foreach ($processId in $processIds) {
  Stop-Process -Id $processId -ErrorAction SilentlyContinue
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 500
  $running = $processIds | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }
  if (-not $running) {
    Remove-Item -LiteralPath $metadataPath -Force -ErrorAction SilentlyContinue
    Write-Host "RestaurantAI Customer Kiosk closed."
    exit 0
  }
}

throw "RestaurantAI Customer Kiosk did not close within $TimeoutSeconds seconds. Metadata remains: $metadataPath"
