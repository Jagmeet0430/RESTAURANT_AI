# RestaurantAI 1.0.0 Pilot Report

Report date: 2026-09-05

## Release Candidate Freeze

- Initial pilot RC: RestaurantAI 1.0.0 Pilot RC
- Initial installer: `dist\installer\RestaurantAI-Setup-1.0.0.exe`
- Initial SHA-256: `348AAB50CB34700BC699C93DABE2D2D8A481A9F40BEAA8DAACBD4523275AEFAE`
- Branch: `offline-development`
- HEAD at freeze check: `a5ba764`
- Commit status: dirty working tree with Phase 4-7 release changes; no commit or push was made.

## Pilot Environment

This report records local validation on the available Windows server/test machine. A full real-restaurant pilot with separate POS, kitchen, admin, barcode scanner, thermal printer, WAN interruption, staff workflow, and multi-hour soak has not yet been completed.

Server/test machine facts collected:

- Hostname: `Jagmeet`
- Windows: `Microsoft Windows [Version 10.0.26200.9168]`
- Network: Wi-Fi connected, IPv4 `192.168.31.212`, gateway `192.168.31.1`, DNS suffix `lan`
- Ethernet: disconnected during inventory
- CPU/RAM/free disk: not readable from this shell due Windows CIM/fsutil access denial
- PostgreSQL: `psql (PostgreSQL) 18.4`
- PostgreSQL service: `postgresql-x64-18`, running, automatic startup

ProgramData state on this machine:

- `C:\ProgramData\RestaurantAI`: exists
- `config`, `logs`, `runtime`, `backups`: not present during this local check, so the installer was not verified as a completed onsite ProgramData install in this run.

## Installation And Preflight

- Installer compile verified for 1.0.0 in Phase 6.
- A Phase 7 backup blocker was found during local pilot validation, so a new patch release was produced instead of replacing 1.0.0.
- New patch installer: `dist\installer\RestaurantAI-Setup-1.0.1.exe`
- New patch SHA-256: recorded after installer compile in `dist\installer\RestaurantAI-Setup-1.0.1.exe.sha256`
- New patch size: recorded after installer compile with the final installer artifact

Preflight result:

- PASS: Windows, Node.js, npm, psql, pg_dump, pg_restore, PostgreSQL service, Python runtime, backend port availability, env file, backup/runtime/log writable directories.
- WARN: optional RAG chatbot dependencies and optional OCR dependencies require setup only if those features are needed.

## Database Validation

- Configured database: `restaurant_db`
- Public tables: 29
- `schema_migrations`: one baseline row, `offline-v1-baseline`, `baseline=true`
- Integrity diagnostics: PASS
- Read-only data snapshot:
  - admins: 1
  - categories: 23
  - menu items: 185
  - products: 9
  - inventory rows: 11
  - orders: 27
  - counter sales: 21
  - customers: 28

## Backup And Restore

Initial 1.0.0 pilot backup attempt:

- FAIL: backup attempted to use default database name `restaurantai` instead of configured `restaurant_db` when the launcher selected a missing `config\.env` path.
- Severity: P1, because verified backups are required for GO.

Fix made:

- Version bumped to 1.0.1.
- `scripts\backup-restaurantai.ps1` now resolves the first existing config file from state root, repo config, then backend `.env`, and fails if none exists.
- `backend\scripts\backupDatabase.js` now derives backup DB settings directly from the selected env file while preserving runtime backup-directory overrides.

Regression result:

- Manual backup: PASS
- Backup file: `backups\full\restaurantai_2026-09-05_093846\database\restaurant_db_2026-09-05_093847.dump`
- Size: 119533 bytes
- Backup SHA-256: `237b55716aae3249a1757d0694c16cc84fda95469d0f7a3ffa19a99c1e3eeb7f`
- Metadata: generated
- `pg_restore --list`: PASS

Restore drill:

- Restored into temporary database `restaurant_db_restore_test`.
- Verified table counts for admins, categories, menu, customers, orders, order items, counter sales, counter sale items, inventory, inventory transactions, products, payments, coupons, and schema migrations.
- Verified revenue reconciliation for orders, counter sales, and combined revenue.
- Temporary restore database dropped.
- Restore result: PASS

## Onsite Workflow Results

Not run in this local session:

