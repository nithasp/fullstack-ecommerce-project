# Backend Review

**Date:** 2026-09-22
**Scope:** `app/backend` at commit `225bdde` (branch `master`)
**Question:** Does the backend follow best practice and common conventions?

## How this was checked

- Read every file in `src/`, all migrations, the Dockerfile, `docker-compose.yml`, `.env.example`, the Jasmine config and the tests.
- Ran `tsc --noEmit` (passes with no errors) and `npm audit --omit=dev`.
- Ran small Node experiments for:
  - how node-pg reads `NUMERIC` and `TIMESTAMP` values
  - the product row mapper with bad input
  - the pepper when `BCRYPT_PASSWORD` is not set
- **Not run:**
  - `npm test`, because it deletes `dist`, which stops a running `npm run watch` server
  - any query against Postgres, because Docker was off

## Short answer

Mostly yes. The structure, the SQL and the login/token design are better than most portfolio backends. I found no SQL injection and no way for one customer to reach another customer's data.

The gaps are in three places:

- the shop rules (orders and checkout)
- some database schema details
- the production setup (config, Docker, logging, lint/CI)

## What already follows best practice

- **Layers and errors:** routes → controllers → repositories/services, all under `/api/v1`, with one response envelope. A single error handler hides the details of 500 errors and turns Postgres errors into 4xx responses.
- **SQL:** every value is a bound parameter. The dynamic `UPDATE`s only insert column names that are written in the code.
- **Auth:**
  - Short-lived JWTs with the algorithm pinned.
  - Refresh tokens stored only as hashes, rotated on use, with reuse detection. This is what the OAuth 2.0 Security Best Current Practice recommends.
  - The admin role is re-checked in the database, `role` is ignored on register, and another user's orders return 404.
- **Hardening:** helmet, a CORS allowlist, a body size limit, rate limits and capped pagination.
- **Project hygiene:** up/down migrations, an OpenAPI spec, about 3,200 lines of tests against a real database, and `strict` TypeScript that compiles with no errors.

## Priority key

| Priority | Meaning |
| --- | --- |
| **Critical** | Can be exploited right now; fix before anything else. |
| **High** | A real bug or security gap that can hurt users, orders or data. |
| **Medium** | Works in normal use, but has an edge-case bug or breaks a common convention. |
| **Low** | Polish; fine to leave in a portfolio project. |

## Summary

| # | Finding | Priority | Effort |
| --- | --- | --- | --- |
| 1 | Leaked `TOKEN_SECRET` and pepper in public git history | Critical | Change 1 variable in Railway, clear 1 table, check admin accounts |
| 2 | Deleting a product or user also deletes past orders | High | 1 migration and changes to 2 routes |
| 3 | Checkout trusts the client and skips price, stock and "active" checks | High | 1 migration and a rewrite of 1 service (about 40 lines) |
| 4 | Customers can rewrite their own order history | High | Guard 3 handlers (or make them admin-only) and update tests |
| 5 | Password change needs no current password; other sessions stay logged in | High | About 10 lines in 2 controllers |
| 6 | Access tokens last 1 day; customer routes trust the role in the token | High | 2 lines in the env files (plus an optional small code change) |
| 7 | One bad product field breaks the catalog | High | About 20 lines in 1 function |
| 8 | Vulnerable packages (11 advisories) | High | 1 command, a bcrypt upgrade, then rerun tests |
| 9 | `TIMESTAMP` columns without time zone | Medium | 1 migration |
| 10 | Missing indexes, `NOT NULL`s and `CHECK`s | Medium | 1 migration (about 15 lines of SQL) |
| 11 | Validation written by hand | Medium | Medium refactor, one resource at a time |
| 12 | Duplicated customer/admin code, thin service layer | Medium | Moderate refactor |
| 13 | Two error response formats | Medium | About 6 lines in 2 files, plus a frontend check |
| 14 | Refresh token can be read by JavaScript | Medium | About 20 lines in the backend, plus the frontend auth service |
| 15 | Config is not validated in one place | Medium | Rewrite `config.ts` (about 40 lines) and use it in 3 files |
| 16 | Password hashing details | Medium | About 20 lines, plus a re-hash plan |
| 17 | No graceful shutdown, almost no logging | Medium | About 15 lines in `server.ts` for shutdown |
| 18 | Dockerfile | Medium | Rewrite about 20 lines |
| 19 | Tests, lint and CI | Medium | Small config change; lint and CI take under 1 hour |
| 20 | A failed address update still changes data | Medium | About 3 lines in 1 file |
| 21 | REST conventions | Low | Breaking API change; do it together with the frontend |
| 22 | Audit log design | Low | Design change |
| 23 | Types that don't match the real data | Low | Type edits in a few files |
| 24 | Small things | Low | Mostly one-line fixes |

