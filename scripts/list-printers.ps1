param([switch]$AsJson)
$ErrorActionPreference = "Stop"

if ($AsJson) {
  Add-Type -AssemblyName System.Drawing
  $printers = @(Get-Printer | Sort-Object Name | ForEach-Object {
    $printer = $_
    $settings = New-Object System.Drawing.Printing.PrinterSettings
    $settings.PrinterName = $printer.Name
    $page = $settings.DefaultPageSettings
    [pscustomobject]@{
      name = $printer.Name
      driver = $printer.DriverName
      port = $printer.PortName
      status = [string]$printer.PrinterStatus
      offline = ([string]$printer.PrinterStatus -match 'Offline|Error|NotAvailable|Paused|PaperOut')
      virtual = ($printer.PortName -match '^(PORTPROMPT:|FILE:)$' -or $printer.DriverName -match 'PDF|XPS|OneNote|Fax')
      defaultPaperWidthMm = [Math]::Round($page.PaperSize.Width * 25.4 / 100, 2)
      printableWidthMm = [Math]::Round($page.PrintableArea.Width * 25.4 / 100, 2)
      paperWidthsMm = @($settings.PaperSizes | ForEach-Object { [Math]::Round($_.Width * 25.4 / 100, 2) } | Sort-Object -Unique)
      paperForms = @($settings.PaperSizes | ForEach-Object { [pscustomobject]@{
        name = $_.PaperName; widthMm = [Math]::Round($_.Width * 25.4 / 100, 2); heightMm = [Math]::Round($_.Height * 25.4 / 100, 2)
      } })
    }
  })
  ConvertTo-Json -InputObject $printers -Depth 5 -Compress
  exit 0
}

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
