# WhatsApp OTP And Order Tracking

## Migration

Run `backend/database/migrations/009_whatsapp_otp_order_tracking.sql` against PostgreSQL. The backend also has runtime schema guards for the same tables and columns.

## Environment

No new packages are required. Copy `backend/.env.example` and set:

```env
WHATSAPP_PROVIDER=meta
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
OTP_SECRET=
FRONTEND_URL=http://localhost:5001/customer
RESTAURANT_PHONE=
```

For Twilio use:

```env
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

Use `WHATSAPP_PROVIDER=mock` only for local development. It logs mock sends and does not contact WhatsApp.

## Meta WhatsApp Cloud API

1. Create or select a Meta app with WhatsApp enabled.
2. Add a phone number in WhatsApp Manager.
3. Put its Phone Number ID in `WHATSAPP_PHONE_NUMBER_ID`.
4. Generate a permanent access token and set `WHATSAPP_ACCESS_TOKEN`.
5. Configure webhook URL: `/api/webhooks/whatsapp`.
6. Use `WHATSAPP_WEBHOOK_VERIFY_TOKEN` as the webhook verify token.
7. Use approved templates if Meta requires them for your conversation category.

## Twilio WhatsApp

1. Enable WhatsApp Sandbox or a production WhatsApp sender.
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_NUMBER`.
3. Configure status callback URL to `/api/webhooks/whatsapp` if using Twilio delivery callbacks.

## Postman Examples

Send OTP:

```http
POST /api/auth/whatsapp/send-otp
Content-Type: application/json

{"phone":"6283847237"}
```

Verify OTP:

```http
POST /api/auth/whatsapp/verify-otp
Content-Type: application/json

{"phone":"6283847237","otp":"123456"}
```

Create order:

```http
POST /api/orders
Idempotency-Key: web-test-001
Content-Type: application/json

{
  "customerName": "Customer name",
  "phone": "6283847237",
  "verificationToken": "signed-token-from-verify",
  "orderType": "pickup",
  "items": [{"menuItemId": 1, "quantity": 2}],
  "paymentMethod": "cash"
}
```

Track order:

```http
GET /api/orders/track/{trackingToken}
```

Update status:

```http
PATCH /api/admin/orders/{orderId}/status
Authorization: Bearer {adminToken}
Content-Type: application/json

{"status":"preparing","estimatedMinutes":20}
```

Cancel order:

```http
PATCH /api/admin/orders/{orderId}/status
Authorization: Bearer {adminToken}
Content-Type: application/json

{"status":"cancelled","cancellationReason":"Item unavailable"}
```

## Tests

```powershell
node --test backend/tests/whatsapp-order-security.test.js
node --check frontend/script.js
npm.cmd run build --prefix admin
```
