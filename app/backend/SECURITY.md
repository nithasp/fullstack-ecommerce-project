# API Security — OWASP API Security Top 10 (2023) mapping

How the backend addresses each category, and where the relevant code lives (paths are under `src/`).

| # | Risk | What the API does | Where |
| - | ---- | ----------------- | ----- |
| API1 | Broken Object Level Authorization | Every customer route resolves the owner from the **verified token**, never from the request. Another account's id answers `403`, or `404` where the existence of a row should not be revealed (orders, cart items, addresses). An admin token is not a skeleton key here: cross-account work lives under `/admin`, where the role is checked against the database. | `utils/request.ts` (`currentUserId`), `controllers/users.controller.ts` (`requireSelf`), `services/order.service.ts` (`getOwnOrder`), cart and address queries scoped by `user_id` |
| API2 | Broken Authentication | Passwords are hashed with bcrypt over an HMAC-SHA256 of the password and a pepper, so the pepper survives bcrypt's 72-byte input limit; the cost and the pepper are configurable and validated at startup. An unknown username costs the same as a wrong password, so timing does not reveal which accounts exist. Access tokens are short-lived JWTs (15 min) with the algorithm pinned to HS256 and accepted only with the `Bearer` scheme. Refresh tokens are opaque random values, stored **hashed**, rotated in one atomic step, and kept in an HttpOnly cookie scoped to `/api/v1/auth`, so a script on the page cannot read a session. Its `SameSite` follows the deployment — `None` with `Secure` under `ENV=production`, where the frontend and the API are on different sites, and `Strict` otherwise; `REFRESH_COOKIE_SAMESITE` overrides it, and `none` is refused unless `ENV=production` so the cookie is never sent without `Secure`. Each login starts a token *family*: presenting a token that was already exchanged revokes the family and records `auth.refresh_token_reuse`. Changing a password takes the current one and ends every other session; an admin reset, a role change and closing an account end them too. Login, register and refresh are rate limited. | `services/password.service.ts`, `services/token.service.ts`, `repositories/refreshToken.repository.ts`, `utils/refreshCookie.ts`, `middleware/auth.ts`, `middleware/rateLimit.ts` |
| API3 | Broken Object Property Level Authorization | Responses never include the password hash: the `PublicUser` shape has no password field, and queries select `SAFE_FIELDS` only. Every request body goes through a zod schema that keeps the fields it names and drops the rest, so a `role` or an `isAdmin` in the body is simply not there afterwards. The role is set only by `POST /admin/users` or `PUT /admin/users/:id/role`, and a password only by its own routes. Cart rows take their price, option and shop from the product, never from the request. | `schemas/`, `utils/validation.ts`, `types/user.types.ts`, `services/cart.service.ts` |
| API4 | Unrestricted Resource Consumption | Global per-IP rate limit (`API_RATE_LIMIT`, default 500 / 15 min) plus the stricter auth limit; JSON bodies capped (`JSON_BODY_LIMIT`, default 1 MB). Every list that can grow is paginated with `limit` ≤ 100 and a validated `offset`; filters are capped at 100 characters, bulk import at 500 products, cart quantities at 999. Database pooling is bounded and an idle-client error cannot take the process down. | `app.ts`, `middleware/rateLimit.ts`, `schemas/common.schema.ts`, `database.ts` |
| API5 | Broken Function Level Authorization | Two roles, `customer` and `admin`. Every admin function lives under `/admin`, and the guard is attached to that router itself, so it covers exactly that namespace. `requireAdmin` **re-reads the role from the database** on every request, so a demoted, closed or deleted admin is blocked at once rather than at token expiry. The role claim inside the token is used for describing a request in the audit log, never for deciding access. Changing a role ends that account's sessions; admins cannot change their own role or close their own account through the admin API. | `middleware/auth.ts` (`requireAdmin`), `routes/admin/index.ts`, `services/user.service.ts` |
| API6 | Unrestricted Access to Sensitive Business Flows | Checkout is the only way a customer creates an order, and orders are read-only for customers afterwards — a customer cannot mark an order complete, add lines to one or delete it. Checkout itself takes quantities from the cart, prices and stock from the product, holds a row lock while it charges, and refuses in full when anything no longer adds up. The popular list counts completed orders only, so no one can promote a product by placing orders. Account creation and login are rate limited. | `routes/orders.routes.ts`, `services/cart.service.ts` (`checkout`), `repositories/product.repository.ts` (`mostPopular`) |
| API7 | Server Side Request Forgery | The API makes no outbound requests based on user input (image fields are stored as plain strings and never fetched). | — |
| API8 | Security Misconfiguration | The environment is validated once at startup and the process refuses to run without a usable `TOKEN_SECRET`, `PASSWORD_PEPPER` and database configuration — there is no insecure fallback. `helmet` sets security headers; CORS is limited to `ALLOWED_ORIGIN`; TLS to the database is configurable and verifies the certificate unless told otherwise. Unexpected errors return a generic `500` and are logged with a request id (no stack traces, SQL or paths in responses); malformed or oversized JSON gets a clean `400`/`413`; values the database rejects get a `409`/`400` with a fixed message; unknown routes get a JSON `404`. All queries are parameterized. The image runs as an unprivileged user with no compiler or dev dependencies, and the server shuts down gracefully on SIGTERM. | `config.ts`, `app.ts`, `utils/response.ts`, `database.ts`, `server.ts`, `Dockerfile` |
| API9 | Improper Inventory Management | The API is versioned under `/api/v1`. Every route is documented in `openapi.yaml` (checked against the running app), `REQUIREMENTS.md`, `API_TESTING.md` and the Postman collection, with the role it needs; there are no undocumented or "internal" endpoints. Lint, type-check, formatting and the test suite run in CI on every push. | `openapi.yaml`, `.github/workflows/backend.yml` |
| API10 | Unsafe Consumption of APIs | No third-party APIs are consumed. For monitoring, security-relevant events are written to `audit_logs`: every write by a signed-in user, admin reads of account data, logins, failed logins (with the username tried), logouts, registrations and replayed refresh tokens — each with who, when, route, status, IP, browser and small non-secret details (never a password, a token or a whole request body). Analytics live apart in `page_views`, reported by the browser, so a client can leave them out or make them up; the audit entries are the ones to trust. Admins read both at `GET /admin/audit-logs` and `GET /admin/page-views`; no route edits or deletes an entry. Rows are written after the response is sent, so recording never slows or fails a request, and pending writes are flushed on shutdown. | `middleware/audit.ts`, `services/audit.service.ts`, `services/pageView.service.ts`, `repositories/auditLog.repository.ts`, `repositories/pageView.repository.ts` |