- Real server installation on pilot restaurant PC
- Real admin account setup
- Restaurant settings entry
- Real menu and inventory configuration by operator
- LAN mode with `HOST=0.0.0.0`
- Firewall rule verification on pilot network
- POS test from separate physical device
- 10 controlled pilot sales
- Barcode scanner test
- Thermal printer test
- Kitchen display test from separate device
- Multi-device concurrency
- WAN disconnected while LAN remains active
- Client LAN interruption and retry behavior
- Windows reboot/autostart test
- Controlled power-loss/process-kill recovery
- Scheduled backup execution
- External USB/NAS backup copy
- Reports comparison after pilot transactions
- Inventory physical count reconciliation
- Staff workflow observation
- Five-minute cashier usability test
- Several-hour performance soak
- End-of-day workflow

## Security Check

Verified locally:

- PostgreSQL service is local and running.
- Integrity diagnostics pass.
- Phase 6 verified diagnostics auth, hidden static path blocking, role-protected routes, upload filename hardening, redacted logging, and config ACL installer hardening.

Not fully verified onsite:

- Port 5432 not exposed to client network
- Firewall exposes backend port only
- ProgramData ACL after real installer run
- Backups inaccessible over HTTP from client devices
- No token/password exposure in real operator workflows

## Issue Classification

- P0: none found.
- P1: `P1-001`, fixed in 1.0.1. Manual backup could target default DB when the launcher resolved a missing config path.
- P2: optional RAG/OCR setup warnings if the restaurant expects AI assistant or OCR upload during pilot.
- P3: none recorded from onsite staff, because staff workflow was not run.
- P4: none recorded.

## Release Decision

Decision for RestaurantAI 1.0.0 Pilot RC: NO-GO.

Reason: a P1 backup issue was found during pilot validation. It was fixed as 1.0.1 and not silently folded into the 1.0.0 artifact.

Decision for RestaurantAI 1.0.1 patch candidate: GO WITH CONDITIONS for onsite pilot.

Conditions:

- Run the full real-restaurant pilot checklist on actual POS, kitchen, admin, LAN, scanner, and printer devices.
- Verify installer ProgramData state and ACL on the real server.
- Verify manual backup, scheduled backup, restore drill, and external backup copy onsite.
- Complete staff workflow, reports comparison, inventory reconciliation, restart/reboot, client disconnect, WAN-offline, and soak tests before production GO.

## Phase 7 Checklist Summary

1. Pilot environment: local Windows server/test machine only, hostname `Jagmeet`, Wi-Fi `192.168.31.212`.
2. Installer result: 1.0.0 artifact preserved; 1.0.1 patch installer built after P1 fix.
3. Preflight: PASS with optional RAG/OCR warnings only.
4. Database result: PASS on `restaurant_db`, 29 public tables, baseline migration present.
5. Admin setup: not run onsite.
6. LAN result: not run onsite with separate client devices.
7. POS result: not run onsite.
8. Barcode result: not run with physical scanner.
9. Printer result: not run with thermal printer.
10. Kitchen result: not run on kitchen device.
11. Concurrent clients: not run.
12. LAN performance: not measured onsite.
13. Internet-offline result: not run with WAN disconnected.
14. Client disconnect result: not run.
15. Server restart result: not run as an installed service/app flow.
16. Windows reboot result: not run.
17. Backup result: 1.0.0 failed with P1 backup-target issue; 1.0.1 manual backup PASS.
18. Scheduled backup result: not run.
19. Restore drill result: PASS into temporary restore database with counts and revenue reconciliation.
20. Reports result: not compared against real pilot transactions.
21. Inventory reconciliation: not run with physical count.
22. Staff workflow result: not observed.
23. Five-minute usability result: not run with cashier.
24. Error scenarios: partial only through failed backup discovery and restore drill; physical interruption scenarios not run.
25. Diagnostics result: PASS for data integrity; preflight WARN only for optional RAG/OCR features.
26. Security result: partial local verification only; onsite firewall, ACL, and network exposure still required.
27. Soak test result: not run.
28. Issues by severity: P0 none, P1 one fixed in 1.0.1, P2 optional RAG/OCR warnings, P3 none, P4 none.
29. Fixes made: backup launcher/env resolution fix, backup script env derivation fix, 1.0.1 version bump, release notes, rebuilt package/installer.
30. Staff feedback summary: none collected because staff pilot was not run.
31. Release decision: 1.0.0 NO-GO; 1.0.1 GO WITH CONDITIONS for onsite pilot.
32. Remaining blockers: full real-restaurant device/LAN/printer/scanner/staff/reboot/scheduled-backup/external-copy/soak validation.
33. Whether pilot passes: overall real restaurant pilot DOES NOT PASS yet; local validation passed after 1.0.1 fix.

## Final Assessment

The local validation portion passed after the 1.0.1 P1 fix. The real restaurant pilot has not passed yet because the required physical devices, staff workflow, printer, LAN interruption, reboot, scheduled backup, external copy, and soak tests were not performed in this session.