**Suggested order:** 1 (if not done yet) → 8 (one command) → 6 (two lines) → 5 → 2 → 3 and 4 → 7. Most of the High items are small.

---

## Critical

### 1. Leaked secrets (only if not fixed yet)

As of 2026-09-22, `TOKEN_SECRET` and the bcrypt pepper from `.env-railway` are still in the public git history (commit `8bc860d`), and rotation hasn't been confirmed. With that secret, anyone can create access tokens that the API accepts, including for admin accounts. Deleting the file in `299d202` did not remove it from history.

*Effort:* change one variable in Railway, clear the `refresh_tokens` table, and check for admin accounts you don't recognise.

## High

### 2. Deleting a product also deletes it from customers' past orders

`order_products.product_id` is `ON DELETE CASCADE` ([migration 004](../app/backend/migrations/sqls/20240101000004-order-products-table-up.sql)), and `DELETE /products/:id` really deletes the row. Deleting a user deletes their orders the same way ([migration 003](../app/backend/migrations/sqls/20240101000003-orders-table-up.sql)).

Shops keep orders as records, so the usual rules are:

- **Products:** `ON DELETE RESTRICT`, and mark products inactive instead of deleting them. The `is_active` column already exists for this.
- **Users:** deactivate or anonymise the account instead of deleting it.

*Effort:* one migration and changes to 2 routes.

### 3. Checkout skips the usual safety steps

In [checkout.service.ts](../app/backend/src/services/checkout.service.ts):

- It orders whatever `items` the client sends, not the server-side cart (which it then empties).
- Order lines store no price, so an order's value is always today's price. Changing a product's price changes every past order.
- `stock` and `is_active` are saved but never checked anywhere. Hidden and out-of-stock products can be bought, and stock never goes down.

The usual pattern is one transaction that:

- reads the cart
- locks the product rows with `SELECT … FOR UPDATE`
- rejects inactive or out-of-stock products
- reduces stock
- saves a `unit_price` on each order line

*Effort:* one migration to add `unit_price`, and a rewrite of the service (about 40 lines).

### 4. Customers can rewrite their own order history

The customer routes let a user:

- create an order that is already `complete`
- switch an order's status back and forth
- add lines to a completed order
- delete a completed order

`/products/popular` counts every order line, so any customer can push any product to the top of that list with one request and a huge `quantity`.

The tests expect this behaviour, so it probably came from the course spec. The normal rule is that only checkout creates completed orders, and customers can't change them afterwards.

*Effort:* make order writes admin-only, or block them when the status is `complete` (3 handlers). Then update the tests.

### 5. Changing a password doesn't ask for the current one, and other sessions stay logged in

This is `PUT /users/:id`. Someone with a stolen access token can set a new password and lock the owner out. Any refresh token they hold keeps working. OWASP ASVS requires both checks. Admin password resets (`PUT /admin/users/:id`) don't end the user's sessions either.

*Effort:* about 10 lines in 2 controllers. `revokeAllSessions` already exists.

### 6. Access tokens last 1 day, and customer routes trust the role inside the token

The local `.env` and `.env.example` set `ACCESS_TOKEN_EXPIRY=1d`; the code default is `15m`. A JWT can't be cancelled, so logout, role changes and password changes can take up to 24 hours to take effect.

Also, `requireSelf` and `isAdmin` in [authorize.ts](../app/backend/src/utils/authorize.ts) read the role from the token. So for up to a day, a demoted admin can still read, edit or delete any user's account and orders through the customer routes. The database check in `requireAdmin` only protects `/admin/*`.

*Effort:* set `15m` in both env files (2 lines). Optionally, make `isAdmin` check the role in the database too.

