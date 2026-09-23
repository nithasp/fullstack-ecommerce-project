# Application Dependencies

This document lists the runtime and development dependencies for both the backend and frontend applications.

---

## Runtime Requirements

| Requirement | Version | Purpose |
|---|---|---|
| Node.js | 18 LTS | JavaScript runtime for the backend |
| npm | 9+ | Package manager |
| PostgreSQL | 14+ | Relational database |
| Angular CLI | 18 | Frontend build tooling |

---

## Backend Dependencies (`app/backend/package.json`)

### Production (`dependencies`)

| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.18 | HTTP server framework |
| `pg` | ^8.11 | PostgreSQL client for Node.js |
| `db-migrate` | ^0.11 | Database migration runner |
| `db-migrate-pg` | ^1.5 | PostgreSQL driver adapter for db-migrate |
| `dotenv` | ^16.3 | Loads environment variables from `.env` |
| `jsonwebtoken` | ^9.0 | JWT creation and verification |
| `bcrypt` | ^6.0 | Password hashing |
| `zod` | ^4.6 | Request validation; the schemas also give the input types |
| `pino` | ^10.3 | Structured logging |
| `pino-http` | ^11.0 | Request logging, one id per request |
| `cookie-parser` | ^1.4 | Reads the HttpOnly refresh cookie |
| `cors` | ^2.8 | Cross-Origin Resource Sharing middleware |
| `helmet` | ^8.1 | Secure HTTP headers |
| `express-rate-limit` | ^8.2 | Request rate limiting |

### Development (`devDependencies`)

| Package | Purpose |
|---|---|
| `typescript` | TypeScript compiler |
| `tsx` | Runs the TypeScript sources directly, so the tests never touch `dist/` |
| `tsc-watch` | Recompile + restart on file changes |
| `jasmine` | Test framework |
| `jasmine-spec-reporter` | Pretty-printed test output |
| `supertest` | HTTP integration test client |
| `eslint` + `typescript-eslint` + `@eslint/js` | Linting |
| `prettier` + `eslint-config-prettier` | Formatting |
| `pino-pretty` | Readable logs in development |
| `cross-env` | Cross-platform environment variable setting |
| `@types/*` | TypeScript type definitions |

---

## Frontend Dependencies (`app/frontend/package.json`)

### Production (`dependencies`)

| Package | Version | Purpose |
|---|---|---|
| `@angular/core` | ^18.2 | Angular framework core |
| `@angular/common` | ^18.2 | Angular common utilities (HTTP, pipes) |
| `@angular/router` | ^18.2 | Client-side routing |
| `@angular/forms` | ^18.2 | Reactive and template-driven forms |
| `@angular/animations` | ^18.2 | Angular animation support |
| `@angular/platform-browser` | ^18.2 | Browser platform bootstrapping |
| `rxjs` | ~7.8 | Reactive programming (Observables) |
| `ngx-toastr` | ^19.1 | Toast notification library |
| `tslib` | ^2.3 | TypeScript runtime helpers |
| `zone.js` | ~0.14 | Angular change detection |

### Development (`devDependencies`)

| Package | Purpose |
|---|---|
| `@angular/cli` | Angular CLI build tool |
| `@angular-devkit/build-angular` | Angular application builder |
| `@angular/compiler-cli` | Angular ahead-of-time compiler |
| `typescript` | TypeScript compiler |
| `jasmine-core` | Jasmine test framework |
| `karma` | Test runner (browser) |
| `karma-chrome-launcher` | Chrome browser launcher for Karma |
| `karma-jasmine` | Karma + Jasmine adapter |
| `karma-jasmine-html-reporter` | HTML test report generator |
| `karma-coverage` | Code coverage reporter |
| `@types/jasmine` | TypeScript types for Jasmine |

---

## Environment Variables

All environment-specific values are provided as environment variables and are never hard-coded in source files.

See [`app/backend/README.md`](../app/backend/README.md) for the full list of required environment variables.

A template for local development is available at `app/backend/.env.example`.
