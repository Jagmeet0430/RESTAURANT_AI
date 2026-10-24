# Public Website Reliability and OTP Security

Validation date: 2026-10-18. Changes are local and uncommitted. Nothing was deployed.

## Recovered work and scope

Continued the dirty working tree without resetting earlier installer, receipt or kiosk work.
The existing API resolver, optional WhatsApp configuration, public OTP feature flag,
cloud sync architecture and receipt implementation were retained. No installer was rebuilt.
No migration is required by this website patch. Historical amounts are not rewritten.

The owner confirmed that kiosk and POS operate locally only. Cloud requests cannot
claim those sources to bypass website verification; local mode retains them.

## Root causes and repairs

| Issue | Cause | Repair |
| --- | --- | --- |
| OTP replay bypass | An already-verified record minted a new token without checking the supplied OTP. | Reject verified challenges; atomically verify only an unused, unexpired challenge below its attempt limit. Atomically consume checkout tokens. |
| Cross-purpose authorization | Tokens and OTP hashes did not bind checkout versus tracking. | Bind phone, purpose and verification record; tracking tokens cannot authorize checkout. |
| Source spoofing | A cloud caller could claim kiosk/POS or tokenless QR to receive an OTP exemption. | Reject cloud kiosk/POS with 403 in both order-creation controllers; QR requires an actually validated table token. Disabled tables retain existing 404 behavior. |
| Requests stuck loading | Shared requests had no complete body-read deadline; failed/pending work could leave UI flags set. | Abort after 30 seconds including JSON reading, clear timers/in-flight state, handle malformed responses, redraw checkout in finally. Twilio requests have a 15-second deadline. |
| Lost order response | A timeout did not establish whether the server had committed. | Persist a browser UUID idempotency key and pending checkout snapshot before cash submission. Check the saved outcome before retrying the same key. PostgreSQL advisory transaction locks serialize duplicate cash submissions. |
| Mobile success not visible | Clearing the cart hid the mobile confirmation; cleanup did not redraw the sheet. | Render the saved order receipt independently of the emptied cart, retain pending data on ambiguous failures and restore controls after definite failures. |
| Website packing charge | Public pickup reused the default packing charge. | Cloud website source uses zero packing in the existing totals calculator. Hide only zero UI lines. Existing tax calculation, local customer/POS fees and historical persisted bills remain intact. |
| Displayed total differed | Browser estimates and whole-rupee formatting could differ from persisted totals. | Obtain a server quote before payment, preserve fractional rupees and use persisted order totals for confirmation. |
| Tracking ownership | Phone notification feeds were public; ownership fallback could associate old orders with a changed customer phone. | Require token ownership for phone feeds and staff authentication for customer-ID feeds. Use the order's original phone snapshot; tracking list requires a tracking-purpose token. |
| Broken tracking links/states | Relative assets broke on deep paths; expired sessions and invalid links did not recover cleanly. | Scope the asset base to tracking deep links; verify initial tracking fetch, provide retry and clear expired tracking sessions. |
| Optional notification failure | A notification INSERT inside cash checkout could invalidate the transaction. | Save order/payment first; execute the optional notification insert separately without delaying the successful response. |
| Mobile overlay conflicts | AI launcher/popup remained over checkout, scroll was not reliably locked and messages covered totals. | Hide/close AI during the sheet, lock background scroll, restore on close, support Back/Escape/backdrop, safe-area footer and top-positioned toast. Clear cart asks for confirmation and preserves identity. |

## API and compatibility details

- OTP send/verify keep their existing routes. Both accept `purpose: checkout` or
  `purpose: tracking`; omitted purpose defaults to checkout.
- Previously issued OTP challenges/tokens must be replaced after deployment because
  the security binding changed. Deploy backend and public frontend together.
- `POST /api/payments/quote`: prices and availability from the existing server calculator.
- `POST /api/payments/order-outcome`: read-only recovery using a random `web-<UUIDv4>`
  reference, normalized phone and checkout verification when required. A consumed
  checkout token may authorize this read only, never another order creation.
- Recovery and quote routes are rate limited. Cart edits are blocked while an order
  outcome is unresolved. Reload retains the same pending reference.
- Recovery currently targets pay-at-counter checkout, the method enabled in the live
  settings observed during this task. Do not interpret this as live Razorpay validation.
