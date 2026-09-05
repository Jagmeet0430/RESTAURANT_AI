# RestaurantAI Pilot Checklist

Use this checklist before a live offline/local pilot.

## Before Installing

- Confirm Windows is 64-bit and Node.js 18+ is installed or bundled.
- Confirm PostgreSQL is installed, running, and reachable on the configured local port.
- Confirm the pilot database name is correct and is not a throwaway test database.
- Confirm a recent full backup exists and can be located by the operator.
- Confirm the machine is on the intended private LAN only.

## Install And Configure

- Run `RestaurantAI-Setup-1.0.0.exe` as administrator.
- Run setup and create or confirm `C:\ProgramData\RestaurantAI\config\.env`.
- Confirm `RESTAURANTAI_MODE=local`, `HOST=0.0.0.0` only when LAN access is required, and `ALLOW_LAN_ORIGINS=true` only for private LAN clients.
- Start RestaurantAI from the Start Menu shortcut.
- Confirm `/api/ready` returns ready before opening POS/Kitchen for staff.

## Smoke Test

- Open Admin, POS, Kitchen, and Customer pages from localhost.
- Log in as admin.
- Confirm the menu loads in Customer.
- Confirm POS product lookup works for a known barcode.
- Confirm Kitchen can see active paid/cash-ready orders.
- Run `scripts\smoke-release.ps1` against the local port.

## Operations

- Run a manual backup after setup and record the backup location.
- Confirm `backend.log` and `backend-error.log` are being written under `C:\ProgramData\RestaurantAI\logs`.
- Confirm `npm run diagnostics:data` reports no failed integrity checks.
- Confirm printer workflow manually with the pilot printer/browser settings.
- Confirm staff devices can reach the LAN Admin/POS/Kitchen URLs.

## Rollback

- Stop RestaurantAI before restoring.
- Restore only from a verified backup.
- Do not delete `C:\ProgramData\RestaurantAI` unless the operator intentionally wants to remove local data and configuration.
