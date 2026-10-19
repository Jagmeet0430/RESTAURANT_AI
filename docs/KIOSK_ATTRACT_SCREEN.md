# Kiosk Attract Screen

Implemented and validated locally on 2026-10-19. No live Restaurant PC deployment, database changes or physical print test was performed.

## Scope and appearance

Only the existing kiosk route (`/customer?kiosk=1`, or its existing `/customer/kiosk` alias) enters attract mode. It reuses the `welcome` state, restaurant header/logo, bundled food image and existing order-type/menu flow. The public website, Table QR, Admin, Kitchen and POS are not given attract mode.

The dominant red ORDER / HERE / PLEASE headline uses fixed responsive font sizes (144px on 1080x1920, 112px on 768x1366). A gold touch icon and dark touch prompt sit over the existing local food photograph with a white readability overlay. The icon is vendored from the project's MUI TouchApp icon with its license; no external animation/icon service or video is needed.

The headline uses a subtle four-second opacity pulse; the icon floats 12px over 2.8 seconds. Only CSS opacity/transform animate. Both animations stop when the welcome DOM is removed, and `prefers-reduced-motion: reduce` disables both. The entire welcome surface and header accept a touch/click. The full-surface native Start order button supports keyboard activation. A 450ms transition guard prevents a second touch from immediately choosing an order type.

## Timing configuration

Existing configuration mechanisms are reused:

| Setting | URL parameter | `window.RESTAURANTAI_CONFIG.kiosk` key | Default | Minimum |
| --- | --- | --- | --- | --- |
| Inactivity | `kioskIdleSeconds` | `idleTimeoutSeconds` | 60s | 30s |
| Cart warning grace | `kioskIdleGraceSeconds` | `idleGraceSeconds` | 15s | 5s |
| Confirmation display | `kioskResetSeconds` | `confirmationResetSeconds` | 25s | 5s |

Example: `/customer?kiosk=1&kioskIdleSeconds=60&kioskIdleGraceSeconds=15`.

Runtime configuration, if used, must exist before `script.js` loads. No new backend settings or environment variables are required.

- Empty cart: inactivity returns directly to attract mode.
- Cart with items: inactivity shows **Are you still ordering?**, a visible countdown, **Continue ordering**, and **Start over**. Continue preserves the cart; grace expiry clears only the abandoned browser session. Keyboard focus stays in the warning dialog.
- Touch, clicks, key presses, touch movement, wheel scrolling and pressed-pointer movement count as activity. Programmatic scroll restoration, animations and background API refreshes do not.
- Existing menu/settings polling frequencies are unchanged. No new network polling was added.

## Checkout, printing and privacy

One kiosk reset guard protects active submission, uncertain/recovering orders and outstanding receipt requests. Manual Start over, navigation and inactivity cannot clear these states.

Kiosk cash-order requests continue using the existing payment endpoint and backend idempotency mechanism. A frozen customer/payload/key is retained for an ambiguous failure. **Check order** retries that exact request instead of generating another order or accepting cart edits. A definite first-request client rejection permits correction; an uncertain outcome requires recovery or counter-team assistance. This is in-memory kiosk recovery: it does not add crash/reload persistence. Do not refresh a kiosk with an unknown order outcome; check the backend order at the counter first.

On success the existing confirmation snapshot stays visible. The reset countdown waits while the receipt HTTP request is outstanding, then allows the normal confirmation period. Resetting does not cancel a server print job or change a saved order. A print HTTP response or timeout is not proof of physical paper output; existing host-side print deduplication remains authoritative.

Reset clears cart, customer name/phone, active keyboard, local verification/tracking data, order type, confirmation, search/filter and order reference; payment returns to its existing pay-at-counter default. Menu cache, restaurant settings and kiosk print-deduplication IDs remain. No database orders or customer records are deleted. Public website storage is not erased by the kiosk.

## Validation

Run:

```powershell
node --test tests/kiosk-attract.test.cjs tests/kiosk-welcome.test.cjs tests/customer-api-resolution.test.cjs tests/public-checkout-browser.test.cjs
node --check frontend/script.js
git diff --check
```

Final result: **48 passed, 0 failed** (Node totals include parent test cases).

- Attract/session suite: 8 passed. Touch, mouse, double-touch guard, reduced motion, wheel/keyboard activity, default/configured timeouts, cart warning/countdown, Continue, Start over, privacy, pending submission, pending printing, confirmation reset and ambiguous-response retry with one fixture order.
- Welcome/visual suite: 12 passed. 1080x1920, 768x1366, 1366x768, 1920x1080, 640x960 and 375x812 have no attract-screen overflow. Food/logo/icon assets load locally.
- Public API resolution: 18 passed.
- Public checkout browser regressions: 10 passed.
- Public desktop/mobile, Table QR mobile and kiosk menu screenshots are byte-identical against the HEAD baseline. Admin/Kitchen/POS source files were not modified in this task.
- Twenty accelerated idle cycles keep one menu poll timer, one settings poll timer, no leftover idle/countdown timers at welcome and exactly two attract animations. CSS motion was observed advancing in real browser time.
- JS syntax, PostCSS parsing and diff whitespace checks passed. Windows line-ending warnings are informational.

All order/print tests use isolated HTTP fixtures; no real orders, SMS or physical print jobs were created. The controlled clock replaces a long-duration soak test, not actual hardware validation. Real Windows touchscreen behavior over a full shift and physical receipt output remain untested.

Screenshots: `temp/kiosk-welcome-validation/welcome-1080x1920.png` and `welcome-768x1366.png`, with other viewport and regression screenshots in the same directory.

## Files changed in this task

- `frontend/script.js`: welcome/idle state, reset guards, frozen kiosk retry payload, privacy cleanup and event handling.
- `frontend/styles.css`: kiosk-scoped attract typography/background/motion/responsive rules.
- `frontend/index.html`: script/style cache-version updates only.
- `frontend/assets/kiosk-touch.svg`: bundled touch icon.
- `frontend/assets/kiosk-touch.LICENSE.txt`: icon attribution/license.
- `tests/kiosk-attract.test.cjs`: isolated session and safety browser tests.
- `tests/kiosk-welcome.test.cjs`: updated welcome expectations, retained ordering/public visual regressions.
- `docs/KIOSK_ATTRACT_SCREEN.md`: this report.

Pre-existing customer, receipt, kiosk welcome, installer and printer changes were kept. No Git staging, reset, commit or push was performed.

## Safe installed-kiosk deployment

1. Keep the current installation/configuration and verified backups. This frontend task does not need PostgreSQL migrations, cloud-sync changes or printer-setting changes.
2. Review/package the matched frontend HTML, JS, CSS and assets together with the approved release using the existing packaging process. Keep the installer AppId and persistent configuration/data paths. Do not ship an older compiled installer as though it contains these changes.
3. Test on a non-live Windows kiosk first: touch anywhere, order types, quantities, custom/physical keyboard, idle warning, one full order, pending response, confirmation and receipt behavior. Run a full-shift soak check before claiming prolonged hardware stability.
4. With operator approval and no order/receipt pending, apply the reviewed in-place upgrade. Do not uninstall RestaurantAI, reset data, overwrite `.env`/printer settings or reinstall PostgreSQL.
5. Reopen the existing `/customer?kiosk=1` shortcut. New cache versions ensure the paired script/styles are requested. Confirm the attract screen, 60-second idle behavior, correct menu and existing printing. Do not refresh during an uncertain order outcome.

No installer was built and no Restaurant PC deployment was performed for this task.