- A valid table token retains its existing dine-in exemption. Local kiosk/POS are
  unchanged; run them with `RESTAURANTAI_MODE=local`, not online mode.
- Optional WhatsApp remains independent of SMS OTP. Provider acceptance is not proof
  of handset delivery. No new SMS/order-status delivery service was invented.

## Files changed for this task

Production files (some also contain pre-existing changes, retained untouched):

- `backend/.env.example`
- `backend/src/controllers/customersController.js`
- `backend/src/controllers/ordersController.js`
- `backend/src/controllers/paymentController.js`
- `backend/src/controllers/settingsController.js`
- `backend/src/routes/notificationsRoutes.js`
- `backend/src/routes/paymentRoutes.js`
- `backend/src/services/otpService.js`
- `backend/src/services/orderTotalsService.js`
- `backend/src/services/tableQrService.js`
- `backend/src/services/twilioMessageService.js`
- `backend/src/services/notificationService.js`
- `backend/src/services/orderLifecycleService.js`
- `frontend/index.html`
- `frontend/script.js`
- `frontend/styles.css`

Tests and documentation:

- `backend/tests/public-customer-security.integration.test.js` (new)
- `backend/tests/public-order-otp.test.js`
- `backend/tests/optional-whatsapp.test.js`
- `backend/tests/cloud-order-sync.integration.test.js`
- `backend/tests/thermal-receipt.test.js` (extends prior receipt work)
- `tests/customer-api-resolution.test.cjs`
- `tests/public-checkout-browser.test.cjs` (new)
- `docs/LIVE_WEBSITE_FIXES.md` (new)

Other installer/Admin/receipt changes shown by git status predate this website task.

## Executed validation

All following runs completed successfully; counts include Node parent test records.

| Run | Result | Boundary |
| --- | --- | --- |
| OTP/security, public order policy, optional WhatsApp, sanitized diagnostics, cloud sync, phone/status and thermal backend suites | 92 passed, 0 failed | Real disposable local PostgreSQL for OTP/order ownership, concurrent commits, notifications and cloud/local sync; mocked SMS and printer transport. |
| API resolver, checkout browser, kiosk visual and browser receipt suites | 41 passed, 0 failed | Installed Chromium/Edge, local static server and API fixtures; no production orders. |
| Checkout browser suite with WebKit | 10 passed, 0 failed | Windows Playwright WebKit; not an actual iPhone. |
| Syntax | 13 production JS files passed | `node --check`. |
| CSS | Passed | Parsed `frontend/styles.css` with PostCSS. |
| Whitespace | Passed | `git diff --check`; existing CRLF conversion warnings only. |

Total: **143 passed, 0 failed**. No tests were skipped in these runs.

Covered: correct/wrong/expired/reused OTP; fresh challenge after previous verification;
purpose and phone mismatch; cooldown, attempts and rate limits; concurrent verification;
provider failure cleanup; cloud source spoof rejection; valid/disabled QR; zero packing;
server pricing; concurrent duplicate order creation; owned recovery; lost response across
reload; timeout including stalled response body; loading cleanup; clear cart; AI visibility;
deep-link assets; tracking status updates through the isolated sync worker; optional
notification SQL failure; local kiosk; historical receipts; 58mm/80mm rendering.

Mobile fixture sizes: 320x740, 375x812, 390x844, 430x932, on Chromium and WebKit.
Screenshots are in ignored `temp/public-checkout-validation/chromium/` and `webkit/`.
Desktop customer, mobile menu, table QR and kiosk ordering screenshot comparisons against
HEAD passed. Kiosk welcome navigation/layout passed at 1080x1920, 768x1366, 1366x768,
1920x1080, 640x960 and 375x812. No physical printer test was performed.

Reproduction:

```powershell
node --experimental-test-module-mocks --test backend/tests/public-customer-security.integration.test.js backend/tests/cloud-order-sync.integration.test.js backend/tests/public-order-otp.test.js backend/tests/optional-whatsapp.test.js backend/tests/otp-diagnostics.test.js backend/tests/whatsapp-order-security.test.js backend/tests/thermal-receipt.test.js
node --test tests/customer-api-resolution.test.cjs tests/public-checkout-browser.test.cjs tests/kiosk-welcome.test.cjs tests/thermal-receipt-browser.test.cjs
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'temp\playwright-browsers'
$env:PUBLIC_TEST_BROWSER = 'webkit'
node --test tests/public-checkout-browser.test.cjs
```

