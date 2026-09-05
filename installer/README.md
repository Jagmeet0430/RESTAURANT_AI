# RestaurantAI Installer

This directory contains the Phase 5 Inno Setup source for the RestaurantAI Windows installer.

## Prerequisites

- Inno Setup 6 is required to compile `RestaurantAI.iss`.
- The current installer does not bundle Node.js. Node.js 18+ must be installed before RestaurantAI can run.
- PostgreSQL is external and is not bundled, installed, uninstalled, reset, or removed by the RestaurantAI installer.

## Build

From the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\build-installer.ps1
```

The script rebuilds the portable package, locates `ISCC.exe`, and writes the installer to:

```text
dist\installer\RestaurantAI-Setup-1.0.0.exe
```

If Inno Setup is not installed, the script leaves the installer sources ready and reports the missing compiler.

## Identity

- AppName: RestaurantAI
- Publisher: RestaurantAI
- Version: derived from the root `package.json` during build script validation; currently `1.0.0`.
- AppId: stored in `RestaurantAI.iss`. Do not change it after release, or upgrades will install as a separate product.

## Layout

Application binaries install to:

```text
C:\Program Files\RestaurantAI
```

Mutable machine-wide state is preserved under:

```text
C:\ProgramData\RestaurantAI
```

The installer creates `config`, `data`, `backups`, `logs`, and `runtime` under ProgramData and does not ship a real `.env`.

## Upgrade Behavior

Future installers with the same AppId upgrade the existing installation. On upgrade, the installer attempts to stop RestaurantAI and create a verified backup before replacing binaries. Existing `config\.env`, data, backups, and the PostgreSQL database are preserved.

## Uninstall Behavior

Uninstall removes application binaries and Start Menu/Desktop shortcuts. It attempts to stop RestaurantAI, remove the optional startup task, and remove the optional firewall rule. It preserves `C:\ProgramData\RestaurantAI` and never drops `restaurant_db`.

## Silent Install

`/VERYSILENT` installs files only. Interactive database/admin configuration is skipped; run `scripts\setup-restaurantai.ps1` afterward or provide a secure deployment process for `config\.env`.

## Signing

Development builds are unsigned. Production releases should be signed with a trusted Authenticode code-signing certificate. Self-signed certificates are not suitable for final distribution and will not avoid SmartScreen warnings for restaurant operators.
