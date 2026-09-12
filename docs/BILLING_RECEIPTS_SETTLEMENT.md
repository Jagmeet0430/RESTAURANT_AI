# Billing, Receipts, and Settlement

RestaurantAI uses one billing layer for restaurant orders and POS counter sales while keeping the source records separate.

## Generate Bill

- Customer, kiosk, table QR, staff, and admin orders are stored in `orders`.
- POS/counter sales are stored in `counter_sales` and `counter_sale_items`.
- Order bills use server-generated `BILL-YYYY-000001` numbers.
- POS bills use server-generated `POS-YYYY-000001` numbers.
- Bill numbers are generated in PostgreSQL and are separate from internal database IDs.
- Bill rows snapshot restaurant details, item lines, tax, packing, discounts, payment method, payment status, and totals.

Paid bill snapshots are preserved for reprint. Current menu price changes do not rebuild old paid receipts.

## Table Settlement

Admin -> Bills shows tables with active unpaid orders and a total due.

Use Settle Table to:

- Review unpaid non-cancelled orders for the table.
- Select Cash, UPI, Card, or Pay at Counter.
- Confirm the expected total.
- Mark all applicable table orders paid in one database transaction.

Paid, cancelled, and historical unrelated orders are not included.

## Individual Payment

Use Pay Order from Admin -> Bills for a single unpaid order.

The payment flow is:

```text
Generate Bill -> Select payment method -> Confirm amount -> Mark Paid -> Print/Reprint Receipt
```

Payment status and kitchen status are independent. Kitchen Ready with payment Unpaid is valid.

## Payment Methods

Offline-safe methods:

- Cash
- UPI
- Card
- Pay at Counter

Razorpay and cloud payments remain optional where already configured. Offline billing does not require internet.

## Duplicate Payment Protection

Restaurant order settlement locks the order row in PostgreSQL before marking paid. Table settlement locks all unpaid table orders inside the same transaction. Repeated Mark Paid requests return the existing paid state instead of creating another paid payment.

POS checkout uses `Idempotency-Key` with a unique counter-sale guard.

## Split Payments

Cash plus UPI split settlement is a future enhancement. The current settlement model records one payment method for the full bill or table amount, which keeps reports and refunds straightforward.

## Receipt Printing

Admin receipt route:

```text
/admin/receipt/order/:orderId
/admin/receipt/counter_sale/:saleId
/admin/receipt/test/preview
```

Receipts use:

- Restaurant name
- Address
- Phone
- GSTIN when configured
- Footer text
- Receipt width setting

Use Admin -> Settings -> Print Test Receipt to open a test receipt without creating a sale.

## 80mm Setup

80mm is the default receipt width.

1. Install the printer's Windows driver.
2. Open Admin -> Settings.
3. Set Receipt width to 80mm.
4. Use Print Test Receipt.
5. In the browser print dialog, choose the thermal printer and matching paper size.

## 58mm Setup

58mm is supported as a compact layout.

1. Open Admin -> Settings.
2. Set Receipt width to 58mm.
3. Use Print Test Receipt.
4. Choose the 58mm printer/paper in the browser print dialog.

## Reprint

Paid bills show Reprint from Admin -> Bills. Reprint opens the saved receipt snapshot and does not create a new bill, sale, or payment.

## POS Receipts

After POS checkout, RestaurantAI creates the counter sale, records a paid payment row, and opens the same receipt system used by restaurant orders. POS sales are not converted into restaurant orders.

## End of Day

Admin -> End of Day shows:

- Cash collected
- UPI collected
- Card collected
- Total paid
- Unpaid amount
- Refunds, when present in payment data
- POS revenue
- Restaurant-order revenue
- Combined total

Close Day stores a settlement snapshot for the selected business date. It does not lock the restaurant from continuing to operate.

## Cash Difference

End of Day includes:

```text
Expected Cash
Actual Cash
Difference
```

The difference is saved for review only. It does not automatically change sales, payments, or inventory records.

## Settlement History

Previous Close Day snapshots are shown in Admin -> End of Day and remain available after backend restart.

## Offline Use

Billing, manual Cash/UPI/Card recording, receipt display, browser printing, reprint, and End of Day close work on the local server without internet.

## Troubleshooting

- If the receipt is the wrong width, verify Admin -> Settings -> Receipt width and the browser print paper size.
- If nothing prints, confirm the Windows printer driver is installed and can print a Windows test page.
- If a payment cannot be marked paid, refresh Bills and check whether another cashier already settled it.
- If table settlement says no unpaid orders were found, verify the table has non-cancelled unpaid orders.
- If EOD totals seem unexpected, compare Admin -> Bills filters with Admin -> Reports for the same business date.

## Not Included Yet

- Raw ESC/POS printing.
- Cloud printer integration.
- Split payments.
- Partial payments.
- Automatic accounting export.
