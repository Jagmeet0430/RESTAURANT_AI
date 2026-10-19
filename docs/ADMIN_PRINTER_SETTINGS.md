# EC58B Admin Printing: Implementation and Upgrade Checklist

Validated on the development PC, 2026-10-18. No Restaurant PC deployment or physical print was performed.

## Recovered work and cause

The interrupted printer-management backend and existing thermal-layout changes were retained. Admin previously printed with `window.print()`, using the LAN Admin PC's browser/driver rather than the Restaurant PC's printer. Kiosk already used the backend Windows driver path. The two paths had different receipt renderers.

The Windows script also selected forms using the driver's default width. Its drawing coordinates added the physical left offset even though PrintDocument's default graphics origin is the printable area. Long receipts could exceed the largest form without a hard failure. These are confirmed code-level defects; the precise cause of any particular bad physical receipt cannot be confirmed without examining that receipt and host driver.

## Completed flow

Admin Bills / POS receipt -> authenticated local backend -> existing saved billing receipt -> canonical thermal layout -> Windows PrintDocument -> selected Restaurant PC queue.

- `?print=1` submits to the backend, never automatically to the browser.
- **Print on Restaurant PC** is the default action. **Print from this browser** is an explicit alternative.
- Browser preview and host printing use the same canonical receipt entries. The browser uses HTML/CSS; the host uses measured GDI drawing, so their pixel rendering is not identical.
- Persisted totals and existing GST treatment are reused. No historical transaction is repriced and no charged fee is hidden. The fixture showing packing deliberately represents a historical charged receipt.
- A print reference is retained in sessionStorage and a host-side persistent ledger. Repeating that reference does not resubmit. An intentional reprint requires confirmation and a new reference.
- Timeout/spool failure after submission is reported as **unknown**, not automatically retried. A successful Windows API return is **queued**, never proof of paper output.
- Existing kiosk routes, deduplication and automatic printing remain. Legacy kiosk response fields are retained for compatibility, with explicit queued/unconfirmed metadata.

## Settings and security

Admin -> Settings -> Printer Settings discovers printers on the backend host, not the browser PC. It supports receipt queue selection, supported paper size, copies (1-5), bounded font scale/line spacing, enablement, kiosk auto-print, Save, Test Print and Preview. A kitchen-printer preference is reserved only; this does not implement automatic kitchen tickets.

Configuration and test printing require Admin authentication. Saved receipt preview/printing allows existing staff/manager/Admin roles. Printing is rate-limited. Cloud/non-Windows backends cannot control local printers. Printer names must match host discovery; arbitrary config/script paths and raw modes are rejected.

Raw ESC/POS, software cutting, density and logo controls are not enabled. Windows driver defaults govern hardware features, if supported.

Endpoints under `/api/receipt-printer`:

- `GET /settings`, `PUT /settings`: Admin only.
- `POST /test`: Admin only, requires a UUID print reference.
- `GET /preview/:source/:id`: authenticated operator.
- `POST /print/:source/:id`: authenticated operator; test source additionally requires Admin.

The existing printer config path is preserved: normally `C:\ProgramData\RestaurantAI\config\printer.json`, with existing state/config environment overrides respected. Saves are atomic. UTF-8 BOM files from Windows PowerShell are accepted. Settings are filesystem-backed, not browser-only. Isolated fresh-module reload tests verify persistence; an actual Windows reboot/upgrade was not performed.

## Read-only driver findings

These were observed on this development PC, not remotely on the Restaurant PC:

| Property | Observed |
| --- | --- |
| Queues | `Everycom-58-Series`, `Everycom-58-Series (1)` |
| Driver | `Everycom-58-Series Driver` |
| Port | `USB001` |
| Driver status | Normal; not proof the device is physically online |
| Default form width | 48.01mm |
| Reported printable width | 48.05mm |
| Named forms | Printer Paper(58 x 210), (58 x 297), (58 x 3276) |
| Reported form heights | 209.80, 296.93, 3275.84mm |
| Existing saved config | Enabled, Everycom-58-Series, 58mm, one copy, kiosk auto-print enabled |

The driver represents the 58mm roll using its approximately 48mm head width. Validation accepts 47-61mm driver forms for a 58mm roll, and 69-83mm forms for an 80mm roll. This EC58B driver has no matching 80mm form; Admin disables that choice. A4/file-prompt virtual printers are not accepted for unattended receipt printing.

The 58mm drawing path uses approximately 2mm software side margins inside the printable width, giving about 44mm content width. Normal text starts at 7.2pt (Consolas, Courier New fallback), header/total 9.5pt, token 10pt; supported scaling is 0.85-1.15. Names wrap using measured glyph widths. Roll height is selected to fit the measured receipt plus margins and nonprintable height. If it cannot fit, submission fails before PrintDocument.Print instead of silently truncating.

