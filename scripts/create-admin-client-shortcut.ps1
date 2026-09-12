param(
  [string]$ShortcutFolder = ([Environment]::GetFolderPath("Desktop")),
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

New-Item -ItemType Directory -Path $ShortcutFolder -Force | Out-Null

$arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
if ($ConfigRoot) {
  $arguments += " -ConfigRoot `"$ConfigRoot`""
}
if ($UseEdge) {
  $arguments += " -UseEdge"
}

$shell = New-Object -ComObject WScript.Shell
$shortcutPath = Join-Path $ShortcutFolder "RestaurantAI Admin.lnk"
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershell
$shortcut.Arguments = $arguments
$shortcut.WorkingDirectory = $root
$shortcut.Save()

Write-Host "Created shortcut: $shortcutPath"
