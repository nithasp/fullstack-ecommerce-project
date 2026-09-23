# Backend Review

**Date:** 2026-09-23
**Scope:** `app/backend` working tree: commit `225bdde` plus the uncommitted refactor (most of `src/`, migrations 13–17, the ESLint and Prettier config, and the CI workflow in `.github/workflows/backend.yml`)
**Question:** Does the backend follow conventional standards and best practice, and what score does it get?
**Previous review:** [BACKEND_REVIEW.md](BACKEND_REVIEW.md) (2026-09-22, 24 findings). See [Progress since the 2026-09-22 review](#progress-since-the-2026-09-22-review).

> **Update, later on 2026-09-23:** items 4 to 9 below have since been fixed, and item 10 was
> deliberately left alone. Items 1 to 3 are still open, and all three are Railway settings rather
> than code. The score above describes the state *before* those fixes.

## Short answer

**81 / 100. Mostly yes.** The backend uses the standard Express + TypeScript layout and follows most current best practice. It's well above a typical portfolio backend.

The lost points come from consistency, the data model, and three problems that will break production if the current changes are deployed as-is (items 1–3).

Almost everything reviewed here is uncommitted, including the CI workflow, so CI hasn't run on any of it yet.

## How this was checked

- Read all 81 source files in `src/`, plus the test suite (5 test files in full, the other 8 by test name).
- Read all 17 up migrations and the down migrations for 13–17, plus the Dockerfile, `docker-compose.yml`, `railway.json`, `database.json`, `.env.example` and the CI workflow.
- Read the frontend's auth and cart code where it depends on how the API behaves.
- Compared the secrets in `.env-railway` with commit `8bc860d` without printing either.
- Ran every check:

| Check | Result |
| --- | --- |
| Type check (`tsc --noEmit`) | Clean |
| Lint (`eslint .`) | Clean |
| Formatting (`prettier --check .`) | Clean |
| Tests (`npm test`) | 125 passed, 0 failed (random order, real Postgres) |
| Known vulnerabilities (`npm audit --omit=dev`) | 0 |

**Not checked:**

- the live Railway variables (only the local `.env-railway`)
- the app in a real browser
- the Markdown guides line by line (the documentation score rests mainly on the OpenAPI spec, which was checked against every route)

## Score breakdown

Each area is scored out of 10 and weighted. Hosting settings (items 1 and 3) aren't counted, because they're about the Railway setup, not the code.

| Area | Weight | Score | Why |
| --- | --- | --- | --- |
| Structure and layering | 15% | 8.5 | Standard routes → controllers → services → repositories; a few pieces in the wrong layer |
| Code quality and consistency | 15% | 7.5 | Strict TypeScript, no `any`; some rules written in several places, two repository styles |
| API design | 10% | 8.0 | Versioned, one response format, capped page sizes, OpenAPI covers all 38 paths |
| Security | 20% | 8.5 | Excellent login-token handling and hardening; the refresh-cookie setting doesn't fit your hosting |
| Database and data access | 15% | 7.5 | Strong constraints, row locking, migrations that really undo; product options stored as JSON, cart can show a stale price |
| Testing | 10% | 8.0 | 125 tests against a real database, including attack cases; no coverage report or concurrency tests |
| Tooling, CI and deployment | 10% | 8.0 | Good Dockerfile and CI; no health check that tests the database |
| Documentation | 5% | 9.0 | OpenAPI + Swagger UI, Postman collection, guides |
| **Overall** | | **8.1** | **81 / 100** |

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
| 1 | The leaked `TOKEN_SECRET` still appears to be in use | Critical | Change 1 variable in Railway, clear 1 table, check the audit log |
| 2 | The refresh cookie won't work between Vercel and `proxystack.dev` | High | A custom domain in Vercel and 1 DNS record (about 15 minutes) |
| 3 | Railway variables don't fit the new code | High | Set 3 variables in Railway, plus a health check of about 10 lines |
| 4 | The cart can show a different price from the one checkout charges | Medium | **Fixed** |
| 5 | Two tabs refreshing at once log the user out everywhere | Medium | **Fixed** |
| 6 | Product options and reviews are stored as JSON | Medium | **Fixed** for options; reviews left as JSON on purpose |
| 7 | Orders don't record a shipping address | Medium | **Fixed** |
| 8 | Some code sits in unusual places | Low | **Fixed** |
| 9 | Consistency and duplication | Low | **Fixed** |
| 10 | Smaller items | Low | Left as it is, by choice |

**Suggested order:** 1 now → 2 and 3 before the next deploy. Items 4 to 9 are done.

---

## Critical

### 1. The leaked `TOKEN_SECRET` still appears to be in use

- The local `.env-railway` still has the same `TOKEN_SECRET` as public commit `8bc860d`. The same is true of `BCRYPT_PASSWORD`, which is now only the old pepper.
- The secret is longer than 32 characters, so the new startup check accepts it.
- Admin checks look up the role by user id. Anyone with the secret can sign a token carrying your admin's id and get full admin access.
- Ignore this if you already changed it directly in Railway.

*Effort:* set a new `TOKEN_SECRET` in Railway, run `DELETE FROM refresh_tokens;` in production, and check `audit_logs` for admin actions you don't recognise. Because of the earlier clipboard-malware incident on this PC, don't copy the new secret through the clipboard; piping a generated value straight into `railway variables --set` avoids it.

## High

### 2. The refresh cookie won't work between Vercel and `proxystack.dev`

- Refresh now depends on a `SameSite=Strict` cookie ([config.ts:119](../app/backend/src/config.ts#L119)).
- The frontend runs on `*.vercel.app` (the `ALLOWED_ORIGIN` in `.env-railway`) and the API on `ntstore-api.proxystack.dev`. Browsers treat those as different sites.
- Browsers don't send a Strict cookie on requests to a different site, and Chrome won't even save it.
- The frontend calls `/auth/refresh` on every page load, because the access token lives only in memory ([auth.service.ts:40](../app/frontend/src/app/core/services/auth/auth.service.ts#L40)). So **every reload would log users out**.
- The backend tests can't catch this, because the test client doesn't apply browser cookie rules.

**Fix:** serve the frontend from a `proxystack.dev` subdomain, such as `ntstore.proxystack.dev`. Both are then the same site, so only `ALLOWED_ORIGIN` changes; no code does. Don't switch to `SameSite=None`: Safari blocks third-party cookies by default.

*Effort:* a custom domain in Vercel plus one DNS record, about 15 minutes. If the frontend already runs on a `proxystack.dev` domain, ignore this item.

### 3. Railway variables don't fit the new code

Compared with the local `.env-railway`:

- **`PASSWORD_PEPPER` is missing.** It's now required ([config.ts:28](../app/backend/src/config.ts#L28)), so the server will refuse to start. Use a fresh value, not the leaked `BCRYPT_PASSWORD`. Keep `BCRYPT_PASSWORD` until every active account has logged in once, because each login re-hashes the password under the new pepper.
- **`DATABASE_SSL` isn't set.** The app now verifies the database certificate by default ([config.ts:74](../app/backend/src/config.ts#L74)); the committed code skipped that check (`rejectUnauthorized: false`). If Railway's certificate is self-signed, the deploy looks green, because migrations still skip the check in `database.json`, but every API query fails. Set it explicitly: `no-verify`, or give the CA in `DATABASE_SSL_CA`.
- **`ACCESS_TOKEN_EXPIRY=1d` overrides the code's 15-minute default** ([config.ts:25](../app/backend/src/config.ts#L25)). An access token can't be cancelled, so a stolen one keeps working for up to a day after logout, a password change or account closing. Set `15m`.
- **Nothing checks the database before traffic arrives.** `/` returns a fixed message ([app.ts:50](../app/backend/src/app.ts#L50)), so Railway would send traffic to a deploy that can't reach the database.

*Effort:* set 3 variables in Railway. Add a `/health` route that runs `SELECT 1` (about 10 lines) and `"healthcheckPath": "/health"` in `railway.json` (1 line).

## Medium

### 4. The cart can show a different price from the one checkout charges

- When an item goes into the cart, the chosen option is saved as a JSON copy ([cart.repository.ts:139](../app/backend/src/repositories/cart.repository.ts#L139)).
- The frontend totals the cart from that copy's price ([cart.service.ts:296](../app/frontend/src/app/core/services/cart/cart.service.ts#L296)).
- Checkout charges the current option price ([cart.service.ts:137](../app/backend/src/services/cart.service.ts#L137)).
- If an admin changes an option's price, the customer sees the old total and pays the new one.

*Effort:* about 5 lines. Build `selectedType` from the live product options by `type_id`; the `selected_type` column can be dropped later.

### 5. Two tabs refreshing at once log the user out everywhere

- Each tab refreshes on load with the same cookie.
- The second request looks like a stolen token, so the whole session is revoked ([token.service.ts:76-88](../app/backend/src/services/token.service.ts#L76-L88)), and a false `SECURITY` entry is written to the audit log.
- This happens whenever someone reopens a browser that had two or more store tabs.
- Auth0 and Okta handle this with a short grace period: a token reused within about 30 seconds gets a fresh pair in the same session instead of revoking it.

*Effort:* about 10 lines plus a test. The alternative is to let only one tab refresh at a time, using the Web Locks API in the frontend.

### 6. Product options and reviews are stored as JSON

`types`, `reviews` and `preview_img` are JSON columns in `products`. The conventional design uses separate `product_variants` and `reviews` tables. Today:

- Order lines and cart rows can't point at an option with a foreign key.
- Stock is tracked twice, per product and per option, and checkout reduces both ([cart.service.ts:129-143](../app/backend/src/services/cart.service.ts#L129-L143)), so the two counts can drift apart.
- Every stock change rewrites the product's whole options document.

*Effort:* the largest item here: 1 migration plus changes to the product, cart and checkout code. The API responses can stay the same.

### 7. Orders don't record a shipping address

- Addresses exist but are never linked to an order.
- Checkout takes only cart item ids ([cart.schema.ts:25](../app/backend/src/schemas/cart.schema.ts#L25)) and marks the order `complete` straight away ([cart.service.ts:153](../app/backend/src/services/cart.service.ts#L153)).
- The usual approach is to copy the chosen address onto the order and use statuses like pending → paid → shipped / cancelled.

*Effort:* 1 migration, an `addressId` field in checkout, and an address picker in the frontend.

## Low

### 8. Some code sits in unusual places

- The error class, the error-handling middleware and the Postgres error mapping all live in [utils/response.ts](../app/backend/src/utils/response.ts). The usual split is `utils/errors.ts` and `middleware/error.ts`.
- [middleware/auth.ts:44](../app/backend/src/middleware/auth.ts#L44) reads the user repository directly instead of going through the service.
- [product.repository.ts:6](../app/backend/src/repositories/product.repository.ts#L6) and [address.repository.ts:4](../app/backend/src/repositories/address.repository.ts#L4) import input types from `schemas/`, so the database layer depends on request validation. [user.repository.ts:4](../app/backend/src/repositories/user.repository.ts#L4) does it the usual way, with types from `types/`.
- `requestSource(req)` is an Express helper, but it lives in [audit.service.ts:25](../app/backend/src/services/audit.service.ts#L25).
- Three controllers define validation schemas inline ([orders.controller.ts:11](../app/backend/src/controllers/orders.controller.ts#L11), [admin/carts.controller.ts:11](../app/backend/src/controllers/admin/carts.controller.ts#L11), [admin/addresses.controller.ts:11](../app/backend/src/controllers/admin/addresses.controller.ts#L11)), and `userIdFilter` appears twice.
- [docs.routes.ts](../app/backend/src/routes/docs.routes.ts#L66-L302) holds about 240 lines of CSS inside a string. It should be a static file.

*Effort:* about an hour of moving code, with no behavior change.

### 9. Consistency and duplication

- The maximum quantity (999) is written in three places: [cart.schema.ts:4](../app/backend/src/schemas/cart.schema.ts#L4), [order.schema.ts:23-30](../app/backend/src/schemas/order.schema.ts#L23-L30) and the SQL in [cart.repository.ts:68](../app/backend/src/repositories/cart.repository.ts#L68).
- The "turn text into a number" step is rewritten in three schema files instead of reusing `asNumber` from [common.schema.ts:10](../app/backend/src/schemas/common.schema.ts#L10).
- `clip()` is copied in two repositories, and the same paging code (`Promise.all([index, count])`) repeats in seven services.
- There are two repository styles: `auditLog` and `refreshToken` use private methods, the others use module-level functions.
- Only some repository methods accept a transaction client, so not every query can join a transaction.
- Money has three types (`string`, `number`, `string | number`), and the checkout total is computed with floating-point math in JavaScript ([cart.service.ts:161-166](../app/backend/src/services/cart.service.ts#L161-L166)) instead of in SQL.
- An empty string stands in for "no option" in `cart_items.type_id`. Postgres 15+ (you run 17 locally) can handle that directly with `UNIQUE NULLS NOT DISTINCT`.
- `TestAdmin`, `TestCustomer` and `TestRequest` in [test.types.ts](../app/backend/src/types/test.types.ts) are no longer used.

*Effort:* small edits, each independent of the others.

### 10. Smaller items

- Express 5 has been the default npm release since 2025. It catches async errors on its own, so `asyncHandler` could go.
- The database doesn't enforce "one default address per user"; a partial unique index would.
- The connection pool has no connection or statement timeouts.
- If `ROLLBACK` itself fails, `withTransaction` loses the original error and returns the broken connection to the pool ([database.ts:29-34](../app/backend/src/database.ts#L29-L34)).
- The audit log matches failed logins to accounts by exact letter case ([auditLog.repository.ts:16](../app/backend/src/repositories/auditLog.repository.ts#L16)), but login ignores case.
- There's no coverage report, and no test for two checkouts racing for the last item in stock.
- Guests can't browse the catalog ([products.routes.ts:8](../app/backend/src/routes/products.routes.ts#L8)). Most stores allow it, but that's a product decision.

*Effort:* mostly a few lines each.

## What already follows best practice

- **Structure:** the standard layer split, plus `schemas/` (Zod), `types/` and `config.ts`. `app.ts` is separate from `server.ts` so tests can load the app. Every interface is in `types/`, and controllers are 3–5 lines each.
- **Security:**
  - Settings are checked at startup with Zod, and secrets must be at least 32 characters.
  - Access tokens are locked to one signing algorithm and default to 15 minutes (but see item 3).
  - Refresh tokens are stored hashed and replaced on every use; reusing an old one revokes the whole session.
  - The admin role is re-read from the database on each request.
  - A wrong username takes as long as a wrong password, so attackers can't tell which accounts exist.
  - Passwords get an HMAC pepper before bcrypt and are re-hashed on login.
  - The usual hardening is in place: helmet, a CORS allowlist, a request size limit, rate limits and redacted logs.
- **Correctness:** checkout runs in one transaction and locks rows in id order. Prices always come from the server. Another user's data returns 404.
- **Database:** migrations only move forward, and their down scripts really undo them, including the data move in migration 17. The schema has solid constraints, order lines keep the price paid, and closed accounts are anonymized rather than deleted. Timestamps store the time zone, and old audit rows and page views are purged automatically.
- **Operations:** a multi-stage Docker image that runs as a non-root user. Shutdown waits for pending audit writes, and request logs carry a request id. Migrations run before each deploy, and CI checks lint, formatting, types and tests.
- **Documentation:** the OpenAPI spec covers all 38 API paths, with Swagger UI at `/docs`, a Postman collection, and guides for Docker, API testing and security.

## Progress since the 2026-09-22 review

22 of the 24 earlier findings are fixed, 1 is partly fixed, and 1 is still open.

| # | Finding (2026-09-22) | Status now |
| --- | --- | --- |
| 1 | Leaked secrets in public git history | **Open**: see item 1 |
| 2 | Deleting a product or user deletes past orders | Fixed: products are archived, order history uses `RESTRICT`, closed accounts are anonymized |
| 3 | Checkout trusts the client | Fixed: one locked transaction, prices from the server, stock and "on sale" checks |
| 4 | Customers can rewrite their order history | Fixed: customer order routes are read-only, and "popular" counts only completed orders |
| 5 | Password change doesn't need the current password | Fixed: the current password is required and other sessions end |
| 6 | 1-day access tokens; role read from the token | **Partly fixed**: the role now comes from the database, but `.env-railway` still sets `1d` (item 3) |
| 7 | One bad product field breaks the catalog | Fixed: Zod checks input, and row mappers tolerate bad JSON |
| 8 | Vulnerable packages | Fixed: 0 advisories |
| 9 | `TIMESTAMP` without time zone | Fixed: migration 16 |
| 10 | Missing indexes, `NOT NULL`s and `CHECK`s | Fixed: migrations 13–16 |
| 11 | Validation written by hand | Fixed: Zod schemas |
| 12 | Duplicated code, thin service layer | Fixed: one service layer shared by customer and admin routes |
| 13 | Two error formats | Fixed: one response format with a `code` |
| 14 | Refresh token readable by JavaScript | Fixed: HttpOnly cookie, but see item 2 |
| 15 | Config not validated in one place | Fixed: `config.ts` checked with Zod at startup |
| 16 | Password hashing details | Fixed: HMAC pepper, equal timing, re-hash on login |
| 17 | No graceful shutdown, little logging | Fixed: shutdown handler and pino |
| 18 | Dockerfile | Fixed: multi-stage, `npm ci`, non-root, `node` as the main process |
| 19 | Tests, lint and CI | Fixed: random order, unit tests, tests run through tsx so `dist` is untouched, ESLint, Prettier and a CI workflow (not yet committed) |
| 20 | A failed address update still changes data | Fixed: the ownership check runs first, inside the transaction |
| 21 | REST conventions | Fixed: `PATCH` for partial updates, 201 on create, duplicate routes removed |
| 22 | Audit log design | Fixed: page views have their own table and unnamed reads aren't logged; the rules table stays central, as you chose |
| 23 | Types that don't match the data | Fixed: money as `string`, `OrderStatus`, explicit row mappers |
| 24 | Small things | Fixed: certificate check configurable, ports bound to `127.0.0.1`, local Postgres 17, no byte-order mark, correct `main`, no password in `.env.example` |
