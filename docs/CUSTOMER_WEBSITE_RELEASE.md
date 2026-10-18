# Customer Website Release

Prepared on 2026-10-18 on `main`. Staged only; no commit, push or deployment authorized.

## Scope and dependencies

Includes OTP replay protection and phone/purpose binding, bounded requests, safe
pay-at-counter order recovery, mobile checkout cleanup/confirmation, owned tracking,
SMS timeout and safe notification failure handling, zero cloud website packing,
confirmed Clear cart and mobile AI visibility/scroll fixes.

The shared totals calculator adds only an `orderSource` argument and the `website`
packing exemption. Receipt tax rendering stays byte-for-byte at HEAD. Local kiosk/POS
packing and kiosk welcome styling are intentionally excluded, as are Admin, Windows
launcher, deployment, printer and installer changes. No version bump or new migration.

Render needs no new runtime dependency. Existing `pg`, Express, OTP/messaging services,
public configuration, table validation, migrations and cloud-sync files are already tracked.
Root development dependencies include pinned Playwright 1.63.0 and PostCSS 8.5.19 with
their lockfile entries for reproducible browser tests. Backend dependencies are unchanged.

## Security and reliability changes

- Previously verified OTP records could mint new tokens without validating another code.
  Verification now rejects reuse and atomically accepts one valid challenge. Tokens are
  bound to phone, purpose, expiry and verification record, and consumed atomically.
- Kiosk/POS are local only per owner confirmation. Cloud source spoofing is rejected;
  QR exemption requires an actual valid table token. Local ordering remains available.
- Checkout and tracking use separate OTP purposes. Old sessions need a fresh OTP after
  the paired frontend/backend deployment. Phone notification feeds require ownership.
- Shared JSON requests time out after 30 seconds, including body reads. Twilio calls have
  a 15-second deadline. Error cleanup redraws checkout and permits a deliberate retry.
- Cash checkout persists a random idempotency key before submission. Ambiguous outcomes
  are looked up through `POST /api/payments/order-outcome` before retrying the same key.
  Transaction advisory locks prevent concurrent duplicate cash orders.
- `POST /api/payments/quote` uses current server prices/availability/tax; public settings
  expose safe pricing values. Saved order totals drive confirmation. Website packing is
  genuinely zero, not merely hidden, and historical fees remain unchanged.
- Optional cash-order notification inserts run after commit without delaying the receipt.
  SMS OTP remains independent of WhatsApp; acceptance is not a claim of handset delivery.
- Mobile checkout retains confirmation after cart clearing, hides/closes AI, prevents
  background scrolling and supports Back/Escape/backdrop. Clear cart retains identity.

## Validation

Validate the exported index, not the mixed working tree. Test fixtures use disposable
loopback PostgreSQL databases; SMS/provider and browser API traffic are mocked. They do
not alter `restaurant_db`, Supabase, production orders or cloud-sync configuration.

```powershell
node --test tests/customer-api-resolution.test.cjs
node --experimental-test-module-mocks --test backend/tests/public-order-otp.test.js backend/tests/public-customer-security.integration.test.js
node --test tests/public-checkout-browser.test.cjs
node --experimental-test-module-mocks --test backend/tests/optional-whatsapp.test.js backend/tests/otp-diagnostics.test.js backend/tests/whatsapp-order-security.test.js backend/tests/cloud-order-sync.integration.test.js backend/tests/public-order-totals.test.js
git diff --cached --check
```

Use Node 26.4.0 with its experimental module-mocking flag for these validated test runs.
Run `npm ci` at the root and `npm ci --prefix backend` for test dependencies. Browser
tests use installed Edge by default; WebKit is selected with `PUBLIC_TEST_BROWSER=webkit`
and an installed Playwright WebKit browser. Mobile sizes: 320x740, 375x812, 390x844,
430x932. Local DB tests require PostgreSQL with permission to create/drop test databases
and a private backend `.env` containing loopback DB credentials; never commit that file.

The final staging report records executed results and the exact index tree identifier.
Prior full-working-tree receipt/kiosk tests are not evidence for this narrower release.

Executed against the exported Git index on 2026-10-18:

| Suite | Passed | Failed |
| --- | ---: | ---: |
| Customer API resolution | 18 | 0 |
| Public order OTP policy | 18 | 0 |
| Public customer security integration | 12 | 0 |
| Public checkout browser (Chromium/Edge) | 10 | 0 |
| Optional WhatsApp, diagnostics, phone/status, cloud-sync compatibility and website totals | 45 | 0 |
| Public checkout browser (WebKit) | 10 | 0 |
| Total | 113 | 0 |

Counts include Node parent test records. No skipped tests. Syntax checks passed for 93
production JS files, PostCSS parsed staged CSS, 333 static imports across 92 backend modules
resolved with named exports checked, and package/lock dependencies matched. The staged
path/secret scan found no real `.env`, known configured secret values or credential
signatures. Only safe `.env.example` documentation is included. No physical device,
printer, live SMS or production order test is claimed.

## Configuration and release gates

Verify privately on Render: `RESTAURANTAI_MODE=online`, `NODE_ENV=production`,
`PUBLIC_ORDER_OTP_REQUIRED=true`, `OTP_DELIVERY_CHANNEL=sms`, `SMS_PROVIDER=twilio`,
strong stable `OTP_SECRET` and `JWT_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
and an authorized `TWILIO_SMS_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`.
Keep `WHATSAPP_ENABLED=false` unless intentionally enabled. Use
`FRONTEND_URL=https://maheshsweets.in` and the existing restricted CORS policy.
Preserve all database/cloud-sync secrets and configuration.

Earlier read-only live settings reported public OTP disabled. This patch does not change
remote settings: enabling OTP with verified SMS credentials is a release gate. Real SMS
delivery, actual Restaurant PC sync, physical mobile devices/printer and live online
payments remain unverified. The new recovery flow targets pay-at-counter, not Razorpay.
Existing process-local rate limiting needs separate review before multi-instance scaling.

After review/approval, deploy paired backend/frontend on staging first. Then deploy Render
and Vercel in a coordinated window; old OTP sessions must verify again. Only after provider
configuration is confirmed, use the previously authorized number for one delivery check.
With approval, verify one real zero-packing order, duplicate prevention, tracking and its
appearance in restaurant Admin/Kitchen. No automatic deployment is part of staging.

Rollback must retain the OTP security patch and compatible purpose/quote/recovery APIs.
Do not restore the known verification bypass, disable OTP as a workaround, erase orders,
restore a database to undo UI changes or overwrite restaurant configuration.
