# RestaurantAI 1.4.6 upgrade validation

Prepared on 2026-10-18. The operator reports Restaurant PC version 1.4.5;
read-only registry inspection on the development PC found 1.4.2. Neither
installation was changed. Release 1.4.6 keeps AppId
`{9A7811B0-8392-4C65-8A3E-5D7F9F86E35A}` and reuses the registered directory.

## Included changes

- Existing receipt redesign: four columns, wrapped names, saved tax breakdown,
  quantity, discounts, charges, round-off, Grand Total and Algosophix footer.
- New kiosk dine-in/takeaway orders no longer inherit the shared pickup packing
  fee. Both order APIs persist zero packing; frontend totals match. Historical
  charges and other ordering channels are not repriced. Kiosk displays preserve
  fractional rupees instead of rounding a payable 94.50 to 95.
- Latest three-line kiosk welcome heading and larger Start order text.
- Legacy order creation now generates its order number using its transaction
  connection, avoiding a self-blocking query after table schema initialization.
- Pinned root development dependencies for Playwright/PostCSS; supported Node
  module-mock flag and API. Test dependencies are not shipped in the backend.
- Existing Windows hardening, migration 016 and all cloud-sync components.
- Upgrades skip configuration rewriting; newer installed versions block downgrade.
- Incoming UTC-safe stop logic is used before replacement, and an active backend
  port blocks replacement even if process metadata is stale or missing.

## Reproduce validation

Use Node 26.4.0 and installed Microsoft Edge for these development tests.
The production prerequisite remains Node 22+ x64 and PostgreSQL 18+.

```powershell
npm ci
npm --prefix admin ci
npm --prefix backend ci
npm --prefix admin run build
npm test
node --experimental-test-module-mocks --test backend/tests/cloud-order-sync.integration.test.js
node --test tests/windows-package.test.cjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/windows-deployment.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-windows-package.ps1
node --test backend/tests/windows-deployment.integration.test.js
node scripts/validate-windows-package.cjs dist/RestaurantAI-Windows
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-installer.ps1 -SkipPortableBuild
```

Database tests use only uniquely named disposable databases on loopback PostgreSQL.
They read development credentials without printing them; restaurant_db is not
opened. Cloud tests route their fake remote API to loopback. Startup tests use
temporary configuration/state, sync disabled and an unused port. Task/firewall
tests mock the OS operations; they do not install tasks, rules or services.

## Safety boundaries

- Application files go to Program Files; persistent config, printer/kiosk JSON,
  uploads, logs and backups remain under ProgramData/RestaurantAI.
- .env is not shipped or rewritten on upgrade. Arbitrary existing sync settings
  and credentials remain intact. Only the designated Restaurant PC may run sync.
- Verified full backup is mandatory before replacement. Supported migrations
  013-016 run transactionally after another verified backup; no database is
  recreated/reset, and PostgreSQL is not installed by this package.
- SQL failure rolls back the migration transaction. Application file rollback
  is NOT automatic. A failed upgrade requires technician recovery and must not
  be treated as operational.
- Saved tax metadata can describe IGST, other rates, inclusive and exempt sales.
  The receipt reader supports these snapshots; current checkout still uses its
  existing 5% exclusive tax calculation. This is not a per-product tax-engine
  release, and historical jurisdiction is not invented.

## Operator upgrade procedure

1. Validate the installer on an isolated clone/VM of the 1.4.5 installation first.
   Include backup failure, populated upgrade, reboot and recovery testing.
2. Schedule downtime; finish pending payments and close all ordering clients.
   Retain the previous application files/installer. Take a full backup using the
   installed backup script with explicit InstallRoot and StateRoot (see
   CUSTOMER_INSTALLATION.md). Protect its configuration credentials and keep an
   encrypted off-machine copy. Verify the archive and restore-test separately.
3. Verify the delivered EXE SHA-256 against its release report. Do not uninstall
   RestaurantAI, reinstall PostgreSQL, delete ProgramData or replace .env.
4. Run RestaurantAI-Setup-1.4.6.exe as administrator, keeping the existing install
   directory. Do not change firewall/task selections unless intentionally needed.
   Existing configuration is reused; fresh installs alone require the wizard.
5. Confirm readiness, historical orders/bills/settings, printer selection,
   Admin/POS/Kitchen, LAN access and the welcome screen. Place an approved kiosk
   test order; check zero packing, exact payment total and one printed receipt.
6. Verify cloud sync on the Restaurant PC only, checking backlog and duplicates.
   Never enable production sync on the development PC or test clone.
7. If any step fails, keep clients closed and stop the failed application. Retain
   logs and the verified backup. A technician should recover on a clone before
   restoring application/config/data consistently. Do not bypass downgrade checks
   or resume cloud sync blindly after restoring an older database.

## Acceptance still required

No physical receipt has been checked. No installer has been executed on the live
Restaurant PC or a clean Windows VM. Reboot/task-account printer access, actual
LAN firewall behavior and populated installer rollback require site/VM acceptance.
The installer is unsigned. The Admin bundle-size warning and existing deprecated
backend dependencies are not resolved by this upgrade. These are not grounds to
claim production readiness merely because compilation succeeds.

Final test counts, artifact size and SHA-256 are recorded alongside the generated
installer in `dist/installer/RestaurantAI-1.4.6-validation.md` after compilation.
