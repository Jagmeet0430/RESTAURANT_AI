$ErrorActionPreference = "Stop"

if (-not (Get-Command Get-Printer -ErrorAction SilentlyContinue)) {
  throw "Get-Printer is not available. Run this script in Windows PowerShell on the RestaurantAI server PC."
}

$defaultPrinterName = $null
try {
  $defaultPrinterName = (Get-CimInstance Win32_Printer | Where-Object { $_.Default } | Select-Object -First 1).Name
} catch {
  $defaultPrinterName = $null
}

Get-Printer |
  Sort-Object Name |
  ForEach-Object {
    [pscustomobject]@{
      Name = $_.Name
      Default = ($_.Name -eq $defaultPrinterName)
      Status = $_.PrinterStatus
      Driver = $_.DriverName
      Port = $_.PortName
    }
  } |
  Format-Table -AutoSize