References: [Microsoft PrintDocument](https://learn.microsoft.com/en-us/dotnet/api/system.drawing.printing.printdocument?view=dotnet-plat-ext-7.0), [Get-Printer](https://learn.microsoft.com/en-us/powershell/module/printmanagement/get-printer?view=windowsserver2025-ps). No EC58B-specific raw command/cutter support has been verified.

## Tests and limitations

| Check | Result |
| --- | --- |
| `node --experimental-test-module-mocks --test backend/tests/printer-management.test.js backend/tests/thermal-receipt.test.js` | 33 passed, 0 failed |
| `node --test tests/thermal-receipt-browser.test.cjs` | 6 passed, 0 failed (5 scenarios plus parent test) |
| `node --test tests/windows-package.test.cjs` | 9 passed, 0 failed; synthetic package fixtures, not a new release package |
| `npm.cmd run build` in `admin` | Passed; existing large-bundle warning remains |
| Changed backend JS syntax and Windows script parse checks | Passed |
| `git diff --check` | Passed; repository line-ending warnings only |
| Host printer enumeration | Passed, read-only; no job submitted |
| Physical EC58B paper / reboot / in-place upgrade | NOT TESTED |

Backend tests isolate the database, printer transport and configuration. They cover authentication, unsupported settings, persistence, BOM compatibility, actual 48mm driver convention, 80mm rejection, canonical saved totals, unavailable printers, discovery/spool failures, concurrent/restarted duplicate requests and kiosk auto-print regression. Thermal tests cover 58/80mm, long/unbroken names, discounts, inclusive/exclusive/exempt taxes, CGST/SGST/IGST and rounding. PowerShell renders real PNG previews without accessing a printer.

Browser tests use local API fixtures and Edge, not the live restaurant database. They verify 58/80mm four-column alignment, no cell overflow, totals, explicit browser printing, backend default printing, reload deduplication, unavailable-host retry, double-click suppression, intentional reprint, authenticated calls, settings save/reload/test/preview and panel bounds at 1366x768 and 1024x768. Receipt rendering is checked at 1280x1200. Artifacts are under `temp/thermal-receipt-validation`.

An exploratory 390x844 check exposed the existing Admin shell's fixed 270px sidebar, leaving insufficient content width. Mobile Admin is NOT validated; the unrelated shell was not redesigned. Early browser checks also caught settings action-button overflow, which was fixed and rerun successfully. No assertion about receipt values or column integrity was removed.

## Exact printer-task files

- `admin/src/components/ThermalReceipt.jsx` (new canonical preview)
- `admin/src/index.css` (canonical receipt/print styles)
- `admin/src/pages/Bills/Receipt.jsx` (backend default, explicit browser alternative)
- `admin/src/pages/Settings/Settings.jsx` (settings integration)
- `admin/src/pages/Settings/PrinterSettings.jsx` (new host controls)
- `admin/src/services/receiptPrinter.js` (new authenticated API adapter)
- `backend/src/controllers/receiptPrinterController.js` (queued wording)
- `backend/src/routes/receiptPrinterRoutes.js` (authenticated management routes)
- `backend/src/services/receiptPrinterService.js` (shared renderer/config/transport integration)
- `backend/src/services/printerManagementService.js` (host discovery/settings/job ledger)
- `backend/tests/printer-management.test.js` (new isolated regressions)
- `config/printer.example.json` (safe documented defaults)
- `scripts/list-printers.ps1` (structured read-only discovery)
- `scripts/print-receipt.ps1` (driver forms, margins, wrapping and height safety)
- `scripts/validate-windows-package.cjs` (require new service/discovery script)
- `tests/thermal-receipt-browser.test.cjs` (updated real Admin UI regressions)
- `docs/ADMIN_PRINTER_SETTINGS.md` (this report)

Pre-existing POS canonical-receipt navigation, billing/tax renderer work, kiosk welcome changes, installer/launcher changes and tests were retained. They were not reset or represented as newly authored in this printer task. The current website release is already in HEAD `632aa08`; the Git index was empty on inspection and remains untouched. No commit/push was made.

## Safe Restaurant PC upgrade procedure

1. Schedule a quiet maintenance window. Record the installed version, AppId, installation/state paths, selected queue, driver/form, service/task account and existing receipt sample. Do not assume the duplicate `(1)` queue is the connected device.
2. Verify a recent PostgreSQL backup/restore test using the existing backup procedure. Securely back up the active `.env`, `config/printer.json`, restaurant/printer settings and runtime print ledgers. Preserve the existing cloud-sync secret and settings; do not enable or reconfigure sync.
3. On the development/release machine, build Admin and a complete Windows package with the existing build scripts. Include both backend printer services/routes, canonical billing dependencies, Admin assets and both Windows print/discovery scripts. Run package validation against the new artifact, then compile/checksum the installer. The current older installer does NOT contain this fix merely because Admin was rebuilt here.
4. Keep AppId `{9A7811B0-8392-4C65-8A3E-5D7F9F86E35A}` unchanged. Verify release version is newer than the Restaurant PC's installed version before compiling. This task did not bump versions or build a new installer.
5. With approval and backup verified, stop only RestaurantAI through its existing launcher and run the same-AppId in-place upgrade. Do not uninstall RestaurantAI, reinstall PostgreSQL, reset data or overwrite the active config. Existing installer template entries use `onlyifdoesntexist` / `uninsneveruninstall`; live `printer.json` is not a packaged replacement.
6. Restart under the normal RestaurantAI Windows account. Confirm it sees the physical printer and can write the existing config/runtime directories. A printer visible only in an interactive user session may not be visible to the startup account.
7. From the LAN Admin, open Settings, refresh printers, select the verified EC58B queue, choose 58mm, one copy and default font scale/spacing. Save, reload, and verify persistence. Do not change the Windows default printer unnecessarily.
8. With the operator present, send one Test Print and inspect actual paper: full names, four columns, right edge, token, Grand Total, footer and bottom. Test a long paid/unpaid receipt, explicit reprint, one kiosk order, and an unavailable-printer scenario. Check the Windows queue before retrying an unknown submission.
9. Verify local orders, historical totals, settings, printer config and existing cloud configuration after restart. If validation fails, stop and use the documented backup/rollback process; do not blindly replay print requests or overwrite the database.

Physical checks and the rebuilt/validated installer are release gates, not completed claims. No installer, service, scheduled task, firewall rule, live customer configuration or production database was changed by this task.
