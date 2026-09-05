param(
  [ValidateSet("Add", "Remove")]
  [string]$Action = "Add",
  [int]$Port = 5001,
  [string]$RuleName = "RestaurantAI Local API"
)

$ErrorActionPreference = "Stop"

$existingRules = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue

if ($Action -eq "Remove") {
  if ($existingRules) {
    $existingRules | Remove-NetFirewallRule
    Write-Host "Firewall rule removed: $RuleName"
  } else {
    Write-Host "Firewall rule not present: $RuleName"
  }
  exit 0
}

if ($Port -eq 5432) {
  throw "Refusing to create a PostgreSQL 5432 firewall rule."
}

if ($existingRules) {
  Write-Host "Firewall rule already exists: $RuleName"
  exit 0
}

New-NetFirewallRule `
  -DisplayName $RuleName `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort $Port `
  -Action Allow `
  -Profile Private | Out-Null

Write-Host "Firewall rule added for Private networks only."
Write-Host "Rule: $RuleName"
Write-Host "Port: $Port"
