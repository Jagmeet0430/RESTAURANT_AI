param(
  [string]$JobPath = "",
  [string]$ConfigPath = "",
  [string]$PrinterName = "",
  [ValidateSet("80mm", "58mm")]
  [string]$PaperWidth = "80mm",
  [int]$Copies = 0,
  [string]$Text = ""
)

$ErrorActionPreference = "Stop"

function Get-DefaultConfigPath {
  $programData = $env:ProgramData
  if (-not $programData) {
    $programData = "C:\ProgramData"
  }
  return (Join-Path $programData "RestaurantAI\config\printer.json")
}

function Read-JsonFile {
  param([string]$Path)
  if ($Path -and (Test-Path -LiteralPath $Path)) {
    return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
  }
  return $null
}

if (-not $ConfigPath) {
  $ConfigPath = Get-DefaultConfigPath
}

$config = Read-JsonFile -Path $ConfigPath
$job = Read-JsonFile -Path $JobPath

if (-not $PrinterName) {
  if ($job -and $job.printerName) {
    $PrinterName = [string]$job.printerName
  } elseif ($config -and $config.printerName) {
    $PrinterName = [string]$config.printerName
  }
}

if ($job -and $job.paperWidth) {
  $PaperWidth = [string]$job.paperWidth
} elseif ($config -and $config.paperWidth) {
  $PaperWidth = [string]$config.paperWidth
}

if ($Copies -lt 1) {
  if ($job -and $job.copies) {
    $Copies = [int]$job.copies
  } elseif ($config -and $config.copies) {
    $Copies = [int]$config.copies
  } else {
    $Copies = 1
  }
}

if (-not $Text) {
  if ($job -and $job.text) {
    $Text = [string]$job.text
  } elseif ($job -and $job.lines) {
    $Text = (($job.lines | ForEach-Object { [string]$_ }) -join "`r`n")
  }
}

$layout = @()
if ($job -and $job.layout) {
  $layout = @($job.layout)
}

if (-not $PrinterName) {
  throw "PrinterName is required. Run scripts\configure-printer.ps1 first."
}

if (-not $Text -and $layout.Count -eq 0) {
  throw "Receipt text is empty."
}

if (Get-Command Get-Printer -ErrorAction SilentlyContinue) {
  $printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
  if (-not $printer) {
    throw "Printer '$PrinterName' was not found in Windows printers."
  }
}

Add-Type -AssemblyName System.Drawing

if ($layout.Count -eq 0) {
  $layout = @($Text -split "(`r`n|`n|`r)" | ForEach-Object {
    if ($_ -match "^-{3,}$") {
      [pscustomobject]@{ type = "rule" }
    } else {
      [pscustomobject]@{ type = "text"; text = [string]$_; align = "left"; style = "normal" }
    }
  })
}

function New-ReceiptFont {
  param(
    [string]$Style,
    [string]$ReceiptPaperWidth
  )

  $size = switch ($Style) {
    "header" { if ($ReceiptPaperWidth -eq "58mm") { 9.5 } else { 11.0 } }
    "token" { if ($ReceiptPaperWidth -eq "58mm") { 10.0 } else { 11.0 } }
    "total" { if ($ReceiptPaperWidth -eq "58mm") { 8.2 } else { 9.5 } }
    "small" { if ($ReceiptPaperWidth -eq "58mm") { 6.3 } else { 7.0 } }
    default { if ($ReceiptPaperWidth -eq "58mm") { 7.2 } else { 8.5 } }
  }
  $fontStyle = if ($Style -in @("header", "token", "total", "bold")) {
    [System.Drawing.FontStyle]::Bold
  } else {
    [System.Drawing.FontStyle]::Regular
  }

  try {
    return New-Object System.Drawing.Font("Consolas", $size, $fontStyle)
  } catch {
    return New-Object System.Drawing.Font("Courier New", $size, $fontStyle)
  }
}

function Measure-ReceiptText {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Font]$Font,
    [string]$Value
  )

  if (-not $Value) { return 0.0 }
  return [single]$Graphics.MeasureString($Value, $Font, [int]::MaxValue, [System.Drawing.StringFormat]::GenericTypographic).Width
}

function Split-ReceiptText {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Font]$Font,
    [string]$Value,
    [single]$MaxWidth
  )

  $remaining = [string]$Value
  $result = New-Object System.Collections.Generic.List[string]
  if (-not $remaining) {
    $result.Add("")
    return $result.ToArray()
  }

  while ($remaining.Length -gt 0) {
    if ((Measure-ReceiptText -Graphics $Graphics -Font $Font -Value $remaining) -le $MaxWidth) {
      $result.Add($remaining.TrimEnd())
      break
    }

    $fit = 0
    for ($index = 1; $index -le $remaining.Length; $index++) {
      $candidate = $remaining.Substring(0, $index)
      if ((Measure-ReceiptText -Graphics $Graphics -Font $Font -Value $candidate) -gt $MaxWidth) {
        break
      }
      $fit = $index
    }

    if ($fit -lt 1) { $fit = 1 }
    $breakAt = $remaining.LastIndexOf(" ", [Math]::Min($fit - 1, $remaining.Length - 1))
    if ($breakAt -gt 0) {
      $result.Add($remaining.Substring(0, $breakAt).TrimEnd())
      $remaining = $remaining.Substring($breakAt + 1).TrimStart()
    } else {
      $result.Add($remaining.Substring(0, $fit).TrimEnd())
      $remaining = $remaining.Substring($fit).TrimStart()
    }
  }

  return $result.ToArray()
}