## Data the schema protects

- Order lines keep the price charged (`unit_price`), so changing a product's price never rewrites
  what a customer paid.
- `orders.user_id` and `order_products.product_id` are `ON DELETE RESTRICT`, so no delete can
  quietly erase order history. Products are archived (`is_active = false`), and closing an
  account scrubs its personal data while the row and its orders stay.
- Every timestamp column is `timestamptz`, so a row means the same instant whatever time zone the
  app and the database run in.
- Usernames are unique case-insensitively, so `Alice` and `alice` cannot be two accounts.

## Role model

```
customer (default)  → own account, orders, cart and addresses; read-only catalog
admin               → the /admin namespace: every account, the catalog, orders, carts,
                      addresses, the audit log and page views
```

- Self-registration always yields a `customer`.
- The first admin is created out-of-band with `npm run seed:admin` (reads `ADMIN_USERNAME` /
  `ADMIN_PASSWORD`, min 12 chars). Re-running promotes an existing account instead of recreating it.

## Operational notes

- Set a strong `TOKEN_SECRET` and `PASSWORD_PEPPER`, and keep them out of Git: `.gitignore`
  ignores every `.env*` file except `.env.example`.
- If `TOKEN_SECRET` leaks, rotate it — every access token becomes invalid at once. Refresh tokens
  are not signed with it, so also run `DELETE FROM refresh_tokens;` to end every session, then
  check for admin accounts you don't recognise and read the audit log for admin activity you
  can't account for.
- `PASSWORD_PEPPER` is part of every stored hash. Rotating it is a planned migration: keep the old
  value in `BCRYPT_PASSWORD`, and each account moves to the new pepper the next time it signs in.
- Watch the audit log for bursts of `LOGIN_FAILED` entries (password guessing), `403`s from one
  account (probing other accounts) and any `SECURITY` entry.
- Serve the API behind TLS, and set `TRUST_PROXY` to the number of proxies in front of it so the
  rate limiter and the audit log record the real client IP.
- The refresh cookie is `SameSite=None; Secure` under `ENV=production`, because the frontend and the
  API are served from different sites and a `Strict` cookie would never reach `/auth/refresh` — the
  session could not be renewed. `Path=/api/v1/auth` keeps it off every other route and `HttpOnly`
  keeps it away from scripts. If you move the frontend onto a domain next to the API's, e.g.
  `store.example.com` and `api.example.com`, set `REFRESH_COOKIE_SAMESITE=strict` to tighten it.
