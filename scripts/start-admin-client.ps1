param(
  [string]$ServerUrl = "",
  [string]$ConfigRoot = "",
  [int]$TimeoutSeconds = 10,
  [switch]$UseEdge,
  [switch]$CheckOnly,
  [switch]$NoMessageBox
)

$ErrorActionPreference = "Stop"

function Show-OperatorMessage {
  param(
    [string]$Message,
    [string]$Title = "RestaurantAI Admin"
  )

  Write-Host $Message
  try {
    if ($NoMessageBox) {
      return
    }

    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    [System.Windows.Forms.MessageBox]::Show($Message, $Title, "OK", "Warning") | Out-Null
  } catch {
    # Console output is enough when Windows Forms is unavailable.
  }
}

function Get-ConfigRoot {
  if ($ConfigRoot) {
    return [System.IO.Path]::GetFullPath($ConfigRoot)
  }

  return Join-Path ([Environment]::GetFolderPath("CommonApplicationData")) "RestaurantAI-AdminClient"
}

function Normalize-ServerUrl {
  param([string]$Value)

  $clean = ([string]$Value).Trim().TrimEnd("/")
  if ($clean.EndsWith("/admin")) {
    $clean = $clean.Substring(0, $clean.Length - 6)
  }
  if ($clean.EndsWith("/api")) {
    $clean = $clean.Substring(0, $clean.Length - 4)
  }

  if (-not $clean) {
    throw "Server URL is not configured."
  }

  $uri = [System.Uri]$clean
  if ($uri.Scheme -notin @("http", "https")) {
    throw "Server URL must start with http:// or https://"
  }

  return $clean
}

function Read-ConfiguredServerUrl {
  $configPath = Join-Path (Get-ConfigRoot) "config.json"
  if (-not (Test-Path $configPath)) {
    throw "Admin client config was not found at $configPath. Run scripts\configure-admin-client.ps1 -ServerUrl http://SERVER-IP:5001 first."
  }

  $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  return [string]$config.serverUrl
}

function Test-ServerHealth {
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

function Find-Edge {
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

try {
  $rawServerUrl = if ($ServerUrl) { $ServerUrl } else { Read-ConfiguredServerUrl }
  $server = Normalize-ServerUrl $rawServerUrl
  $healthUrl = "$server/api/health"
  $adminUrl = "$server/admin"

  if (-not (Test-ServerHealth -HealthUrl $healthUrl -TimeoutSeconds $TimeoutSeconds)) {
    Show-OperatorMessage "RestaurantAI server is unavailable.`r`nCheck that the main restaurant laptop is switched on and connected to the same network."
    exit 1
  }

  if ($CheckOnly) {
    Write-Host "RestaurantAI server is available: $server"
    exit 0
  }

  if ($UseEdge) {
    $edge = Find-Edge
    if ($edge) {
      Start-Process -FilePath $edge -ArgumentList @($adminUrl)
      exit 0
    }
  }

  Start-Process $adminUrl
} catch {
  Show-OperatorMessage "RestaurantAI server is unavailable.`r`nCheck that the main restaurant laptop is switched on and connected to the same network.`r`n`r`n$($_.Exception.Message)"
  exit 1
}
