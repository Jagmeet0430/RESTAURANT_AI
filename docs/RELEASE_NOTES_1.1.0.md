# RestaurantAI 1.1.0 Release Notes

Release date: 2026-09-07

## Highlights

- Added Customer Kiosk Mode at `/customer?kiosk=1`.
- Added a touch-first kiosk flow for welcome, order type, menu/cart, customer details, counter payment, review, and confirmation.
- Added kiosk privacy resets so carts and customer phones are not persisted between customers.
- Added idle warning and automatic kiosk reset behavior.
- Added confirmation receipt snapshots so the displayed order total stays accurate after the cart is cleared.

## Customer Ordering

- Normal `/customer` browsing and ordering continue to work.
- The customer menu now displays availability state and prevents unavailable items from being added.
- Cart clearing now asks for confirmation.
- Duplicate order submit taps are ignored while a request is already in progress.

## Kiosk Ordering

- Kiosk orders use the existing backend order/payment flow.
- Kiosk payment is fixed to `Pay at Restaurant Counter`.
- `Dine-in` is submitted as `dine_in`.
- `Takeaway` is submitted as backend-compatible `pickup` and preserved in special instructions as `Order type: Takeaway`.
- Failed order submission keeps the cart and customer details available for retry.

## Packaging

- Application version bumped to `1.1.0`.
- Installer output is `dist\installer\RestaurantAI-Setup-1.1.0.exe`.
- Installer AppId remains unchanged for upgrade compatibility.

## Documentation

- Added `docs/KIOSK_MODE.md`.
- Updated installer documentation for the `1.1.0` installer artifact.

