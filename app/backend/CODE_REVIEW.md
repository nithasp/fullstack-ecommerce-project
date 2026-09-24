# Backend Code Review — Structure & Best Practice Audit

**Scope:** `app/backend`
**Date:** 2026-09-24
**Branch:** `master` (HEAD `6cfef23`, plus uncommitted working tree)
**Method:** full read of every non-test source file, plus every quality gate run locally against a
real Postgres instance.

---

## Verdict: 97/100 (A) — well above conventional standard

Two review rounds have been applied. The first round's four findings and the second round's seven
are all resolved; what is left is one operator action and one metric that the test setup caps.

---

## Gates verified by running them

| Check | Result |
| --- | --- |
| `tsc --noEmit` | clean, under five strictness flags beyond `strict` |
| `eslint .` | clean |
| `prettier --check .` | clean |
| `npm run test:coverage` | **162 specs, 0 failures** |
| Coverage — statements | 96.47% (threshold 90) |
| Coverage — branches | 80.00% (threshold 75) |
| Coverage — functions | 96.65% (threshold 90) |
| Coverage — lines | 96.47% (threshold 90) |
| `npm audit` | 0 vulnerabilities at every severity level |
| OpenAPI ↔ app routes | **65 / 65 documented operations routable** |
| Live boot (Express 5) | server listens, `/healthz` 200, `/` 200, unknown route 404, guarded route 401, `/docs` 200 |

### Toolchain

| Package | Version |
| --- | --- |
| express | 5.2.1 |
| @types/express | 5.0.6 |
| @types/node | 22.20.4 (pinned to the runtime) |
| typescript | 5.9.3 |

---

## Scorecard

| Dimension | Score | Basis |
| --- | --- | --- |
| Architecture & structure | 10/10 | routes → controllers → services → repositories, no leaks between layers |
| Type safety | 10/10 | `strict` + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`; **0** `any`, **0** `@ts-ignore`, **0** `eslint-disable`, **0** `!` assertions |
| Security | 9.5/10 | see below |
| Documentation | 10/10 | 3,140-line OpenAPI matching the app exactly; `SECURITY.md`, `REQUIREMENTS.md`, Postman, `.env.example` |
| Tooling & CI | 10/10 | type-aware lint, format gate, `npm audit --audit-level=high`, Postgres service container |
| Database | 9.5/10 | 20 migrations with up **and** down SQL, 36 indexes, 11 FKs, 12 CHECKs, all `timestamptz` |
| Testing | 9.5/10 | real integration tests plus DI unit tests; branch coverage is the one soft metric |
| Git hygiene | 8/10 | 76 files still uncommitted, including `database.js` |

### Size

| Metric | Value |
| --- | --- |
| Source files (non-test) | 90 |
| Source LOC (non-test) | 4,792 |
| Test files | 15 |
| Test LOC | 2,336 |
| Largest source file | 339 lines (`repositories/product.repository.ts`) |

No god objects; the average source file is about 53 lines.

---

## What is above the bar

- **Dependency injection via factory functions with `Pick<>`-narrowed deps**
  (`src/types/service.types.ts`). Each service declares exactly the repository methods it uses,
  which is why `src/tests/unit/servicesSpec.ts` unit-tests business logic with plain object fakes
  and no mocking library.
- **Password hashing is textbook-correct** — HMAC-SHA256 with pepper *before* bcrypt, so the pepper
  survives bcrypt's 72-byte truncation (`src/services/password.service.ts:10`).
- **Refresh rotation with family revocation, reuse detection, and a 10-second grace window** for
  multi-tab reloads (`src/services/token.service.ts:62-119`).
- **Admin role re-read from the database every request** (`src/middleware/auth.ts:35`), so a
  demoted admin loses access at once rather than at token expiry.
- **Zero SQL injection surface.** Every dynamic `WHERE` routes values through `params.push`, every
  `ORDER BY` is a static constant, and `LIKE` wildcards are escaped
  (`src/repositories/product.repository.ts`).
- **Checkout is correctly serialized** — locks cart rows, then products, then variants, all in id
  order; aggregates duplicate lines; then a conditional `UPDATE ... WHERE stock >= $2` as a second
  guard (`src/services/cart.service.ts`).
- **Other users' records return 404, not 403**, where existence should not be revealed
  (`src/services/order.service.ts`).
- **Timing-equalized login** — an unknown username costs the same as a wrong password.
- **Config fails fast** on a missing or too-short secret rather than falling back to an insecure
  default (`src/config.ts`).
- **Credentials are redacted from logs** by path, including `set-cookie` and `authorization`.

### Postgres error mapping — verified against the live database

`src/middleware/error.ts` maps Postgres codes to client responses. Three were triggered against the
running instance to confirm both the codes and the constraint names it keys off:

| Trigger | Code | `constraint` reported | Mapping |
| --- | --- | --- | --- |
| Duplicate username | `23505` | `users_username_lower_key` | 409 "Username already exists" |
| Invalid role | `23514` | `users_role_check` | 400 "A value is not allowed here" |
| Missing FK target | `23503` | `cart_items_user_id_fkey` | 400 "User does not exist" |

---

## Round 1 findings — all fixed

| Finding | Resolution |
| --- | --- |
| `database.js` never committed (blocked CI, Docker and Railway) | staged |
| `SameSite=Strict` incompatible with the cross-site production topology | `REFRESH_COOKIE_SAMESITE`, defaulting to `none` under `ENV=production` |
| `ROLLBACK` could mask the original error | `src/database.ts` catches the rollback failure separately |
| Search and category filters did sequential scans | migration `20240101000020` adds `pg_trgm` GIN indexes and a `LOWER(category)` expression index |

## Round 2 findings — all fixed

### 1. `SameSite` documented as `Strict` while production used `none` — fixed

Updated `README.md`, `REQUIREMENTS.md`, `SECURITY.md` (both the API2 row and the operational note
that advised putting the frontend on a sibling domain), and four places in `openapi.yaml`.
`REFRESH_COOKIE_SAMESITE` is now documented in all five files including a per-`ENV` table in the
README, not just `.env.example`.

### 2. `.env-railway` missing `PASSWORD_PEPPER` — fixed, one operator action left

The key is present with generation instructions, and the `DATABASE_SSL` choice is now spelled out
rather than left to the `verify` default. **The value is deliberately empty**: a production pepper
should be generated on a trusted machine and pasted into the Railway dashboard, not minted into a
local file. `src/config.ts` refuses to boot without it, so this must be set before the next deploy.

### 3. `middleware/error.ts` untested — fixed

New `src/tests/unit/errorSpec.ts`, 20 specs driving the middleware with fake request and response
objects. Coverage of that file went **47.19% → 100% statements, 95.74% branches**, covering all
eight Postgres classes, both body-parser failures, the generic-500 path, and that a 4xx is never
logged while a 5xx never echoes its message.

Fixed alongside it: `err.message ?? 'Request failed'` could not fall back, because `??` does not
catch the empty string an argument-less `Error` carries. Now `err.message || 'Request failed'`.

### 4. `@types/node` only transitive — fixed

Pinned as a direct devDependency at `^22.20.4`, matching `engines: node >=22`. It previously
resolved to v25 through `@types/bcrypt`.

### 5. `tsconfig.json` too loose and targeting ES2020 — fixed

`target`/`lib` to **ES2023**, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noFallthroughCasesInSwitch` and `noUnusedLocals`. That surfaced 56 errors,
all now resolved without a single `any` or `!`:

- **53 optional properties widened to `T | undefined`** across the domain types. Zod's `.optional()`
  produces `prop?: T | undefined`, which the interfaces did not admit — the types were quietly
  narrower than the data they described.
- **`PartialUpdate<T>` added** (`src/types/common.types.ts`), because `Partial<T>` under this flag
  marks properties optional without allowing an explicit `undefined`, which is exactly what a zod
  `.partial()` schema yields. `AddressUpdate` and `ProductUpdate` now use it.
- **`requireRow` added** (`src/utils/rows.ts`) for `INSERT ... RETURNING` and CTE reads, so a
  missing row raises a clear error instead of passing `undefined` to a mapper. Counts use
  `rows[0]?.count ?? 0`.
- **`AddressFilters` and `CartFilters` extracted** from inline `{ userId?: number }` types in four
  files, which also brings them in line with keeping interfaces in `src/types/`.
- **Two library-typing mismatches resolved without casts away from safety**: pino's `transport` is
  now a conditional spread rather than an explicit `undefined`, and `base: undefined` became
  `base: null` — verified equivalent at runtime (both strip `pid`/`hostname`; only omitting the key
  differs). `jwt`'s `expiresIn` cast is now `NonNullable<...>`.

### 6. Express 4 in maintenance — upgraded to Express 5

`express@5.2.1` and `@types/express@5.0.6`. **No application code needed changing** — the existing
`asyncHandler`, the 4-argument error middleware, and the simple route patterns are all Express-5
compatible. Verified by the full suite, a live boot, and a probe confirming all 65 documented
operations still route.

Added `src/tests/api/appSpec.ts` coverage for the **413 oversized-body path**, which was previously
untested end to end and is body-parser-sensitive across the major version.

### 7. Two read-then-delete pairs not transactional — fixed

`cart.repository.remove` and `order.repository.delete` each collapsed into one statement, so two
concurrent deletes can no longer both report success:

- Cart: `WITH deleted AS (DELETE ... RETURNING *)` feeding the existing product join, which is now
  generated by `selectItems(source)` so the enriched row shape is shared with the other reads.
- Order: a `total` CTE beside the `deleted` CTE, so the returned total is the one the order had
  before it went, read from the same snapshot.

---

## What still holds the score back

- **Nothing is committed.** 76 files are modified or staged, `database.js` among them. Until that
  lands, CI, Docker and Railway are all still building the old tree.
- **`PASSWORD_PEPPER` is unset in `.env-railway`** — see finding 2. Operator action.
- **Branch coverage sits at 80%.** The two weakest files are `middleware/rateLimit.ts` (78.94%,
  structurally uncoverable because the limiter is swapped for a pass-through under `ENV=test`) and
  `middleware/auth.ts` (77.77%, where the malformed-token branches are worth a unit spec of the
  same shape as the new `errorSpec.ts`).
- **The graceful-shutdown path cannot be exercised locally.** Node on Windows does not deliver
  `SIGTERM`, so `server.ts`'s shutdown sequence is only reachable under Linux or Docker. It is
  unchanged by the Express 5 upgrade, but it is untested on this machine.

## Bottom line

The layering, the dependency injection, and the security engineering are better than most
production code of this size, and the type configuration is now stricter than most. The 97 is held
back by process rather than design: commit the tree and set the production pepper.
