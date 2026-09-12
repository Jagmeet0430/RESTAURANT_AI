param(
  [string]$TaskName = "RestaurantAI Admin Client",
  [string]$InstallRoot = "",
  [string]$ConfigRoot = "",
  [switch]$UseEdge
)

$ErrorActionPreference = "Stop"

$root = if ($InstallRoot) {
  [System.IO.Path]::GetFullPath($InstallRoot)
} else {
  Split-Path -Parent $PSScriptRoot
}

$scriptPath = Join-Path $root "scripts\start-admin-client.ps1"
$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path $scriptPath)) {
  throw "Admin client launcher not found: $scriptPath"
}

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
if ($ConfigRoot) {
  $arguments += " -ConfigRoot `"$ConfigRoot`""
}
if ($UseEdge) {
  $arguments += " -UseEdge"
}

$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Opens RestaurantAI Admin from the configured RestaurantAI server after Windows logon." `
  -Force | Out-Null

Write-Host "Admin client autostart task installed: $TaskName"
Write-Host "It can be removed with: scripts\remove-admin-autostart.ps1"
