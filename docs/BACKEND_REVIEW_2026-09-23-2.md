# Backend Review

**Date:** 2026-09-23 (second review of the day)
**Scope:** `app/backend` working tree: commit `1e85dfa` ("harden the API and rebuild its data model") plus 68 uncommitted changes across `src/`, the migrations, the Dockerfile and the ESLint config
**Question:** Does the structure and the code match conventional standards and best practice, and what score does it get?
**Previous review:** [BACKEND_REVIEW_2026-09-23.md](BACKEND_REVIEW_2026-09-23.md) (81 / 100, commit `225bdde`). See [Progress since the last review](#progress-since-the-last-review).

## Short answer

**90 / 100. Yes.** The layering is textbook and it actually holds under inspection, the type discipline is near-perfect, and the security work is well past what a portfolio backend normally shows. Every check passes.

The nine points that are still missing are almost entirely operational plumbing — a health check, a coverage number, a dependency-scan step in CI — rather than code quality. Two of the three findings carried over from the last review are Railway settings, not code.

## How this was checked

- Read every file in `src/` (96 TypeScript files, about 4,500 lines of production code excluding tests), plus `package.json`, both `tsconfig` files, the ESLint config, the Dockerfile, `docker-compose.yml`, `railway.json`, `database.json`, `.env.example`, the Jasmine config and the CI workflow.
- Checked the layer boundaries mechanically rather than by eye: searched for controllers importing repositories, routes importing services or repositories, repositories importing services, and Express types leaking into services or repositories.
- Counted the escape hatches: `any`, `ts-ignore`, `ts-expect-error`, `eslint-disable`, stray `console.`.
- Compared the 60 registered route handlers against the OpenAPI spec.
- Ran every check:

| Check | Result |
| --- | --- |
| Type check (`tsc --noEmit`) | Clean |
| Lint (`eslint .`) | Clean |
| Formatting (`prettier --check .`) | Clean |
| Tests (`npm test`) | **132 passed, 0 failed** (random order, seed 49285, real Postgres) |
| Known vulnerabilities (`npm audit`) | 0, including dev dependencies |

**Not checked:**

- the live Railway variables (only the local `.env-railway`)
- the app in a real browser
- the Markdown guides line by line

## Score breakdown

Same areas and weights as the last review, so the two are directly comparable. Hosting settings aren't counted, because they're about the Railway setup rather than the code.

| Area | Weight | Score | Previous | Why |
| --- | --- | --- | --- | --- |
| Structure and layering | 15% | 9.5 | 8.5 | Strict routes → controllers → services → repositories, with **zero** boundary violations found; admin split into its own namespace |
| Code quality and consistency | 15% | 9.5 | 7.5 | No `any`, no suppressions, no stray `console`; every interface in `types/`; largest file 337 lines |
| API design | 10% | 9.0 | 8.0 | Versioned, one response envelope, capped page sizes, OpenAPI covers all 39 paths / 64 operations |
| Security | 20% | 9.0 | 8.5 | Token rotation with reuse detection, peppered bcrypt, role read from the database per request; the open items are hosting-side |
| Database and data access | 15% | 9.0 | 7.5 | Product options now relational, row locking at checkout, 19 migrations each with a working down |
| Testing | 10% | 8.0 | 8.0 | 132 tests against a real database, including attack cases; still no coverage report and no unit tier for service logic |
| Tooling, CI and deployment | 10% | 8.0 | 8.0 | CI runs four checks and they all pass; still no health check that touches the database, and no dependency scan in CI |
| Documentation | 5% | 9.0 | 9.0 | OpenAPI + Swagger UI, Postman collection, guides; the review files clutter the package root |
| **Overall** | | **8.95** | 8.1 | **90 / 100** |

## Priority key

| Priority | Meaning |
| --- | --- |
| **Critical** | Can be exploited right now; fix before anything else. |
| **High** | A real bug or gap that can hurt users, orders or data, or that breaks a deploy. |
| **Medium** | Works in normal use, but has an edge-case problem or breaks a common convention. |
| **Low** | Polish; fine to leave in a portfolio project. |

## Summary

| # | Finding | Priority | Effort |
| --- | --- | --- | --- |
| 1 | The leaked `TOKEN_SECRET` is still in the local `.env-railway` | Critical | Change 1 variable in Railway, clear 1 table, check the audit log |
| 2 | Nothing checks the database before Railway sends traffic | High | About 10 lines of code plus 1 line of config — roughly half an hour |
| 3 | Migrations connect with certificate checking switched off | High | Edit 1 line in `database.json` — a few minutes |
| 4 | The refresh cookie still won't work between Vercel and `proxystack.dev` | High | A custom domain in Vercel and 1 DNS record — about 15 minutes |
| 5 | No coverage report | Medium | Add `c8` and one script line — about 10 minutes |
| 6 | CI never runs `npm audit` | Medium | 3 lines in the workflow — about 10 minutes |
| 7 | Service logic can only be tested with a live database | Medium | Constructor injection across 8 services — about a day, and genuinely optional |
| 8 | Jasmine looks for helpers in a folder that doesn't exist | Low | Delete or correct 1 line |
| 9 | Review files sit in the package root | Low | Move 3 files — a minute |
| 10 | No source maps in the production build | Low | 1 line in `tsconfig.json` |
| 11 | A crash outside a request handler isn't logged | Low | About 8 lines in `server.ts` |

**Suggested order:** 1 now → 2, 3 and 4 before the next deploy → 5 and 6 whenever you next touch CI. The rest are optional.

---

## Critical

### 1. The leaked `TOKEN_SECRET` is still in the local `.env-railway`

Carried over from the last review, and still true today.

- `.env-railway` is correctly **untracked** now — `git ls-files` doesn't know it — so it is no longer being pushed. That part is fixed.
- The file on disk still holds the same `TOKEN_SECRET` that reached the public repository.
- Admin checks look up the role by user id ([middleware/auth.ts:44](../app/backend/src/middleware/auth.ts#L44)), so anyone holding that secret can sign a token carrying your admin's id and get full admin access.
- Ignore this if you have already changed it directly in Railway.

_Effort:_ set a new `TOKEN_SECRET` in Railway, run `DELETE FROM refresh_tokens;` in production, and check `audit_logs` for admin actions you don't recognise. Because of the earlier clipboard-malware incident on this PC, don't move the new secret through the clipboard; pipe a generated value straight into `railway variables --set`.

## High

### 2. Nothing checks the database before Railway sends traffic

- `/` returns a fixed message ([app.ts:50](../app/backend/src/app.ts#L50)) and answers 200 even when Postgres is completely unreachable. `appSpec.ts` calls it "the health check", but it doesn't check anything.
- `railway.json` has no `healthcheckPath`, and the Dockerfile has no `HEALTHCHECK` line.
- So a deploy that cannot reach the database still looks green, and traffic is sent to it.

**Fix:** add a `/healthz` route that runs `SELECT 1` through the pool and returns 503 when it fails, then set `"healthcheckPath": "/healthz"` in `railway.json`.

_Effort:_ about 10 lines of code and 1 line of config — roughly half an hour including a test.

### 3. Migrations connect with certificate checking switched off

- The app verifies the database certificate by default when `DATABASE_URL` is set ([config.ts:74](../app/backend/src/config.ts#L74)).
- `db-migrate` does not: `database.json` pins `"ssl": { "rejectUnauthorized": false }` for production ([database.json:14](../app/backend/database.json#L14)).
- `railway.json` runs `npm run migrate:prod` as a pre-deploy command, so the weakest link in the TLS chain is the step that runs first, with the widest privileges.
- It also hides a misconfiguration: if `DATABASE_SSL` is wrong, migrations still succeed and only the API fails.

**Fix:** drive `database.json` from `DATABASE_SSL` the same way `config.ts` does, or at minimum make the two match deliberately.

_Effort:_ a few minutes.

### 4. The refresh cookie still won't work between Vercel and `proxystack.dev`

Carried over from the last review; unchanged in code.

- Refresh depends on a `SameSite=Strict` cookie ([config.ts:119](../app/backend/src/config.ts#L119)).
- The frontend runs on `*.vercel.app` and the API on `ntstore-api.proxystack.dev`. Browsers treat those as different sites, won't send a Strict cookie across them, and Chrome won't even save it.
- The frontend calls `/auth/refresh` on every page load, so **every reload would log users out**.
- The backend tests can't catch this: the test client doesn't apply browser cookie rules.

**Fix:** serve the frontend from a `proxystack.dev` subdomain. Both are then the same site and only `ALLOWED_ORIGIN` changes. Don't switch to `SameSite=None` — Safari blocks third-party cookies by default.

_Effort:_ a custom domain in Vercel plus one DNS record, about 15 minutes. Ignore if the frontend already runs on a `proxystack.dev` domain.

## Medium

### 5. No coverage report

132 passing tests is substantial, but nothing measures what they miss, so there's no way to tell whether the checkout race path or the token-rotation grace window are actually exercised, or whether an untested branch has crept in.

_Effort:_ add `c8` and a `test:coverage` script — about 10 minutes. It turns "lots of tests" into a number worth putting on a portfolio.

### 6. CI never runs `npm audit`

- `npm audit` currently reports **0 vulnerabilities**, including dev dependencies — so there is nothing to fix today.
- But [.github/workflows/backend.yml](../.github/workflows/backend.yml) runs lint, format, typecheck and tests only. Nothing would tell you when that zero stops being true.
- There's also no Dependabot or Renovate config anywhere in the repository.

_Effort:_ three lines in the workflow, plus a `.github/dependabot.yml` if you want the updates raised automatically — about 10 minutes.

### 7. Service logic can only be tested with a live database

- Repositories are constructed at module scope in 24 places, for example `const products = new ProductRepository()` at the top of [services/product.service.ts:8](../app/backend/src/services/product.service.ts#L8).
- Services therefore can't be exercised without real Postgres, and there is no fast unit tier — every one of the 132 specs needs the container running.
- This is a defensible trade: integration tests against real Postgres catch the constraint violations, lock behaviour and SQLSTATE mapping that mocks would paper over, and your test suite is stronger for it.
- The cost is speed and isolation. Worth knowing you chose it, rather than discovering it later.

_Effort:_ constructor injection across the eight services, about a day. Genuinely optional.

## Low

### 8. Jasmine looks for helpers in a folder that doesn't exist

[spec/support/jasmine.json:4](../app/backend/spec/support/jasmine.json#L4) sets `"helpers": ["helpers/**/*.ts"]`, which resolves to `src/tests/helpers/`. The helpers actually live in `src/tests/support/api.ts` and are imported directly, so nothing breaks — the glob just matches nothing. Delete the line or point it at `support/`.

### 9. Review files sit in the package root

`BACKEND_REVIEW.md`, `BACKEND_REVIEW_2026-09-23.md` and this file are point-in-time audit output sitting next to `README.md` in the published package root. The repository already has a `docs/` folder. Move all three together.

### 10. No source maps in the production build

[tsconfig.json](../app/backend/tsconfig.json) sets `outDir` but not `sourceMap`, so production stack traces point at compiled JavaScript line numbers. Enabling source maps (and `--enable-source-maps` on the node command) makes a production error report readable.

### 11. A crash outside a request handler isn't logged

[server.ts:54](../app/backend/src/server.ts#L54) handles `SIGTERM` and `SIGINT` cleanly, including flushing the audit log and draining the pool. But there's no `unhandledRejection` or `uncaughtException` handler, so a failure in the daily purge timer or in a detached promise would take the process down with nothing written to the log explaining why.

---

## What's strongest

Worth recording, because these are the parts that put the score where it is.

**The layering is real.** Searched for every boundary violation and found none: no controller imports a repository, no route imports a service, no repository reaches up into services, and no Express type appears in `services/` or `repositories/`. Most codebases claiming this architecture leak somewhere.

**The type discipline is near-perfect.** Across all of `src/`: **0** uses of `any`, **0** `ts-ignore` or `ts-expect-error`, **0** `eslint-disable`, **0** stray `console.`. Every interface lives in `src/types/*.types.ts` — none inline in a repository, service or test. The largest production file is 337 lines.

**The security work is the standout.**

- Refresh-token rotation with family-based reuse detection, plus a deliberate 10-second grace window so a multi-tab reload isn't mistaken for theft ([token.service.ts:60](../app/backend/src/services/token.service.ts#L60)).
- bcrypt over an HMAC of the password and pepper, so bcrypt's 72-byte limit can't silently drop the pepper ([password.service.ts:9](../app/backend/src/services/password.service.ts#L9)).
- A versioned password scheme that re-hashes legacy rows on the next successful login.
- An unknown username costs the same time as a real one, so timing doesn't reveal which accounts exist.
- The admin role is re-read from the database on every admin request, so a demotion takes effect immediately instead of at token expiry ([middleware/auth.ts:36](../app/backend/src/middleware/auth.ts#L36)).
- The JWT algorithm is pinned on both sign and verify, and the role claim is explicitly not trusted for authorization.
- 500s are logged server-side and never echoed to the client; auth headers, cookies and password fields are stripped from the logs.
- `config.ts` refuses to start on a missing or short secret rather than falling back to a default.

**The data layer holds up under concurrency.** Every query is parameterized — no user input is ever interpolated into SQL. Checkout locks products _and_ variants in id order inside one transaction before reading stock, then spends it with a conditional `UPDATE ... WHERE stock >= $2`, so two checkouts racing for the last item cannot both win ([cart.service.ts:104](../app/backend/src/services/cart.service.ts#L104)). Prices and shop details are read from the product, never from the request body.

**Validation and error translation.** Zod at every entry point through a single `parse()` helper, composable primitives in `common.schema.ts`, page sizes capped at 100. [middleware/error.ts](../app/backend/src/middleware/error.ts) maps eight distinct Postgres SQLSTATE codes to sensible client messages instead of leaking them.

## Progress since the last review

| Last review | Then | Now |
| --- | --- | --- |
| Overall score | 81 / 100 | **90 / 100** |
| Tests | 125 | **132** |
| OpenAPI coverage | 38 paths | **39 paths / 64 operations** |
| Migrations | 17 | **19** |
| Item 1 — leaked secret | Critical, in a tracked file | Still on disk, but **no longer tracked by git** |
| Item 2 — cross-site cookie | Open | Still open (hosting) |
| Item 3 — Railway variables / health check | Open | Health check still missing (item 2 above) |
| Items 4–9 | Fixed during the day | Confirmed fixed |
| Structure and layering | 8.5 | 9.5 — boundaries verified clean |
| Code quality | 7.5 | 9.5 — no suppressions, interfaces centralised |
| Database and data access | 7.5 | 9.0 — options relational, locking in place |
