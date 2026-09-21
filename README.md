# MyStore — Full-Stack E-Commerce App

An e-commerce single-page application built with **Angular 18** and backed by a **Node/Express + PostgreSQL** REST API. Users can register and log in, browse a product catalog, view product details, add items to a shopping cart, manage quantities, and complete a checkout flow with an order confirmation page.

## Features

- **Product catalog** — browse, search, and filter products by category
- **Product details** — view photos, name, price, description, color variants, stock info, and customer reviews
- **Shopping cart** — add/remove items, update quantities, see per-item subtotals and a total cost
- **Checkout** — select a shipping address and payment method, apply discount codes, and place an order
- **Order confirmation** — success page displayed after checkout
- **User authentication** — register, log in, log out with JWT (access + refresh tokens)
- **Admin role** — `customer` / `admin` roles; admins get an `/admin` API to list and manage every user's orders, carts and addresses, manage roles, and maintain the catalog (see [app/backend/SECURITY.md](app/backend/SECURITY.md) for the OWASP API Top 10 mapping)
- **Cart badge** — navbar shows the current item count; empty-cart state when no items are present
- **Form validation** — required fields, minimum lengths (e.g. username ≥ 3 chars, password ≥ 6 chars), password confirmation match
- **Toast notifications** — user feedback on every cart/auth/checkout action

## Prerequisites

- **Node.js** v18+
- **Docker** (or a local PostgreSQL 14+ instance)
- **Angular CLI** v18 — `npm install -g @angular/cli`

## Installation & Launch

### 1. Backend

```bash
cd app/backend
npm install
docker-compose up -d          # starts PostgreSQL (port 5432)
cp .env.example .env          # defaults work out of the box with Docker
npm run migrate:up            # creates database tables
npm run seed:admin            # creates the admin account from ADMIN_USERNAME / ADMIN_PASSWORD in .env
npm run watch                 # starts API server at http://localhost:3000
```

> The `.env.example` file contains working defaults that match the Docker Compose configuration — no edits needed.

### 2. Frontend

```bash
cd app/frontend
npm install
ng serve                      # starts the app at http://localhost:4200
```

**Both backend and frontend must be running at the same time.** The frontend fetches all product and cart data from the backend API at `http://localhost:3000`.

## Tests

```bash
# Backend tests (Jasmine)
cd app/backend
npm test

# Frontend tests (Karma + Jasmine)
cd app/frontend
ng test
```

## Project Structure

```
├── app/
│   ├── backend/              # Node/Express REST API + PostgreSQL
│   │   ├── src/
│   │   │   ├── app.ts        # Express app assembly (server.ts only calls listen)
│   │   │   ├── routes/       # URL + middleware per domain, mounted under /api/v1
│   │   │   ├── controllers/  # Request parsing, validation and responses
│   │   │   ├── services/     # Multi-step logic: token issue/rotation, checkout
│   │   │   ├── repositories/ # One class per table: parameterized SQL + row mapping
│   │   │   ├── middleware/   # JWT auth, admin role check, audit log, rate limits
│   │   │   ├── utils/        # Validators, response envelope, error handler
│   │   │   ├── scripts/      # seed:admin bootstrap
│   │   │   └── types/        # TypeScript interfaces
│   │   └── migrations/       # Database migration files
│   │
│   └── frontend/             # Angular 18 SPA
│       └── src/app/
│           ├── core/         # Guards, interceptors, services (auth, cart, UI), models
│           ├── features/
│           │   ├── auth/     # Login & Register (lazy-loaded)
│           │   ├── products/ # Product list & detail (lazy-loaded)
│           │   └── cart/     # Cart page & order confirmation (lazy-loaded)
│           └── shared/       # Navbar, loading spinner, confirm dialog, form controls, pipes
└── docs/                     # Dependency reference
```

## Detailed Documentation

- [docs/app-dependencies.md](docs/app-dependencies.md) — Runtime and development dependency reference
- [app/frontend/README.md](app/frontend/README.md) — Angular project structure, features, and key patterns
- [app/backend/README.md](app/backend/README.md) — API routes, environment variables, and database scripts
