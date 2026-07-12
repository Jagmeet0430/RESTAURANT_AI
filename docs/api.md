# API

## Authentication
- JWT-based auth
- OAuth2 for third-party integrations

## Endpoints (examples)
- `POST /api/auth/login` — authenticate user
- `GET /api/menus` — list menus
- `POST /api/orders` — create order
- `GET /api/orders/{id}` — get order status
- `POST /api/reservations` — create reservation

## Error handling
Standardized error responses with HTTP status codes and error objects.

## Versioning
Use `/v1/` in path or header-based versioning.

## Rate limiting
Define rate limits for public endpoints.