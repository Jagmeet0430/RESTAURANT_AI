# RestaurantAI 1.0.2 Release Notes

## Production Packaging Fix

RestaurantAI 1.0.2 is a narrow patch release for the packaged Admin frontend served from the local backend.

## Fixed

- Fixed packaged Admin blank-page behavior caused by CORS rejecting `localhost` or `127.0.0.1` origins on the backend runtime port.
- Fixed auth-expiry redirects so packaged Admin navigation remains under `/admin/login` instead of escaping to `/login`.
- Hardened Admin static serving so real `/admin/assets/*.js` and `/admin/assets/*.css` files are served before SPA fallback.
- Hardened missing Admin asset handling so missing `/admin/assets/*` files return 404 instead of `index.html`.

## Scope

- No database schema changes.
- No UI redesign.
- No authentication weakening.
- No cloud sync.
- No destructive data changes.