The DB suites connect only to loopback `postgres` for creating uniquely named disposable
test databases. They do not test against `restaurant_db` or Supabase. Node 26 needs the
experimental module-mocking flag; its warning is expected. Existing mock fixtures also
emit a `namedExports` deprecation warning.

## Render configuration to verify before release

Existing variables, not a new configuration architecture:

```dotenv
NODE_ENV=production
RESTAURANTAI_MODE=online
PUBLIC_ORDER_OTP_REQUIRED=true
OTP_DELIVERY_CHANNEL=sms
SMS_PROVIDER=twilio
WHATSAPP_ENABLED=false
FRONTEND_URL=https://maheshsweets.in
```

Set private credentials in Render, never in the public frontend or committed files:

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`.
- An authorized `TWILIO_SMS_NUMBER` OR `TWILIO_MESSAGING_SERVICE_SID`.
- A strong stable `OTP_SECRET` and the existing strong `JWT_SECRET`.
- Preserve existing `DATABASE_URL`, TLS configuration and `CLOUD_SYNC_SECRET`.
- Ensure `CORS_ORIGINS` includes `https://maheshsweets.in` while retaining only needed
  existing trusted origins. Preserve the current project-specific preview policy.
- Keep the cloud-to-local worker disabled on Render and the development PC. It belongs
  on the configured restaurant machine only.
- Retain configured OTP expiry, resend, attempts and token expiry limits; do not weaken
  them for testing. Verify sender/account authorization for the destination with Twilio.

## Live observations and blockers

Read-only checks earlier in this task reached the production frontend, public settings
and payment methods successfully. Public settings reported `public_order_otp_required:
false` and online payments disabled. These are observations, not configuration changes.

Render private environment/provider credentials could not be verified from this workspace.
Local configuration did not contain a usable SMS provider configuration. Therefore no
authorized test SMS was sent and real delivery remains untested. Do not claim an end-to-end
production pass or turn OTP off to work around provider setup.

Other untested boundaries: actual Restaurant PC/Admin/Kitchen synchronization, physical
iOS/Android devices, a physical thermal printer, live payment gateway and production load.
Existing process-local rate limiters are not a distributed abuse-control system; multi-instance
production needs a reviewed shared limiter/trusted proxy policy. This patch does not change
that deployment architecture. Online gateway ambiguous-payment recovery is outside the
new pay-at-counter recovery flow and needs separate validation before enabling it.

## Safe deployment and validation (manual approval required)

1. Review only the intended website diff alongside the unrelated pre-existing changes.
   Record the current frontend/backend releases; preserve secrets and database backups.
2. Verify Render configuration privately, configure the SMS sender and enable public OTP.
   Do not put provider secrets into Vercel frontend environment variables.
3. Test the paired backend/frontend on staging first. Deploy the reviewed Render backend,
   then the matching Vercel frontend in a coordinated window. No DB migration/reset is
   needed. Old OTP sessions require a fresh challenge after this security update.
4. Confirm HTTPS, public settings/quote and existing OTP routes from `maheshsweets.in`.
   Confirm cloud kiosk/POS requests return 403 and unverified public checkout is rejected.
5. Only after provider configuration is verified, send one OTP to the previously authorized
   test phone. Inspect provider acceptance/delivery status privately, then verify the code.
   Do not print the phone, OTP or credentials in logs/reports. Stop on failure; do not send
   repeated paid messages without renewed approval.
6. With approval, place one identifiable real pay-at-counter order. Confirm zero packing,
   persisted total, one order only, tracking ownership and receipt. Verify restaurant sync
   and unpaid website visibility in actual Admin/Kitchen without changing local settings.
7. Test on physical Safari/Chrome devices and monitor sanitized provider/server errors.

Rollback: frontend rollback must remain compatible with purpose-bound OTP and the new
quote/recovery contract. Do not roll the backend back to the known verified-record bypass.
If a backend rollback is necessary, keep the security fixes or suspend public ordering while
preparing a corrected release. Never restore/delete orders to undo a UI deployment, disable
OTP as a workaround, rotate secrets casually, or overwrite the Restaurant PC configuration.
