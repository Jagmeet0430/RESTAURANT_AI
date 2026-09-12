# Thermal Receipt Printing

RestaurantAI can auto-print one thermal receipt after a successful customer kiosk order.

This is kiosk-only for now: `/customer?kiosk=1`. Normal `/customer` and table QR customer ordering do not trigger automatic thermal printing.

## Configuration

Printer config lives on the server PC at:

```text
C:\ProgramData\RestaurantAI\config\printer.json
```

Example:

```json
{
  "enabled": true,
  "printerName": "Your Windows Printer Name",
  "paperWidth": "80mm",
  "copies": 1,
  "autoPrintKioskOrders": true
}
```

Printing is disabled until `enabled` is true and `printerName` matches an installed Windows printer.

## Setup

List installed Windows printers:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\list-printers.ps1
```

Save RestaurantAI printer settings:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\configure-printer.ps1 -PrinterName "EXACT PRINTER NAME"
```

Send a physical test receipt:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\test-printer.ps1
```

## How It Works

After the backend confirms a kiosk order, the kiosk browser sends the confirmed order ID to:

```text
POST /api/receipt-printer/kiosk/orders/:orderId/receipt
```

The backend fetches receipt data server-side from the order/bill tables, renders 80mm thermal text, and runs the local Windows print helper. The browser does not send shell commands, printer paths, receipt totals, or raw receipt text.

Duplicate protection is server-side and records successful prints in:

```text
C:\ProgramData\RestaurantAI\runtime\receipt-print-records.json
```

If a kiosk double-tap, retry, refresh, or rerender asks for the same order receipt again, RestaurantAI skips the duplicate once the order has a successful `printedAt` record.

## Failure Behavior

If the printer is disabled, missing, offline, or unavailable, the order still stays placed. The backend logs the print failure and the kiosk success screen still shows the submitted order snapshot.

Manual receipt viewing/printing from Admin Bills remains available. A backend reprint endpoint is also available for authenticated operators:

```text
POST /api/receipt-printer/orders/:orderId/reprint
```

Manual backend reprints are marked as `DUPLICATE / REPRINT` on the paper receipt.
