# RestaurantAI 1.0.1 Release Notes

## Pilot Fix Release

RestaurantAI 1.0.1 is a minimal pilot-blocker fix release created during Phase 7 validation.

## Fixed

- Backup scripts now let the selected `.env` file override stale database environment variables while preserving runtime backup-directory overrides. This prevents manual backups from accidentally targeting the default `restaurantai` database when the configured pilot database is `restaurant_db`.

## Scope

- No architecture changes.
- No cloud sync.
- No UI redesign.
- No destructive changes to restaurant data.
