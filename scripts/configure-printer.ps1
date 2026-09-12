param(
  [Parameter(Mandatory = $true)]
  [string]$PrinterName,
  [ValidateSet("80mm", "58mm")]
  [string]$PaperWidth = "80mm",
  [ValidateRange(1, 5)]
  [int]$Copies = 1,
  [bool]$Enabled = $true,
  [bool]$AutoPrintKioskOrders = $true,
  [string]$ConfigPath = "",
  [switch]$SkipPrinterCheck
)

$ErrorActionPreference = "Stop"

if (-not $ConfigPath) {
  $programData = $env:ProgramData
  if (-not $programData) {
    $programData = "C:\ProgramData"
  }
  $ConfigPath = Join-Path $programData "RestaurantAI\config\printer.json"
}

if (-not $SkipPrinterCheck -and (Get-Command Get-Printer -ErrorAction SilentlyContinue)) {
  $printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
  if (-not $printer) {
    throw "Printer '$PrinterName' was not found. Run scripts\list-printers.ps1 and copy the exact Name."
  }
}

$config = [ordered]@{
  enabled = $Enabled
  printerName = $PrinterName
  paperWidth = $PaperWidth
  copies = $Copies
  autoPrintKioskOrders = $AutoPrintKioskOrders
}

New-Item -ItemType Directory -Path (Split-Path -Parent $ConfigPath) -Force | Out-Null
try {
  $config | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $ConfigPath -Encoding UTF8
} catch {
  throw "Could not write $ConfigPath. Run PowerShell as Administrator or grant write permission to C:\ProgramData\RestaurantAI\config, then run this command again. $($_.Exception.Message)"
}

Write-Host "RestaurantAI printer config saved:"
Write-Host $ConfigPath
Write-Host ""
Write-Host "Run scripts\test-printer.ps1 to send a test receipt."
