$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$startScript = Join-Path $repoRoot "scripts\start-restaurantai.ps1"
$checkScript = Join-Path $repoRoot "scripts\check-system.ps1"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "restaurantai-startup-path-test-$([guid]::NewGuid().ToString('N'))"
$installRoot = Join-Path $tempRoot "RestaurantAI"
$backendDir = Join-Path $installRoot "app\backend\src"

try {
  New-Item -ItemType Directory -Path $backendDir -Force | Out-Null
  New-Item -ItemType File -Path (Join-Path $backendDir "server.js") -Force | Out-Null

  $expectedDefaultConfig = Join-Path ([Environment]::GetFolderPath("CommonApplicationData")) "RestaurantAI\config\.env"
  $expectedExplicitConfig = Join-Path $tempRoot "State\config\.env"

  $directStart = & powershell.exe -NoProfile -ExecutionPolicy Bypass -Command @"
`$env:RESTAURANTAI_SCRIPT_TEST_MODE = '1'
. '$startScript' -InstallRoot '$installRoot'
`$paths = Get-Paths
`$paths.Config
"@
  $directStartConfig = @($directStart)[-1]
  if ($directStartConfig -ne $expectedDefaultConfig) {
    throw "start-restaurantai.ps1 resolved '$directStartConfig', expected '$expectedDefaultConfig'"
  }

  $explicitStart = & powershell.exe -NoProfile -ExecutionPolicy Bypass -Command @"
`$env:RESTAURANTAI_SCRIPT_TEST_MODE = '1'
. '$startScript' -InstallRoot '$installRoot' -StateRoot '$tempRoot\State'
`$paths = Get-Paths
`$paths.Config
"@
  $explicitStartConfig = @($explicitStart)[-1]
  if ($explicitStartConfig -ne $expectedExplicitConfig) {
    throw "start-restaurantai.ps1 explicit StateRoot resolved '$explicitStartConfig', expected '$expectedExplicitConfig'"
  }

  $directCheck = & powershell.exe -NoProfile -ExecutionPolicy Bypass -Command @"
`$env:RESTAURANTAI_SCRIPT_TEST_MODE = '1'
. '$checkScript'
`$paths = Get-AppPaths -Root '$installRoot'
`$paths.Config
"@
  $directCheckConfig = @($directCheck)[-1]
  if ($directCheckConfig -ne $expectedDefaultConfig) {
    throw "check-system.ps1 resolved '$directCheckConfig', expected '$expectedDefaultConfig'"
  }

  Write-Host "Startup path tests passed."
} finally {
  Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
