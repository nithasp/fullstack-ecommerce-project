# API Security — OWASP API Security Top 10 (2023) mapping

How the backend addresses each category, and where the relevant code lives.

| # | Risk | What the API does | Where |
| - | ---- | ----------------- | ----- |
| API1 | Broken Object Level Authorization | Every customer route resolves the owner from the **verified token**, never from the request. Another user's id in the URL, query or body returns `403`; another user's order/cart item/address returns `404` so its existence isn't revealed. Only the `admin` role bypasses this, and it is checked server-side. | `utils/authorize.ts` (`requireSelf`), `handlers/orders.ts` (`requireOwnOrder`), cart/address stores scope every query by `user_id` |
| API2 | Broken Authentication | Passwords are bcrypt-hashed with a pepper; access tokens are short-lived JWTs (15 min); refresh tokens are opaque random values stored **hashed**, rotated on every use and revocable (`/auth/logout`, `/auth/logout-all`). Login, register and refresh are rate limited (20 / 15 min). Refresh re-reads the account, so a deleted account can't renew. | `models/user.ts`, `models/refreshToken.ts`, `handlers/auth.ts`, `server.ts` |
| API3 | Broken Object Property Level Authorization | Responses never include the password hash (`SAFE_FIELDS`). Writable fields are allow-listed per route: `POST /auth/register` and `PUT /users/:id` read only `firstName`, `lastName`, `username`, `password` — a `role` in the body is ignored. The role can only be set by an admin through `POST /admin/users` or the dedicated `PUT /admin/users/:id/role`. | `handlers/auth.ts`, `handlers/users.ts`, `handlers/admin.ts` |
| API4 | Unrestricted Resource Consumption | Global per-IP rate limit (`API_RATE_LIMIT`, default 500 / 15 min) plus the stricter auth limit; JSON bodies capped (`JSON_BODY_LIMIT`, default 1 MB); admin list endpoints are paginated with `limit` ≤ 100 and validated `offset`. | `server.ts`, `config.ts`, `utils/validate.ts` (`parsePagination`) |
| API5 | Broken Function Level Authorization | Two roles, `customer` and `admin`. Admin-only functions: everything under `/admin`, `GET`/`POST /users`, and all product writes (`POST`/`PUT`/`DELETE /products`, `/products/bulk`). `requireAdmin` **re-reads the role from the database** on every admin request, so a demoted or deleted admin is blocked immediately rather than at token expiry. Changing a role revokes that user's refresh tokens; admins cannot change their own role or delete their own account via the admin API, preventing accidental lock-out. | `middleware/auth.ts` (`requireAdmin`), `handlers/admin.ts`, `handlers/products.ts`, `handlers/users.ts` |
| API6 | Unrestricted Access to Sensitive Business Flows | Account creation and login are rate limited; catalog changes and cross-user data access require an admin; checkout runs in a single transaction. | `server.ts`, `handlers/cart.ts` |
| API7 | Server Side Request Forgery | The API makes no outbound requests based on user input (image fields are stored as plain strings and never fetched). | — |
| API8 | Security Misconfiguration | `helmet` security headers; CORS restricted to `ALLOWED_ORIGIN`; `TOKEN_SECRET` is mandatory in production; unexpected errors return a generic `500` and are logged server-side (no stack traces, SQL or paths in responses); malformed / oversized JSON gets a clean `400`/`413`. All queries are parameterised. | `server.ts`, `config.ts`, `utils/response.ts` |
| API9 | Improper Inventory Management | Every route is documented in `REQUIREMENTS.md`, `API_TESTING.md` and the Postman collection with its required role; there are no undocumented or "internal" endpoints. | docs |
| API10 | Unsafe Consumption of APIs | No third-party APIs are consumed. Every admin mutation is written to the audit log as structured JSON (`admin.action`: admin id, method, path, status, time) for monitoring. | `middleware/auth.ts` (`auditAdmin`) |

## Role model

```
customer (default)  → own users/orders/cart/addresses only; read-only catalog
admin               → everything above for every user, /admin/* namespace, catalog writes, role management
```

- Self-registration always yields a `customer`.
- The first admin is created out-of-band with `npm run seed:admin` (reads `ADMIN_USERNAME` / `ADMIN_PASSWORD`, min 12 chars). Re-running promotes an existing account instead of recreating it.
- The access token carries `{ userId, role }`. Customer routes trust the claim for the token's short lifetime; admin routes always verify the role against the database.

## Operational notes

- Set a strong `TOKEN_SECRET`, `BCRYPT_PASSWORD` and `ADMIN_PASSWORD`; never commit `.env`.
- Ship the `admin.action` log lines to your log aggregator and alert on unexpected admin activity.
- Serve the API behind TLS; `trust proxy` is enabled for reverse-proxy deployments so rate limiting sees the real client IP.
