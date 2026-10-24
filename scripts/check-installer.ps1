param([string]$PostgresBinDir = "", [string]$TargetVersion = "",
  [switch]$CheckStopped, [string]$InstallRoot = "", [string]$StateRoot = "")
$ErrorActionPreference = "Stop"
if ($CheckStopped) {
  if (-not $InstallRoot -or -not $StateRoot) { throw 'Explicit installation and state paths required.' }
  $config = Join-Path $StateRoot 'config\.env'
  $package = Join-Path $InstallRoot 'app\backend\package.json'
  # stdout is a machine-readable value; console.log(number) can add ANSI colors.
  $portOutput = @(& node -e "const fs=require('fs');const req=require('module').createRequire(process.argv[1]);const env=req('dotenv').parse(fs.readFileSync(process.argv[2]));const raw=env.PORT===undefined?'5001':env.PORT;if(raw.length<1||raw.length>5||/[^0-9]/.test(raw))process.exit(1);const port=Number(raw);if(port<1||port>65535)process.exit(1);process.stdout.write(String(port));" $package $config)
  if ($LASTEXITCODE -ne 0 -or $portOutput.Count -ne 1) { throw 'Cannot determine configured backend port safely.' }
  [int]$port = 0
  if ($portOutput[0] -cnotmatch '\A[0-9]{1,5}\z' -or -not [int]::TryParse($portOutput[0], [ref]$port) -or $port -lt 1 -or $port -gt 65535) {
    throw 'Cannot determine configured backend port safely.'
  }
  if ([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Where({ $_.Port -eq $port }).Count -gt 0) {
    throw "Backend port $port is still active. Upgrade aborted before file replacement; identify its owner without terminating unrelated processes."
  }
  Write-Host 'Configured backend port is stopped; replacement may proceed.'
  return
}
if ($TargetVersion) {
  $appKey = '{9A7811B0-8392-4C65-8A3E-5D7F9F86E35A}_is1'
  foreach ($base in @('HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
      'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
      'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall')) {
    $installed = Get-ItemProperty -LiteralPath "$base\$appKey" -ErrorAction SilentlyContinue
    if ($installed) {
      if (-not $installed.DisplayVersion) { throw 'Installed version is unknown; verify it before upgrading.' }
      if ([version]$installed.DisplayVersion -gt [version]$TargetVersion) {
        throw "Downgrade blocked: installed $($installed.DisplayVersion), installer $TargetVersion."
      }
    }
  }
}
if (-not [Environment]::Is64BitOperatingSystem) { throw "RestaurantAI requires Windows x64." }
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { throw "Install Node.js 22+ x64, reopen Setup, and try again." }
& $node.Source -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 && process.arch === 'x64' ? 0 : 1)"
if ($LASTEXITCODE -ne 0) { throw "RestaurantAI requires Node.js 22+ x64." }
$dirs = @($PostgresBinDir, 'C:\Program Files\PostgreSQL\18\bin') + ($env:PATH -split ';')
foreach ($tool in @('psql.exe', 'pg_dump.exe', 'pg_restore.exe', 'createdb.exe')) {
  $found = $false
  foreach ($dir in $dirs) {
    if (-not $dir) { continue }
    $candidate = Join-Path $dir $tool
    if (Test-Path -LiteralPath $candidate) {
      $version = & $candidate --version
      if ($LASTEXITCODE -eq 0 -and $version -match 'PostgreSQL\) (\d+)' -and [int]$matches[1] -ge 18) { $found = $true; break }
    }
  }
  if (-not $found) { throw "PostgreSQL 18+ command-line tool missing: $tool. Install PostgreSQL explicitly before Setup." }
}
Write-Host 'Installer prerequisites passed. Database connectivity is checked during configuration/upgrade.'
