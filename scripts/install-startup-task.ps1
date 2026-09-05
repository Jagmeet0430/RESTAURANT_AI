param(
  [ValidateSet("Install", "Remove")]
  [string]$Action = "Install",
  [string]$TaskName = "RestaurantAI Server",
  [string]$InstallRoot = "",
  [string]$StateRoot = ""
)

$ErrorActionPreference = "Stop"

$root = if ($InstallRoot) { [System.IO.Path]::GetFullPath($InstallRoot) } else { Split-Path -Parent $PSScriptRoot }
$startScript = Join-Path $root "scripts\start-restaurantai.ps1"
$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$stateArg = if ($StateRoot) { " -StateRoot `"$StateRoot`"" } else { "" }

if ($Action -eq "Remove") {
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($task) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Startup task removed: $TaskName"
  } else {
    Write-Host "Startup task not present: $TaskName"
  }
  exit 0
}

if (-not (Test-Path $startScript)) {
  throw "Start script not found: $startScript"
}

$action = New-ScheduledTaskAction `
  -Execute $powershell `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`" -InstallRoot `"$root`"$stateArg" `
  -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Starts RestaurantAI backend after Windows boots." `
  -Force | Out-Null

Write-Host "Startup task installed: $TaskName"
Write-Host "It can be removed with: scripts\install-startup-task.ps1 -Action Remove"
