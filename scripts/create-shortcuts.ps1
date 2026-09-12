param(
  [int]$Port = 5001,
  [string]$HostName = "127.0.0.1",
  [string]$ShortcutFolder = ([Environment]::GetFolderPath("Desktop")),
  [string]$InstallRoot = "",
  [string]$StateRoot = ""
)

$ErrorActionPreference = "Stop"

function New-Shortcut {
  param(
    [string]$Name,
    [string]$Target,
    [string]$Arguments = "",
    [string]$WorkingDirectory = ""
  )

  $shell = New-Object -ComObject WScript.Shell
  $path = Join-Path $ShortcutFolder "$Name.lnk"
  $shortcut = $shell.CreateShortcut($path)
  $shortcut.TargetPath = $Target
  if ($Arguments) {
    $shortcut.Arguments = $Arguments
  }
  if ($WorkingDirectory) {
    $shortcut.WorkingDirectory = $WorkingDirectory
  }
  $shortcut.Save()
  Write-Host "Created shortcut: $path"
}

$root = if ($InstallRoot) { [System.IO.Path]::GetFullPath($InstallRoot) } else { Split-Path -Parent $PSScriptRoot }
$stateArg = if ($StateRoot) { " -StateRoot `"$StateRoot`"" } else { "" }
$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$startScript = Join-Path $root "scripts\start-restaurantai.ps1"
$backupScript = Join-Path $root "scripts\backup-restaurantai.ps1"
$startKioskScript = Join-Path $root "scripts\start-customer-kiosk.ps1"
$stopKioskScript = Join-Path $root "scripts\stop-customer-kiosk.ps1"

New-Item -ItemType Directory -Path $ShortcutFolder -Force | Out-Null

New-Shortcut "RestaurantAI" $powershell "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`" -InstallRoot `"$root`"$stateArg -OpenBrowser" $root
New-Shortcut "RestaurantAI Admin" "http://$HostName`:$Port/admin"
New-Shortcut "RestaurantAI POS" "http://$HostName`:$Port/admin/barcode-pos"
New-Shortcut "RestaurantAI Kitchen" "http://$HostName`:$Port/admin/kitchen"
New-Shortcut "RestaurantAI Start Server" $powershell "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`" -InstallRoot `"$root`"$stateArg -OpenBrowser" $root
New-Shortcut "RestaurantAI Backup" $powershell "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`" -InstallRoot `"$root`"$stateArg" $root
New-Shortcut "Start Customer Kiosk" $powershell "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startKioskScript`" -InstallRoot `"$root`"$stateArg" $root
New-Shortcut "Close Customer Kiosk" $powershell "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$stopKioskScript`" -InstallRoot `"$root`"$stateArg" $root
