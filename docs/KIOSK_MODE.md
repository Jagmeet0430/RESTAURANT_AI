# RestaurantAI Customer Kiosk Mode

RestaurantAI 1.1.0 adds a touch-friendly customer kiosk experience on the existing customer frontend. It is served by the same backend and uses the same public menu, customer, payment, order, bill, inventory, notification, admin, POS, and kitchen flows already used by RestaurantAI.

## Access

Open the kiosk URL on the kiosk browser:

```text
http://localhost:5001/customer?kiosk=1
```

For another device on the same private network, replace `localhost` with the restaurant machine IP:

```text
http://<restaurant-machine-ip>:5001/customer?kiosk=1
```

The normal customer website remains available at:

```text
http://localhost:5001/customer
```

## One-Click Windows Launcher

RestaurantAI includes a Windows launcher for the customer-facing self-ordering kiosk:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\start-customer-kiosk.ps1
```

The launcher opens Microsoft Edge directly at:

```text
http://127.0.0.1:5001/customer?kiosk=1
```

It checks `http://127.0.0.1:5001/api/health` before opening Edge. If the RestaurantAI backend is not running, it shows:

```text
RestaurantAI server is not running. Start RestaurantAI first.
```

Installed Windows builds also provide staff shortcuts:

- `Start Customer Kiosk`
- `Close Customer Kiosk`

These shortcuts are intended for restaurant staff so they do not need to type PowerShell commands.

## Optional Kiosk Autostart

The Windows installer does not automatically start the customer kiosk during installation. Staff should first confirm display wiring, Windows display mode, and which screen is customer-facing, then use the `Start Customer Kiosk` shortcut.

Future deployments can add kiosk autostart as an explicit operator choice, but it should remain disabled by default so a fresh install does not unexpectedly take over a display before setup is complete.

## Dual-Monitor Setup

For a laptop plus customer display:

1. Connect the external display.
2. Press `Windows + P`.
3. Choose `Extend`.
4. Start RestaurantAI.
5. Use `Start Customer Kiosk`.

The launcher uses Windows monitor detection and prefers a non-primary display for the customer kiosk. The laptop or primary display remains available for Admin, POS, and Kitchen use. If Windows reports only one display, the kiosk opens on the primary display.

The launcher reads the selected display bounds from Windows:

- `X`
- `Y`
- `Width`
- `Height`

Those values are passed to Edge with `--window-position` and `--window-size`, so displays on the right, left, above, below, or using negative coordinates are supported.

## Microsoft Edge Kiosk Profile

The launcher looks for Microsoft Edge in both common install locations:

```text
C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
C:\Program Files\Microsoft\Edge\Application\msedge.exe
```

Edge is opened with kiosk/fullscreen arguments and a dedicated RestaurantAI browser profile. In installed mode, mutable kiosk runtime data is kept under:

```text
C:\ProgramData\RestaurantAI\runtime
```

The Edge kiosk profile is stored at:

```text
C:\ProgramData\RestaurantAI\runtime\edge-kiosk-profile
```

This avoids using a staff member's personal Edge profile and allows the close script to identify only the kiosk Edge instance.

## Safe Close Shortcut

