param(
  [switch]$OpenBrowser,
  [int]$TimeoutSeconds = 45,
  [string]$InstallRoot = "",
  [string]$StateRoot = "",
  [string]$NodePath = ""
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
  $config = if ($StateRoot -or $env:RESTAURANTAI_STATE_ROOT) {
    Join-Path $state "config\.env"
  } elseif (Test-Path (Join-Path $root "config\.env")) {
    Join-Path $root "config\.env"
  } else {
    Join-Path $backend ".env"
  }

  return @{
    Root = $root
    State = $state
    Backend = $backend
    Config = $config
    Runtime = Join-Path $state "runtime"
    Logs = Join-Path $state "logs"
  }
}

function Read-EnvFile {
  param([string]$Path)

  $values = @{}
  if (Test-Path $Path) {
    foreach ($line in Get-Content $Path) {
      if ($line -match "^\s*([^#][^=]+)=(.*)$") {
        $values[$matches[1].Trim()] = $matches[2]
      }
    }
  }
  return $values
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

function Get-PrivateIpv4 {
  try {
    [System.Net.Dns]::GetHostEntry([System.Net.Dns]::GetHostName()).AddressList |
      Where-Object {
        $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
        $_.IPAddressToString -match "^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)"
      } |
      Select-Object -ExpandProperty IPAddressToString -Unique
  } catch {
    @()
  }
}

function Test-TcpPortInUse {
  param([int]$Port)

  try {
    return [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().
      GetActiveTcpListeners().
      Where({ $_.Port -eq $Port }).
      Count -gt 0
  } catch {
    return $false
  }
}

function Clear-RuntimeState {
  Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $metadataPath -Force -ErrorAction SilentlyContinue
}

function Rotate-LogFile {
  param(
    [string]$Path,
    [int64]$MaxBytes = 5242880,
    [int]$Keep = 5
  )

  if (-not (Test-Path $Path)) {
    return
  }

  $file = Get-Item -LiteralPath $Path
  if ($file.Length -lt $MaxBytes) {
    return
  }

  for ($i = $Keep; $i -ge 1; $i--) {
    $rotated = "$Path.$i"
    if (Test-Path $rotated) {
      if ($i -eq $Keep) {
        Remove-Item -LiteralPath $rotated -Force
      } else {
        Move-Item -LiteralPath $rotated -Destination "$Path.$($i + 1)" -Force
      }
    }
  }

  Move-Item -LiteralPath $Path -Destination "$Path.1" -Force
}

$paths = Get-Paths
$pidPath = Join-Path $paths.Runtime "restaurantai.pid"
$metadataPath = Join-Path $paths.Runtime "restaurantai.process.json"
$outLog = Join-Path $paths.Logs "backend.log"
$errLog = Join-Path $paths.Logs "backend-error.log"
$serverScript = Join-Path $paths.Backend "src\server.js"

New-Item -ItemType Directory -Path $paths.Runtime -Force | Out-Null
New-Item -ItemType Directory -Path $paths.Logs -Force | Out-Null

Rotate-LogFile -Path $outLog
Rotate-LogFile -Path $errLog

if (-not (Test-Path $paths.Config)) {
  throw "Environment file missing: $($paths.Config). Run scripts\setup-restaurantai.ps1 first."
}

if (Test-Path $pidPath) {
  $existingPid = [int](Get-Content $pidPath -Raw)
  $existingProcess = Get-RestaurantProcess $existingPid $metadataPath
  if ($existingProcess) {
    Write-Host "RestaurantAI is already running with PID $existingPid."
    exit 0
  }
  Remove-Item -LiteralPath $pidPath -Force
  Remove-Item -LiteralPath $metadataPath -Force -ErrorAction SilentlyContinue
}

$envValues = Read-EnvFile $paths.Config
$port = if ($envValues.PORT) { $envValues.PORT } else { "5001" }
$hostValue = if ($envValues.HOST) { $envValues.HOST } else { "127.0.0.1" }
if (Test-TcpPortInUse ([int]$port)) {
  throw "Backend port $port is already in use. Stop the existing process or set a different PORT in $($paths.Config)."
}

$env:RESTAURANTAI_ENV_PATH = $paths.Config
$env:RESTAURANTAI_STATE_ROOT = $paths.State
$env:NODE_ENV = if ($envValues.NODE_ENV) { $envValues.NODE_ENV } else { "production" }
$env:RESTAURANTAI_MODE = if ($envValues.RESTAURANTAI_MODE) { $envValues.RESTAURANTAI_MODE } else { "local" }

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
if (-not $nodeExe -or -not (Test-Path $nodeExe)) {
  throw "node.exe not found. Install Node.js before starting RestaurantAI."
}

$process = Start-Process -FilePath $nodeExe -ArgumentList @("`"$serverScript`"") -WorkingDirectory $paths.Backend -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru -WindowStyle Hidden
Set-Content -Path $pidPath -Value $process.Id -Encoding ASCII

$metadata = [ordered]@{
  pid = $process.Id
  process_start_time_utc = $process.StartTime.ToUniversalTime().ToString("o")
  server_script = $serverScript
  backend = $paths.Backend
}
$metadata | ConvertTo-Json -Depth 4 | Set-Content -Path $metadataPath -Encoding UTF8

Write-Host "RestaurantAI starting..."
Write-Host "PID: $($process.Id)"
Write-Host "Logs: $outLog"

$healthUrl = "http://127.0.0.1:$port/api/health"
$readyUrl = "http://127.0.0.1:$port/api/ready"
$ready = $false
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)

while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 1
  try {
    $readiness = Invoke-RestMethod -Uri $readyUrl -Method Get -TimeoutSec 3
    if ($readiness.status -eq "ready") {
      $ready = $true
      break
    }
  } catch {
    if ($process.HasExited) {
      Clear-RuntimeState
      throw "RestaurantAI exited during startup. Check $errLog"
    }
  }
}

if (-not $ready) {
  if (-not $process.HasExited) {
    Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
  }
  Clear-RuntimeState
  throw "RestaurantAI did not become healthy within $TimeoutSeconds seconds. Check $outLog and $errLog"
}

Write-Host "RestaurantAI ready."
Write-Host "Local Admin: http://127.0.0.1:$port/admin"
Write-Host "Local POS: http://127.0.0.1:$port/admin/barcode-pos"
Write-Host "Local Kitchen: http://127.0.0.1:$port/admin/kitchen"
Write-Host "Local Customer: http://127.0.0.1:$port/customer"
Write-Host "Health: $healthUrl"
Write-Host "Ready: $readyUrl"

if ($hostValue -eq "0.0.0.0" -or $hostValue -eq "::") {
  $hostname = [System.Net.Dns]::GetHostName()
  Write-Host "Hostname Admin: http://$hostname`:$port/admin"

  foreach ($ip in Get-PrivateIpv4) {
    Write-Host "LAN Admin: http://$ip`:$port/admin"
    Write-Host "LAN POS: http://$ip`:$port/admin/barcode-pos"
    Write-Host "LAN Kitchen: http://$ip`:$port/admin/kitchen"
    Write-Host "LAN Health: http://$ip`:$port/api/health"
    Write-Host "LAN Ready: http://$ip`:$port/api/ready"
  }
}

if ($OpenBrowser) {
  Start-Process "http://127.0.0.1:$port/admin"
}
