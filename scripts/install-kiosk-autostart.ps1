param(
  [string]$TaskName = "RestaurantAI Server and Customer Kiosk",
  [string]$InstallRoot = "",
  [string]$StateRoot = "",
  [int]$Port = 5001
)

$ErrorActionPreference = "Stop"

$root = if ($InstallRoot) {
  [System.IO.Path]::GetFullPath($InstallRoot)
} else {
  Split-Path -Parent $PSScriptRoot
}

$state = if ($StateRoot) {
  [System.IO.Path]::GetFullPath($StateRoot)
} else {
  Join-Path ([Environment]::GetFolderPath("CommonApplicationData")) "RestaurantAI"
}

$launcher = Join-Path $root "scripts\start-server-and-kiosk.ps1"
$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path $launcher)) {
  throw "Startup launcher not found: $launcher"
}

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`" -InstallRoot `"$root`" -StateRoot `"$state`" -Port $Port"
$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Starts RestaurantAI backend, waits for health, then opens the customer kiosk after Windows logon." `
  -Force | Out-Null

Write-Host "Kiosk autostart task installed: $TaskName"
Write-Host "It can be removed with: scripts\remove-kiosk-autostart.ps1"