### 7. One bad product field breaks the catalog

Only `name` and `price` are validated; the other fields are just cast with `as`.

- I ran the row mapper with `types` set to `"oops"`, `{}` or `[null]`. Each one throws, so every `GET /products` page that includes that product returns 500.
- `price: ""` passes the check (`Number("")` is 0) but is saved as `parseFloat("")`, which is `NaN`.

Only admins can send this, but one bad bulk import is enough.

*Effort:* about 20 lines of checks in `parseNewProduct` (or see item 11).

### 8. Vulnerable packages

`npm audit --omit=dev` reports 11 advisories: 1 critical, 7 high, 3 moderate. The ones that matter while the server runs:

- `express-rate-limit`: on dual-stack servers, IPv4-mapped IPv6 addresses can get around the per-IP limit that protects login.
- Denial-of-service bugs in express's `qs`, `body-parser` and `path-to-regexp`.

The critical one (`tar`) only runs during install, through bcrypt 5.

*Effort:* run `npm audit fix` (npm reports no breaking changes), then upgrade bcrypt from 5 to 6 and rerun the tests.

## Medium

### 9. `TIMESTAMP` without time zone

Affects `refresh_tokens`, `cart_items` and `addresses`. (`audit_logs` correctly uses `TIMESTAMPTZ`.)

- node-pg sends dates with your local UTC offset.
- Postgres drops the offset for this column type.
- node-pg reads the value back as local time.

On the dev PC (UTC+7), with the Postgres container on UTC (its default), `createdAt`/`updatedAt` come back 7 hours off, and refresh tokens live 7 hours longer than configured. The node-pg side was tested; the Postgres side comes from its docs, because Docker was off. The Postgres wiki's "Don't Do This" page says to always use `timestamptz`.

*Effort:* one migration.

### 10. Schema gaps

- **Missing indexes:** Postgres doesn't index foreign keys automatically. `orders.user_id`, `order_products.order_id` and `order_products.product_id` have no index, although "my orders" and the popular-products query filter on them.
- **Missing `NOT NULL`:** `orders.user_id`, `orders.status` and both foreign keys in `order_products`.
- **Missing `CHECK`s:** `quantity > 0` on order lines, `price >= 0`, `stock >= 0`.
- **No `created_at` on orders.**
- **Case-sensitive usernames:** `Alice` and `alice` can be two separate accounts.
- **Duplicate index:** `idx_refresh_tokens_token_hash` repeats the index that `UNIQUE` already creates.

*Effort:* one migration, about 15 lines of SQL.

### 11. Validation is written by hand

`utils/validate.ts` is careful, but the checks are spread out and types are cast with `as` instead of checked, which is how item 7 got through. The common TypeScript/Express approach is a schema library like zod. One schema per request body gives you the validation and the TypeScript type together.

*Effort:* a medium refactor. You can do one resource at a time, starting with products.

### 12. Customer and admin code is duplicated, and there's little service layer

- `POST /users` and `POST /admin/users` both create users, with slightly different rules.
- `GET /users` repeats `GET /admin/users`.
- User and address update code is copied, and the copies have already drifted. For example, an empty address update returns 400 for admins but 200 for customers (it only bumps `updated_at`).
- Business rules sit in controllers and repositories. The usual split is: controllers handle HTTP, services hold business rules, repositories hold SQL.

*Effort:* a moderate refactor. An easy first step is removing the admin copies under `/users`.

### 13. Two error formats

`verifyAuthToken` and `authLimiter` return `{ error, code }`, everything else returns `{ status, message, data }`, and `requireAdmin` uses both. Pick one shape: your envelope plus a `code` field, or RFC 9457 Problem Details.

*Effort:* about 6 lines in 2 middleware files, plus the frontend interceptor that reads `code`.

### 14. JavaScript can read the refresh token

The token comes back in the JSON body, and the frontend stores it in `localStorage`, so any XSS bug can steal a 7-day session. The usual pattern for single-page apps is:

- the refresh token in an `HttpOnly; Secure; SameSite=Strict` cookie limited to `/api/v1/auth`
- the access token kept only in memory

*Effort:* about 20 lines in the backend, plus changes to the frontend auth service.

### 15. Config isn't validated in one place