`Close Customer Kiosk` runs:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\stop-customer-kiosk.ps1
```

It reads kiosk metadata from:

```text
C:\ProgramData\RestaurantAI\runtime\customer-kiosk.json
```

The metadata stores only safe runtime data such as PID, start time, URL, monitor bounds, Edge path, and kiosk profile path. It does not contain database credentials, admin tokens, customer data, or other secrets.

The close script validates that the tracked process is Microsoft Edge and belongs to the dedicated kiosk profile before stopping it. It does not close all Edge windows and should not affect staff's normal browser sessions. If the metadata is stale after a crash or reboot, the script removes the stale record and exits safely.

## Customer Flow

1. Welcome screen.
2. Select `Dine-in` or `Takeaway`.
3. Browse the live menu, filter by category, search, add items, and edit quantities.
4. Enter customer name and phone number.
5. Confirm `Pay at restaurant counter`.
6. Review the order and place it.
7. Show a receipt-style confirmation with the saved order number, items, and non-zero final total.
8. Automatically reset for the next customer after the confirmation countdown.

## Payment And Kitchen Behavior

Kiosk orders are submitted as `Pay at Restaurant Counter`. They are saved to the same PostgreSQL-backed order flow as customer web orders. The order is pending payment until staff mark it paid in the admin/POS workflow. The existing kitchen gating remains unchanged: unpaid counter orders are held out of kitchen processing until payment is recorded.

`Takeaway` is stored through the backend-compatible `pickup` order type while the kiosk special instructions retain the customer-facing text `Order type: Takeaway`. `Dine-in` is stored as `dine_in`.

## Privacy And Reset Behavior

- Kiosk cart contents are kept in memory only and are not stored in `localStorage`.
- Kiosk customer phone numbers are not stored in `localStorage`.
- The confirmation screen keeps an immutable receipt snapshot so totals do not become zero after the live cart resets.
- `Clear` and `Start over` require confirmation.
- Idle sessions show a warning before resetting.
- The default idle timeout is 120 seconds with a 15 second warning grace period.
- The default post-confirmation reset countdown is 25 seconds.

Optional kiosk timing overrides can be supplied for device testing:

```text
http://localhost:5001/customer?kiosk=1&kioskIdleSeconds=30&kioskIdleGraceSeconds=5&kioskResetSeconds=10
```

## Touch Lockdown

Kiosk mode suppresses the page context menu, right-click menu, long-press callout where the browser allows it, image dragging, and unnecessary text selection. This is scoped only to `/customer?kiosk=1`; the normal customer site and table QR ordering keep normal browser behavior.

Website JavaScript cannot fully control the browser chrome, operating system gestures, address bar, or every vendor-specific long-press menu. For the strongest production lockdown, run the browser in kiosk/fullscreen mode and use a locked-down Windows account for the restaurant device.

## Display Mode

Admin users can configure the kiosk layout from `Admin -> Settings -> Kiosk`.

- `Auto`: chooses landscape when the browser is wider than tall, and portrait when the browser is taller than wide.
- `Landscape`: keeps the wide restaurant-screen layout with categories on the left, menu in the center, and cart on the right.
- `Portrait`: keeps the same kiosk visual style but moves categories into a horizontal scroller, keeps the menu usable in two columns where practical, and places the cart summary in a reachable lower panel.

This setting is stored in the existing restaurant settings record and is exposed through the safe public settings endpoint for kiosk use. It does not rotate the physical Windows display and it is ignored by normal `/customer` and `/customer?table=<token>` modes.

When display mode is `Auto`, the kiosk re-evaluates the resolved layout on browser resize or orientation change. If Admin selected `Landscape` or `Portrait`, that selected mode is honored and the CSS degrades safely for the available viewport.

## Operational Notes

- No admin links are shown in kiosk mode.
- Admin, POS, and Kitchen routes are unchanged.
- If the backend is unreachable, kiosk mode shows a friendly live-menu warning and keeps the customer on the kiosk flow.
- If order submission fails, the cart and customer details remain on screen so the customer or staff can retry.
- Duplicate submit taps are ignored while an order request is already in progress.

## Troubleshooting

`RestaurantAI server is not running. Start RestaurantAI first.`

Start RestaurantAI from the `RestaurantAI` or `RestaurantAI Start Server` shortcut, then start the kiosk again.

`Microsoft Edge was not found.`

Install Microsoft Edge, or confirm that `msedge.exe` exists in one of the standard install folders.

`RestaurantAI Customer Kiosk is already running.`

The launcher found an existing kiosk Edge process using the dedicated profile. Use `Close Customer Kiosk` before starting a new one.

Monitor not detected or kiosk opens on the wrong display:

Use `Windows + P -> Extend`, confirm the customer display is detected in Windows Display Settings, then run `Start Customer Kiosk` again. If only one display is connected, opening on the primary display is expected.

Normal Edge windows should stay open when `Close Customer Kiosk` is used. If the kiosk was opened manually without the RestaurantAI launcher, close that manual Edge window directly.
