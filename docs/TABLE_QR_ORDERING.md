# Table QR Ordering

RestaurantAI supports local table QR ordering without an external QR service. Guests scan a table-specific URL such as:

```text
/customer?table=TBL-XXXXXXXX
```

The customer page resolves the token through the backend before allowing an order. Plain `/customer` remains the normal customer website. Kiosk mode remains `/customer?kiosk=1`.

## Admin Tables

Use Admin > Tables to manage QR-enabled restaurant tables.

- Add a table with table number, optional display name, capacity, and active state.
- Deactivate a table to make its QR link stop accepting orders.
- Regenerate a QR token when a printed code should be retired.
- Download or print the QR code locally from the admin browser.
- Review table status: `AVAILABLE`, `ACTIVE ORDER`, `READY`, `PAYMENT PENDING`, or `INACTIVE`.

QR images are generated in the admin frontend with the local `qrcode` package. No external QR image endpoint is used.

## Guest Flow

When a valid active table token is opened:

- The page shows the active table context.
- Order type is locked to `Dine-in`.
- Payment is locked to `Pay at Restaurant Counter`.
- Orders submit with `order_source = table_qr` and the server-resolved table.
- The confirmation shows the daily token/order number, table, items, subtotal, GST, packing, grand total, order type, and payment method.

Invalid, expired, or inactive tokens show a friendly message and do not allow order submission.

## Backend Data

Phase 9 extends existing tables instead of creating a separate QR order system:

- `restaurant_tables` stores table number, display name, capacity, active state, and secure QR token.
- `orders` stores `table_id`, `table_number`, `order_source`, `token_number`, and `token_date`.
- `order_items`, inventory deductions, Kitchen, Admin Orders, and Reports continue to use the existing order pipeline.

The runtime schema helper and migration are additive and preserve existing data. Same-table repeat ordering is allowed because a QR token identifies a table, not a one-time session.

## Operational Notes

- Print one QR per active table from Admin > Tables.
- Keep the installer `AppId` unchanged for upgrades so existing local data remains attached to the same app.
- If a QR is copied outside the restaurant or a table changes, regenerate the table token and reprint the QR.
- Kitchen and Admin Orders display table information when present.