function Get-ReceiptGeometry {
  param(
    [System.Drawing.Printing.PrintDocument]$Document,
    [string]$ReceiptPaperWidth
  )

  $pointsPerHundredthInch = 0.72
  $page = $Document.DefaultPageSettings
  $printable = $page.PrintableArea
  $paperWidth = [single]($page.PaperSize.Width * $pointsPerHundredthInch)
  $printableLeft = [single]([Math]::Max(0, $printable.X * $pointsPerHundredthInch))
  $printableRight = [single]([Math]::Min($paperWidth, ($printable.X + $printable.Width) * $pointsPerHundredthInch))
  $sideMargin = if ($ReceiptPaperWidth -eq "58mm") { [single]5.67 } else { [single]8.5 }
  $topMargin = if ($ReceiptPaperWidth -eq "58mm") { [single]5.67 } else { [single]8.5 }
  $left = [single]($printableLeft + $sideMargin)
  $right = [single]($printableRight - $sideMargin)

  if (($right - $left) -lt 72) {
    $left = $printableLeft
    $right = $printableRight
  }

  return [pscustomobject]@{
    Left = $left
    Right = $right
    Width = [single]($right - $left)
    Top = $topMargin
    BottomMargin = $topMargin
    PrintableWidthMm = [Math]::Round(($printableRight - $printableLeft) * 25.4 / 72, 2)
    ContentWidthMm = [Math]::Round(($right - $left) * 25.4 / 72, 2)
    SideMarginMm = [Math]::Round($sideMargin * 25.4 / 72, 2)
  }
}

$fonts = @{
  normal = New-ReceiptFont -Style "normal" -ReceiptPaperWidth $PaperWidth
  bold = New-ReceiptFont -Style "bold" -ReceiptPaperWidth $PaperWidth
  header = New-ReceiptFont -Style "header" -ReceiptPaperWidth $PaperWidth
  token = New-ReceiptFont -Style "token" -ReceiptPaperWidth $PaperWidth
  total = New-ReceiptFont -Style "total" -ReceiptPaperWidth $PaperWidth
  small = New-ReceiptFont -Style "small" -ReceiptPaperWidth $PaperWidth
}

function Get-LayoutHeight {
  param(
    [System.Drawing.Graphics]$Graphics,
    [single]$ContentWidth
  )

  $height = [single]0
  foreach ($entry in $layout) {
    $type = [string]$entry.type
    if ($type -eq "spacer") {
      $height += [single]([Math]::Max([double]$entry.points, 1))
      continue
    }
    if ($type -eq "rule") {
      $height += [single]6
      continue
    }

    $style = if ($entry.style -and $fonts.ContainsKey([string]$entry.style)) { [string]$entry.style } else { "normal" }
    $font = $fonts[$style]
    $lineHeight = [single]($font.GetHeight($Graphics) + 1.4)

    if ($type -eq "pair") {
      $leftText = [string]$entry.left
      $rightText = [string]$entry.right
      $leftWidth = Measure-ReceiptText -Graphics $Graphics -Font $font -Value $leftText
      $rightWidth = Measure-ReceiptText -Graphics $Graphics -Font $font -Value $rightText
      if (($leftWidth + $rightWidth + 6) -le $ContentWidth) {
        $height += $lineHeight
      } else {
        $height += ((Split-ReceiptText -Graphics $Graphics -Font $font -Value $leftText -MaxWidth $ContentWidth).Count + 1) * $lineHeight
      }
      continue
    }

    $height += (Split-ReceiptText -Graphics $Graphics -Font $font -Value ([string]$entry.text) -MaxWidth $ContentWidth).Count * $lineHeight
  }

  return [single]$height
}

