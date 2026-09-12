param(
  [int]$Port = 5001,
  [string]$InstallRoot = "",
  [string]$StateRoot = "",
  [string]$EdgePath = "",
  [string]$KioskUrl = "",
  [int]$HealthTimeoutSeconds = 5,
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
    Root = $root
    State = $state
    Runtime = Join-Path $state "runtime"
  }
}

function Find-Edge {
  if ($EdgePath -and (Test-Path $EdgePath)) {
    return [System.IO.Path]::GetFullPath($EdgePath)
  }

  $candidates = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return ""
}

function Get-PreferredScreen {
  Add-Type -AssemblyName System.Windows.Forms
  $screens = [System.Windows.Forms.Screen]::AllScreens
  if (-not $screens -or $screens.Count -eq 0) {
    throw "Windows did not return any display information."
  }

  $screen = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1
  if (-not $screen) {
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
  }

  return $screen
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

function Get-TrackedKioskProcess {
  param(
    [string]$MetadataPath,
    [string]$ExpectedProfilePath
  )

  $profileProcesses = @(Find-KioskEdgeProcessesByProfile $ExpectedProfilePath)
  if ($profileProcesses.Count -gt 0) {
    return $profileProcesses[0]
  }

  if (-not (Test-Path $MetadataPath)) {
    return $null
  }

  try {
    $metadata = Get-Content $MetadataPath -Raw | ConvertFrom-Json
    $pid = [int]$metadata.pid
    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if (-not $process -or $process.ProcessName -ne "msedge") {
      Remove-Item -LiteralPath $MetadataPath -Force -ErrorAction SilentlyContinue
      return $null
    }

    if ($metadata.profile_path -ne $ExpectedProfilePath) {
      return $null
    }

    $expectedStart = [datetime]$metadata.process_start_time_utc
    $actualStart = $process.StartTime.ToUniversalTime()
    $delta = [Math]::Abs(($actualStart - $expectedStart).TotalSeconds)
    if ($delta -gt 300) {
      return $null
    }

    $commandLine = Get-ProcessCommandLine $pid
    if ($commandLine -and ($commandLine -notlike "*$ExpectedProfilePath*" -or $commandLine -notlike "*customer?kiosk=1*")) {
      return $null
    }

    return $process
  } catch {
    Remove-Item -LiteralPath $MetadataPath -Force -ErrorAction SilentlyContinue
    return $null
  }
}

$paths = Get-Paths
$runtimePath = $paths.Runtime
$profilePath = Join-Path $runtimePath "edge-kiosk-profile"
$metadataPath = Join-Path $runtimePath "customer-kiosk.json"
$url = if ($KioskUrl) { $KioskUrl } else { "http://127.0.0.1:$Port/customer?kiosk=1" }
$healthUrl = "http://127.0.0.1:$Port/api/health"

New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
New-Item -ItemType Directory -Path $profilePath -Force | Out-Null

$existing = Get-TrackedKioskProcess $metadataPath $profilePath
if ($existing) {
  Show-OperatorMessage "RestaurantAI Customer Kiosk is already running."
  exit 0
}

try {
  $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec $HealthTimeoutSeconds
  if (-not $health.success -or $health.status -ne "ok") {
    Show-OperatorMessage "RestaurantAI server is not running. Start RestaurantAI first."
    exit 1
  }
} catch {
  Show-OperatorMessage "RestaurantAI server is not running. Start RestaurantAI first."
  exit 1
}

$edge = Find-Edge
if (-not $edge) {
  Show-OperatorMessage "Microsoft Edge was not found. Install Microsoft Edge, then start the RestaurantAI Customer Kiosk again."
  exit 1
}

try {
  $screen = Get-PreferredScreen
} catch {
  Show-OperatorMessage "Windows monitor information could not be read. Check display settings, then start the kiosk again."
  exit 1
}

$bounds = $screen.Bounds
$arguments = @(
  "--kiosk",
  $url,
  "--edge-kiosk-type=fullscreen",
  "--no-first-run",
  "--user-data-dir=$profilePath",
  "--window-position=$($bounds.X),$($bounds.Y)",
  "--window-size=$($bounds.Width),$($bounds.Height)"
)

$process = Start-Process -FilePath $edge -ArgumentList $arguments -PassThru
Start-Sleep -Seconds 1
$profileProcesses = @(Find-KioskEdgeProcessesByProfile $profilePath)
$trackedProcess = if ($profileProcesses.Count -gt 0) { $profileProcesses[0] } else { $process }

$metadata = [ordered]@{
  pid = $trackedProcess.Id
  process_start_time_utc = $trackedProcess.StartTime.ToUniversalTime().ToString("o")
  started_at = (Get-Date).ToString("o")
  url = $url
  edge_path = $edge
  profile_path = $profilePath
  monitor = [ordered]@{
    device_name = $screen.DeviceName
    primary = [bool]$screen.Primary
    x = [int]$bounds.X
    y = [int]$bounds.Y
    width = [int]$bounds.Width
    height = [int]$bounds.Height
  }
}

$metadata | ConvertTo-Json -Depth 4 | Set-Content -Path $metadataPath -Encoding UTF8

Write-Host "RestaurantAI Customer Kiosk started."
Write-Host "URL: $url"
Write-Host "Monitor: $($screen.DeviceName) $($bounds.Width)x$($bounds.Height) at $($bounds.X),$($bounds.Y)"
