$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$env:RESTAURANTAI_SCRIPT_TEST_MODE = '1'
. (Join-Path $root 'scripts\setup-restaurantai.ps1')
$existing = @{ CLOUD_SYNC_ENABLED='true'; CLOUD_SYNC_SECRET='fixture-only-secret'; CUSTOM_SETTING='retained'; JWT_SECRET='fixture-jwt' }
$merged = @(Merge-SetupConfig -Defaults @('CLOUD_SYNC_ENABLED=false','JWT_SECRET=new-fixture','PORT=5001','DB_PASSWORD=fixture#password') -Existing $existing)
foreach ($expected in @('CLOUD_SYNC_ENABLED=true','CLOUD_SYNC_SECRET=fixture-only-secret','CUSTOM_SETTING=retained','JWT_SECRET=fixture-jwt','PORT=5001',"DB_PASSWORD='fixture#password'")) {
  if ($merged -notcontains $expected) { throw 'Configuration preservation/quoting failed (values suppressed).' }
}
Remove-Item Env:\RESTAURANTAI_SCRIPT_TEST_MODE
Write-Host 'PASS setup preserves existing secrets/custom/sync settings and quotes special passwords.'

# Only mocks: never call real Task Scheduler or firewall cmdlets in these tests.
function New-ScheduledTaskAction { param($Execute,$Argument,$WorkingDirectory) return @{ Execute=$Execute; Argument=$Argument } }
function New-ScheduledTaskTrigger { param([switch]$AtStartup) if (-not $AtStartup) { throw 'Expected boot trigger' }; return @{} }
function New-ScheduledTaskSettingsSet { param([switch]$AllowStartIfOnBatteries,[switch]$DontStopIfGoingOnBatteries,[switch]$StartWhenAvailable,$MultipleInstances,$RestartCount,$RestartInterval) if ($RestartCount -ne 3) { throw 'Missing bounded retries' }; return @{} }
function New-ScheduledTaskPrincipal { param($UserId,$LogonType,$RunLevel) if ($UserId -ne 'SYSTEM' -or $LogonType -ne 'ServiceAccount') { throw 'Missing service principal' }; return @{} }
function Register-ScheduledTask { param($TaskName,$Action,$Trigger,$Settings,$Principal,$Description,[switch]$Force) if ($Action.Argument -notmatch '-WindowStyle Hidden') { throw 'Visible boot launcher' }; $global:fixtureRegistered=$true }
& (Join-Path $root 'scripts\install-startup-task.ps1') -InstallRoot $root -StateRoot (Join-Path $root 'temp\unused-fixture-state')
if (-not $global:fixtureRegistered) { throw 'Task registration mock was not reached' }
Write-Host 'PASS startup task uses SYSTEM, boot trigger, hidden launcher, bounded retries (mocked; no task created).'

function Get-NetFirewallRule { param($DisplayName,$ErrorAction) return $null }
function New-NetFirewallRule { param($DisplayName,$Direction,$Protocol,$LocalPort,$Action,$Profile,$RemoteAddress) if ($Profile -ne 'Private' -or $RemoteAddress -ne 'LocalSubnet' -or $LocalPort -ne 5001) { throw 'Unsafe firewall rule' }; $global:fixtureFirewall=$true }
& (Join-Path $root 'scripts\configure-firewall.ps1') -Action Add
if (-not $global:fixtureFirewall) { throw 'Firewall mock not reached' }
$rejected = $false
try { & (Join-Path $root 'scripts\configure-firewall.ps1') -Action Add -Port 5432 } catch { $rejected = $true }
if (-not $rejected) { throw 'Database firewall exposure was not rejected' }
Write-Host 'PASS Private/LocalSubnet API firewall and rejection of 5432 (mocked; no rule created).'

function Get-Command { param($Name,$ErrorAction) return $null }
$rejected = $false
try { & (Join-Path $root 'scripts\check-installer.ps1') } catch { $rejected = $true }
if (-not $rejected) { throw 'Missing Node prerequisite accepted' }
Write-Host 'PASS missing runtime blocks installation (mocked prerequisite).'

function Get-ItemProperty { param($LiteralPath,$ErrorAction) return @{ DisplayVersion='1.4.7' } }
$rejected = $false
try { & (Join-Path $root 'scripts\check-installer.ps1') -TargetVersion '1.4.6' } catch {
  if ($_.Exception.Message -match 'Downgrade blocked') { $rejected = $true }
}
if (-not $rejected) { throw 'Newer installed version was not rejected before runtime checks' }
Write-Host 'PASS downgrade is blocked before installation (mocked registry; no system changes).'
