param(
  [string]$PrinterName = "",
  [ValidateSet("80mm", "58mm")]
  [string]$PaperWidth = "58mm",
  [int]$Copies = 1,
  [string]$ConfigPath = ""
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$printScript = Join-Path $scriptRoot "print-receipt.ps1"

$layout = @(
  @{ type = "text"; text = "Mahesh sweets and Bakers"; align = "center"; style = "header" },
  @{ type = "text"; text = "Jaja Chowk, Opp. State Bank of India, Tanda, Punjab-144024, India"; align = "center"; style = "normal" },
  @{ type = "text"; text = "58MM LAYOUT TEST"; align = "center"; style = "bold" },
  @{ type = "rule" },
  @{ type = "text"; text = "Order:"; align = "left"; style = "bold" },
  @{ type = "text"; text = "ORD-1789140268600-VERY-LONG-ORDER-ID"; align = "left"; style = "normal" },
  @{ type = "text"; text = "TOKEN: 4"; align = "center"; style = "token" },
  @{ type = "text"; text = ("Date: " + (Get-Date).ToString("dd/MM/yyyy hh:mm tt")); align = "left"; style = "normal" },
  @{ type = "text"; text = "Type: Dine-in"; align = "left"; style = "normal" },
  @{ type = "text"; text = "Name:"; align = "left"; style = "bold" },
  @{ type = "text"; text = "Long Customer Name Layout Test"; align = "left"; style = "normal" },
  @{ type = "text"; text = "Phone:"; align = "left"; style = "bold" },
  @{ type = "text"; text = "+91 98765 43210"; align = "left"; style = "normal" },
  @{ type = "rule" },
  @{ type = "text"; text = "Cheese Corn Roll with Extra Filling"; align = "left"; style = "bold" },
  @{ type = "pair"; left = "1 x Rs. 90.00"; right = "Rs. 90.00"; style = "normal" },
  @{ type = "spacer"; points = 2 },
  @{ type = "text"; text = "Cheese Patties Roll Special Large"; align = "left"; style = "bold" },
  @{ type = "pair"; left = "1 x Rs. 80.00"; right = "Rs. 80.00"; style = "normal" },
  @{ type = "rule" },
  @{ type = "pair"; left = "Subtotal"; right = "Rs. 170.00"; style = "normal" },
  @{ type = "pair"; left = "GST"; right = "Rs. 9.00"; style = "normal" },
  @{ type = "pair"; left = "Packing"; right = "Rs. 10.00"; style = "normal" },
  @{ type = "rule" },
  @{ type = "pair"; left = "TOTAL"; right = "Rs. 189.00"; style = "total" },
  @{ type = "rule" },
  @{ type = "text"; text = "Payment: Pay at Counter"; align = "left"; style = "normal" },
  @{ type = "text"; text = "Status: Pending"; align = "left"; style = "normal" },
  @{ type = "rule" },
  @{ type = "text"; text = "Thank you!"; align = "center"; style = "bold" },
  @{ type = "text"; text = "Please visit again."; align = "center"; style = "normal" },
  @{ type = "text"; text = "Powered by RestaurantAI"; align = "center"; style = "small" }
)

$jobPath = Join-Path ([System.IO.Path]::GetTempPath()) ("restaurantai-58mm-layout-{0}.json" -f ([guid]::NewGuid().ToString("N")))
$job = @{
  printerName = $PrinterName
  paperWidth = $PaperWidth
  copies = $Copies
  layout = $layout
}
$job | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jobPath -Encoding UTF8

$arguments = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  $printScript,
  "-JobPath",
  $jobPath
)

if ($ConfigPath) {
  $arguments += @("-ConfigPath", $ConfigPath)
}

try {
  & powershell.exe @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "58mm layout test failed with exit code $LASTEXITCODE."
  }
} finally {
  Remove-Item -LiteralPath $jobPath -Force -ErrorAction SilentlyContinue
}