Environment variables are read in 4 files, which causes these problems:

- If `BCRYPT_PASSWORD` is missing, the pepper silently becomes the text `"undefined"` (tested).
- `REFRESH_TOKEN_EXPIRY_DAYS` is documented but never read; 7 days is hard-coded.
- If the app doesn't detect production, it quietly signs tokens with the public `default-secret-for-dev`.
- `database.ts` detects production differently from `config.ts`.

The usual pattern is one config module that is validated at startup and refuses to start when a required value is missing.

*Effort:* rewrite `config.ts` (about 40 lines) and use it in the other files.

### 16. Password hashing details

- The pepper is added after the password, but bcrypt only reads the first 72 bytes, so long passwords get no pepper at all. OWASP's pattern is to HMAC the password with the pepper first, then bcrypt it.
- Login skips bcrypt when the username doesn't exist, so the response time reveals which usernames exist.

Changing the hashing scheme means checking passwords the old way and re-hashing them at the next login. Plan it together with replacing the leaked pepper (item 1).

*Effort:* about 20 lines, plus that migration plan.

### 17. No graceful shutdown and almost no logging

- Nothing handles SIGTERM, so every Railway redeploy cuts off requests in progress and loses queued audit writes. (`flushAuditLog` is only used by the tests.)
- Only 500 errors are logged, and without a request id.

The usual setup is `server.close()` plus `pool.end()` on SIGTERM, and a structured logger such as pino.

*Effort:* about 15 lines for the shutdown handling.

### 18. Dockerfile

Current problems:

- a single build stage
- `npm install` instead of `npm ci`
- dev packages in the final image
- the app runs as root
- `npm` runs as the main process, and it passes stop signals on poorly

The usual setup:

- a multi-stage build with `npm ci --omit=dev` in the final stage
- `USER node`
- `CMD ["node", "dist/server.js"]`
- migrations run as a separate step

*Effort:* rewrite about 20 lines, and remove the `postinstall` script (it's why the Dockerfile needs `npm pkg delete`).

### 19. Tests, lint and CI

- **Test order:** tests must run in a fixed order (`"random": false`), because later tests use ids created by earlier ones.
- **No cleanup and no unit tests:** tests don't clean up after themselves, and there are no unit tests for pure logic like `validate.ts`.
- **No lint or CI:** there's no ESLint/Prettier setup (only `.editorconfig`) and no CI workflow.
- **The `dist` problem:** `npm test` deletes `dist`, which stops a running `npm run watch` server. Running the specs through `ts-node` (installed but unused) would avoid that.

*Effort:* the `dist` fix is a small config change. ESLint, Prettier and a GitHub Actions workflow take under an hour.

### 20. A failed address update still changes data

`PUT /addresses/:id` with `isDefault: true` first clears all of your default flags. If the address id isn't yours, you get a 404, but the transaction still commits, so you're left with no default address ([address.repository.ts:65](../app/backend/src/repositories/address.repository.ts#L65)).

*Effort:* about 3 lines.

## Low

### 21. REST conventions

- Partial updates use `PUT`; the convention is `PATCH`.
- `POST /orders/:id/products` returns 200, while other create routes return 201.
- `/orders/user/:userId/current` and `/orders/user/:userId/completed` repeat `GET /orders?status=`.

Changing these breaks the API, so do it together with the frontend.

### 22. Audit log design

- Page views (analytics) share the table with security events.
- Every signed-in GET request writes a row.
- The rules list in `middleware/audit.ts` is a second copy of the routes, so a new route is silently logged as `api.request`.

### 23. Types that don't match the real data

- `price` is typed as `number`, but node-pg returns it as a string. (The OpenAPI file correctly says string.)
- `Order.status` is `string` instead of `OrderStatus`.
- The cart row mapper needs the cast `as unknown as CartItem`.

### 24. Small things

- The database TLS connection doesn't check the certificate (`rejectUnauthorized: false`).
- docker-compose exposes Postgres (with a known password) and Adminer to your whole network; bind them to `127.0.0.1`.
- Postgres 14 reaches end of life in November 2026.
- `init-db.sh` has a byte-order mark (BOM) before `#!`.
- `"main": "server.ts"` in `package.json` is wrong.
- `.env.example` contains a working admin password.
