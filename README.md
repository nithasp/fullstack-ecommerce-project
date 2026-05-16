# MyStore — Full-Stack E-Commerce App

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/nithasp/udacity-full-stack-javascript-developer-course5-ex/tree/main.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/nithasp/udacity-full-stack-javascript-developer-course5-ex/tree/main)

> **Hosted Frontend:** [http://storefront-frontend-prod-nt.s3-website-ap-southeast-2.amazonaws.com](http://storefront-frontend-prod-nt.s3-website-ap-southeast-2.amazonaws.com)
>
> **Hosted API:** [http://storefront-api-env.eba-xmibpinb.ap-southeast-2.elasticbeanstalk.com](http://storefront-api-env.eba-xmibpinb.ap-southeast-2.elasticbeanstalk.com)

An e-commerce single-page application built with **Angular 18** and backed by a **Node/Express + PostgreSQL** REST API. Users can register and log in, browse a product catalog, view product details, add items to a shopping cart, manage quantities, and complete a checkout flow with an order confirmation page.

## Features

- **Product catalog** — browse, search, and filter products by category
- **Product details** — view photos, name, price, description, color variants, stock info, and customer reviews
- **Shopping cart** — add/remove items, update quantities, see per-item subtotals and a total cost
- **Checkout** — select a shipping address and payment method, apply discount codes, and place an order
- **Order confirmation** — success page displayed after checkout
- **User authentication** — register, log in, log out with JWT (access + refresh tokens)
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
│   │   │   ├── handlers/     # Route handlers (auth, products, cart, orders, addresses)
│   │   │   ├── models/       # Database models
│   │   │   ├── middleware/   # JWT auth middleware
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
├── docs/                     # Architecture, infrastructure, and pipeline documentation
└── screenshots/              # AWS console and CircleCI build screenshots
```

## Detailed Documentation

- [docs/infrastructure.md](docs/infrastructure.md) — AWS services, environment variables, and networking
- [docs/app-dependencies.md](docs/app-dependencies.md) — Runtime and development dependency reference
- [docs/pipeline.md](docs/pipeline.md) — CircleCI CI/CD pipeline stages and secrets configuration
- [docs/architecture.md](docs/architecture.md) — Infrastructure and pipeline architecture diagrams
- [app/frontend/README.md](app/frontend/README.md) — Angular project structure, features, and key patterns
- [app/backend/README.md](app/backend/README.md) — API routes, environment variables, and database scripts
