param(
  [string]$BaseUrl = "http://127.0.0.1:5001",
  [string]$AdminEmail = $env:SMOKE_ADMIN_EMAIL,
  [string]$AdminPassword = $env:SMOKE_ADMIN_PASSWORD,
  [switch]$AllowWrites
)

$ErrorActionPreference = "Stop"

function Add-Result {
  param(
    [string]$Name,
    [string]$Status,
    [string]$Detail
  )

  [pscustomobject]@{
    Name = $Name
    Status = $Status
    Detail = $Detail
  }
}

function Invoke-Json {
  param(
    [string]$Path,
    [string]$Method = "GET",
    [hashtable]$Headers = @{},
    [object]$Body = $null
  )

  $uri = "$BaseUrl$Path"
  if ($null -eq $Body) {
    return Invoke-RestMethod -Uri $uri -Method $Method -Headers $Headers -TimeoutSec 10
  }

  return Invoke-RestMethod -Uri $uri -Method $Method -Headers $Headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 10) -TimeoutSec 10
}

$results = New-Object System.Collections.Generic.List[object]
$token = $null

try {
  $health = Invoke-Json -Path "/api/health"
  $results.Add((Add-Result "health" ($(if ($health.status -eq "ok") { "PASS" } else { "FAIL" })) "database=$($health.database)"))
} catch {
  $results.Add((Add-Result "health" "FAIL" $_.Exception.Message))
}

try {
  $ready = Invoke-Json -Path "/api/ready"
  $results.Add((Add-Result "ready" ($(if ($ready.status -eq "ready") { "PASS" } else { "FAIL" })) ($ready.checks | ConvertTo-Json -Compress)))
} catch {
  $results.Add((Add-Result "ready" "FAIL" $_.Exception.Message))
}

foreach ($path in @("/admin", "/admin/barcode-pos", "/admin/kitchen", "/customer")) {
  try {
    $response = Invoke-WebRequest -Uri "$BaseUrl$path" -Method Get -TimeoutSec 10 -UseBasicParsing
    $results.Add((Add-Result $path ($(if ($response.StatusCode -eq 200) { "PASS" } else { "FAIL" })) "HTTP $($response.StatusCode)"))
  } catch {
    $results.Add((Add-Result $path "FAIL" $_.Exception.Message))
  }
}

try {
  $menu = Invoke-Json -Path "/api/menu"
  $results.Add((Add-Result "menu" ($(if ($menu.success -eq $true) { "PASS" } else { "FAIL" })) "public menu endpoint"))
} catch {
  $results.Add((Add-Result "menu" "FAIL" $_.Exception.Message))
}

if ($AdminEmail -and $AdminPassword) {
  try {
    $login = Invoke-Json -Path "/api/auth/login" -Method "POST" -Body @{
      email = $AdminEmail
      password = $AdminPassword
    }
    $token = $login.data.token
    $results.Add((Add-Result "admin_login" ($(if ($token) { "PASS" } else { "FAIL" })) $AdminEmail))
  } catch {
    $results.Add((Add-Result "admin_login" "FAIL" $_.Exception.Message))
  }
} else {
  $results.Add((Add-Result "admin_login" "SKIP" "Set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD to include authenticated checks."))
}

if ($token) {
  $headers = @{ Authorization = "Bearer $token" }
  try {
    $diagnostics = Invoke-Json -Path "/api/diagnostics" -Headers $headers
    $results.Add((Add-Result "diagnostics" ($(if ($diagnostics.success -eq $true) { "PASS" } else { "FAIL" })) "status=$($diagnostics.status) backup=$($diagnostics.backup.status)"))
  } catch {
    $results.Add((Add-Result "diagnostics" "FAIL" $_.Exception.Message))
  }

  try {
    $inventory = Invoke-Json -Path "/api/inventory/summary" -Headers $headers
    $results.Add((Add-Result "inventory_auth" ($(if ($inventory.success -eq $true) { "PASS" } else { "FAIL" })) "operator endpoint"))
  } catch {
    $results.Add((Add-Result "inventory_auth" "FAIL" $_.Exception.Message))
  }
}

try {
  Invoke-Json -Path "/api/inventory/summary" | Out-Null
  $results.Add((Add-Result "inventory_requires_auth" "FAIL" "Unauthenticated request succeeded"))
} catch {
  $results.Add((Add-Result "inventory_requires_auth" "PASS" "Unauthenticated request rejected"))
}

if ($AllowWrites -and $token) {
  $results.Add((Add-Result "write_checks" "SKIP" "No generic write smoke is included because menu/product fixtures are installation-specific."))
} else {
  $results.Add((Add-Result "write_checks" "SKIP" "Run with -AllowWrites only after adding pilot-specific fixtures."))
}

$results | Format-Table -AutoSize

if ($results.Status -contains "FAIL") {
  exit 1
}

exit 0
