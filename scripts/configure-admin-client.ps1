param(
  [Parameter(Mandatory = $true)]
  [string]$ServerUrl,
  [string]$ConfigRoot = ""
)

$ErrorActionPreference = "Stop"

function Get-ConfigRoot {
  if ($ConfigRoot) {
    return [System.IO.Path]::GetFullPath($ConfigRoot)
  }

  return Join-Path ([Environment]::GetFolderPath("CommonApplicationData")) "RestaurantAI-AdminClient"
}

function Normalize-ServerUrl {
  param([string]$Value)

  $clean = ([string]$Value).Trim().TrimEnd("/")
  if (-not $clean) {
    throw "ServerUrl is required. Example: http://192.168.1.50:5001"
  }

  if ($clean.EndsWith("/admin")) {
    $clean = $clean.Substring(0, $clean.Length - 6)
  }
  if ($clean.EndsWith("/api")) {
    $clean = $clean.Substring(0, $clean.Length - 4)
  }

  $uri = [System.Uri]$clean
  if ($uri.Scheme -notin @("http", "https")) {
    throw "ServerUrl must start with http:// or https://"
  }
  if (-not $uri.Host) {
    throw "ServerUrl must include the RestaurantAI server host or IP address."
  }

  return $clean
}

$root = Get-ConfigRoot
$normalizedServerUrl = Normalize-ServerUrl $ServerUrl
$configPath = Join-Path $root "config.json"

New-Item -ItemType Directory -Path $root -Force | Out-Null

$config = [ordered]@{
  serverUrl = $normalizedServerUrl
  updatedAt = (Get-Date).ToString("o")
}

$config | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $configPath -Encoding UTF8

Write-Host "RestaurantAI Admin client configured."
Write-Host "Config: $configPath"
Write-Host "Admin URL: $normalizedServerUrl/admin"
