param([Parameter(Mandatory=$true)][string]$InstallRoot, [Parameter(Mandatory=$true)][string]$StateRoot)
$ErrorActionPreference = 'Stop'
$config = Join-Path ([IO.Path]::GetFullPath($StateRoot)) 'config\.env'
$script = Join-Path $InstallRoot 'app\backend\scripts\deployment.js'
if (-not (Test-Path -LiteralPath $config)) { throw 'Configuration missing; run setup first.' }
& node $script migrate $config
if ($LASTEXITCODE -ne 0) { throw 'Verified backup / local database migration failed. Do not start the application.' }
