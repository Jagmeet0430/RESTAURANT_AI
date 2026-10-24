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

$taskAction = New-ScheduledTaskAction `
  -Execute $powershell `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`" -InstallRoot `"$root`"$stateArg" `
  -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $taskAction `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Starts RestaurantAI backend after Windows boots." `
  -Force | Out-Null

Write-Host "Startup task installed: $TaskName"
Write-Host "It can be removed with: scripts\install-startup-task.ps1 -Action Remove"
