param(
  [int]$Port = 5001,
  [string]$InstallRoot = "",
  [string]$StateRoot = "",
  [int]$HealthTimeoutSeconds = 90,
  [switch]$NoMessageBox
)

$ErrorActionPreference = "Stop"

function Show-OperatorMessage {
  param(
    [string]$Message,
    [string]$Title = "RestaurantAI Startup"
  )

  Write-Host $Message
  try {
    if ($NoMessageBox) {
      return
    }

    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    [System.Windows.Forms.MessageBox]::Show($Message, $Title, "OK", "Information") | Out-Null
  } catch {
    # Console output and log file are enough when Windows Forms is unavailable.
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
    Join-Path ([Environment]::GetFolderPath("CommonApplicationData")) "RestaurantAI"
  } else {
    $root
  }

  return @{
    Root = $root
    State = $state
    Logs = Join-Path $state "logs"
  }
}

function Write-StartupLog {
  param([string]$Message)

  $line = "{0} {1}" -f (Get-Date).ToString("s"), $Message
  Write-Host $line
  Add-Content -LiteralPath $script:LogPath -Value $line -Encoding UTF8
}

function Wait-RestaurantHealth {
  param(
    [string]$HealthUrl,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      $health = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 3
      if ($health.success -eq $true -and $health.status -eq "ok") {
        return $true
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  return $false
}

$paths = Get-Paths
New-Item -ItemType Directory -Path $paths.Logs -Force | Out-Null
$script:LogPath = Join-Path $paths.Logs "server-kiosk-startup.log"

$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$startServerScript = Join-Path $paths.Root "scripts\start-restaurantai.ps1"
$startKioskScript = Join-Path $paths.Root "scripts\start-customer-kiosk.ps1"
$healthUrl = "http://127.0.0.1:$Port/api/health"

try {
  if (-not (Test-Path $startServerScript)) {
    throw "Start script not found: $startServerScript"
  }
  if (-not (Test-Path $startKioskScript)) {
    throw "Kiosk script not found: $startKioskScript"
  }

  Write-StartupLog "Starting RestaurantAI backend."
  $serverArgs = @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "`"$startServerScript`"",
    "-InstallRoot",
    "`"$($paths.Root)`"",
    "-StateRoot",
    "`"$($paths.State)`"",
    "-TimeoutSeconds",
    "$HealthTimeoutSeconds"
  )

  $serverProcess = Start-Process -FilePath $powershell -ArgumentList $serverArgs -Wait -PassThru -WindowStyle Hidden
  Write-StartupLog "Backend start script exited with code $($serverProcess.ExitCode)."

  Write-StartupLog "Waiting for health: $healthUrl"
  if (-not (Wait-RestaurantHealth -HealthUrl $healthUrl -TimeoutSeconds $HealthTimeoutSeconds)) {
    throw "RestaurantAI backend did not become healthy within $HealthTimeoutSeconds seconds."
  }

  Write-StartupLog "Backend health passed. Launching customer kiosk."
  $kioskArgs = @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "`"$startKioskScript`"",
    "-InstallRoot",
    "`"$($paths.Root)`"",
    "-StateRoot",
    "`"$($paths.State)`"",
    "-Port",
    "$Port",
    "-HealthTimeoutSeconds",
    "10"
  )

  if ($NoMessageBox) {
    $kioskArgs += "-NoMessageBox"
  }

  $kioskProcess = Start-Process -FilePath $powershell -ArgumentList $kioskArgs -Wait -PassThru -WindowStyle Hidden
  Write-StartupLog "Kiosk start script exited with code $($kioskProcess.ExitCode)."

  if ($kioskProcess.ExitCode -ne 0) {
    throw "Customer kiosk did not start successfully."
  }
} catch {
  $message = "RestaurantAI could not complete automatic startup. $($_.Exception.Message) Check $script:LogPath for details."
  Write-StartupLog $message
  Show-OperatorMessage $message
  exit 1
}