function Draw-ReceiptLayout {
  param(
    [System.Drawing.Graphics]$Graphics,
    [pscustomobject]$Geometry
  )

  $Graphics.PageUnit = [System.Drawing.GraphicsUnit]::Point
  $brush = [System.Drawing.Brushes]::Black
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 0.6)
  $y = [single]$Geometry.Top

  try {
    foreach ($entry in $layout) {
      $type = [string]$entry.type
      if ($type -eq "spacer") {
        $y += [single]([Math]::Max([double]$entry.points, 1))
        continue
      }
      if ($type -eq "rule") {
        $y += 2
        $Graphics.DrawLine($pen, $Geometry.Left, $y, $Geometry.Right, $y)
        $y += 4
        continue
      }

      $style = if ($entry.style -and $fonts.ContainsKey([string]$entry.style)) { [string]$entry.style } else { "normal" }
      $font = $fonts[$style]
      $lineHeight = [single]($font.GetHeight($Graphics) + 1.4)

      if ($type -eq "pair") {
        $leftText = [string]$entry.left
        $rightText = [string]$entry.right
        $leftWidth = Measure-ReceiptText -Graphics $Graphics -Font $font -Value $leftText
        $rightWidth = Measure-ReceiptText -Graphics $Graphics -Font $font -Value $rightText
        if (($leftWidth + $rightWidth + 6) -le $Geometry.Width) {
          $Graphics.DrawString($leftText, $font, $brush, $Geometry.Left, $y, [System.Drawing.StringFormat]::GenericTypographic)
          $Graphics.DrawString($rightText, $font, $brush, $Geometry.Right - $rightWidth, $y, [System.Drawing.StringFormat]::GenericTypographic)
          $y += $lineHeight
        } else {
          foreach ($line in (Split-ReceiptText -Graphics $Graphics -Font $font -Value $leftText -MaxWidth $Geometry.Width)) {
            $Graphics.DrawString($line, $font, $brush, $Geometry.Left, $y, [System.Drawing.StringFormat]::GenericTypographic)
            $y += $lineHeight
          }
          $rightWidth = Measure-ReceiptText -Graphics $Graphics -Font $font -Value $rightText
          $Graphics.DrawString($rightText, $font, $brush, $Geometry.Right - $rightWidth, $y, [System.Drawing.StringFormat]::GenericTypographic)
          $y += $lineHeight
        }
        continue
      }

      foreach ($line in (Split-ReceiptText -Graphics $Graphics -Font $font -Value ([string]$entry.text) -MaxWidth $Geometry.Width)) {
        $lineWidth = Measure-ReceiptText -Graphics $Graphics -Font $font -Value $line
        $x = switch ([string]$entry.align) {
          "center" { [single]($Geometry.Left + [Math]::Max(0, ($Geometry.Width - $lineWidth) / 2)) }
          "right" { [single]($Geometry.Right - $lineWidth) }
          default { [single]$Geometry.Left }
        }
        $Graphics.DrawString($line, $font, $brush, $x, $y, [System.Drawing.StringFormat]::GenericTypographic)
        $y += $lineHeight
      }
    }
  } finally {
    $pen.Dispose()
  }
}

$copiesToPrint = [Math]::Min([Math]::Max($Copies, 1), 5)
$selectedPaperName = ""
$selectedHeightMm = 0

for ($copy = 1; $copy -le $copiesToPrint; $copy++) {
  $document = New-Object System.Drawing.Printing.PrintDocument
  $document.PrinterSettings.PrinterName = $PrinterName
  $document.DocumentName = "RestaurantAI receipt"
  $document.PrintController = New-Object System.Drawing.Printing.StandardPrintController
  $document.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)

  $geometry = Get-ReceiptGeometry -Document $document -ReceiptPaperWidth $PaperWidth
  $measurementBitmap = New-Object System.Drawing.Bitmap(1, 1)
  $measurementGraphics = [System.Drawing.Graphics]::FromImage($measurementBitmap)
  $measurementGraphics.PageUnit = [System.Drawing.GraphicsUnit]::Point
  $contentHeight = Get-LayoutHeight -Graphics $measurementGraphics -ContentWidth $geometry.Width
  $measurementGraphics.Dispose()
  $measurementBitmap.Dispose()

  $heightPoints = [single]($geometry.Top + $contentHeight + $geometry.BottomMargin + 4)
  $requiredPaperHeight = [Math]::Max([int][Math]::Ceiling($heightPoints / 0.72), 200)
  $defaultPaperWidth = $document.DefaultPageSettings.PaperSize.Width
  $supportedPaper = @($document.PrinterSettings.PaperSizes) |
    Where-Object { $_.Width -eq $defaultPaperWidth -and $_.Height -ge $requiredPaperHeight } |
    Sort-Object Height |
    Select-Object -First 1
  if (-not $supportedPaper) {
    $supportedPaper = @($document.PrinterSettings.PaperSizes) |
      Where-Object { $_.Width -eq $defaultPaperWidth } |
      Sort-Object Height -Descending |
      Select-Object -First 1
  }
  if ($supportedPaper) {
    $document.DefaultPageSettings.PaperSize = $supportedPaper
  }
  $selectedPaperName = $document.DefaultPageSettings.PaperSize.PaperName
  $selectedHeightMm = [Math]::Round($document.DefaultPageSettings.PaperSize.Height * 25.4 / 100, 1)

  $document.add_PrintPage({
    param($sender, $eventArgs)
    Draw-ReceiptLayout -Graphics $eventArgs.Graphics -Geometry $geometry
    $eventArgs.HasMorePages = $false
  })

  $document.Print()
  $document.Dispose()
}

foreach ($font in $fonts.Values) {
  $font.Dispose()
}

Write-Host "Receipt sent to printer '$PrinterName' ($PaperWidth, printable: $($geometry.PrintableWidthMm)mm, content: $($geometry.ContentWidthMm)mm, margins: $($geometry.SideMarginMm)mm, paper: $selectedPaperName, roll length: $selectedHeightMm mm, copies: $copiesToPrint)."
