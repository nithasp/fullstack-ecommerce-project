# MyStore — Angular Frontend

E-commerce SPA built with Angular 18. Authenticate, browse products, manage a cart, and complete checkout.

## Prerequisites

- Node.js v18+
- Angular CLI v18

## Setup

```bash
npm install
ng serve          # http://localhost:4200
ng test           # Karma + Jasmine (19 spec files)
ng build          # production build
```

## Features

| Area | Description |
|------|-------------|
| **Auth** | Register / Login / Logout with JWT (access + refresh tokens). Interceptor auto-attaches token and handles 401 refresh. |
| **Products** | Product list and detail pages. Products have type variants (color/price/stock) and reviews. |
| **Cart** | Add/remove items, debounced quantity updates, grouped by shop. Synced to backend REST API. |
| **Checkout** | Address dialog (add/edit/select), order confirmation page. |
| **Admin** | Activity Log page (`/admin/activity`, admins only): who did what and when, filtered by user, type, result and date range. Page views (pages people opened) and API reads each stay hidden until their checkbox is ticked. |
| **Page views** | `PageViewService` reports each page a signed-in user opens to `POST /page-views`, named by the route's `data.page`. Reports fail quietly (the `QUIET_ERRORS` request flag keeps the interceptor from showing a toast). |
| **Shared** | Navbar, confirm dialog, loading spinner, reusable form controls, `truncate` pipe, toast notifications (`ngx-toastr`). |

## Project Structure

```
src/
├── app/
│   ├── core/
│   │   ├── config/          # API base URL
│   │   ├── guards/          # Auth and admin route guards
│   │   ├── interceptors/    # JWT attach + token refresh
│   │   ├── models/          # AuthUser (with role), CartApiItem, ConfirmDialogConfig, QuantityUpdate
│   │   └── services/
│   │       ├── activity/    # PageViewService (reports page views for the Activity Log)
│   │       ├── auth/        # AuthService, AuthApiService
│   │       ├── cart/        # CartService, CartApiService
│   │       └── ui/          # NotificationService, ConfirmDialogService
│   ├── features/
│   │   ├── auth/            # Login, Register components (lazy-loaded)
│   │   ├── products/        # ProductList, ProductDetail, ProductCard (lazy-loaded)
│   │   ├── cart/            # CartPage, OrderConfirmation, AddressDialog (lazy-loaded)
│   │   └── admin/           # ActivityLog page, HumanizePipe (lazy-loaded, admins only)
│   └── shared/
│       ├── components/      # Navbar, LoadingSpinner, DialogConfirm, InputField, QuantityInput
│       └── pipes/           # TruncatePipe
├── environments/            # environment.ts / environment.production.ts
└── styles/                  # SCSS partials (variables, mixins, base, auth, animations)
```

## Key Patterns

- **Lazy-loaded feature modules**: `auth`, `products`, `cart`, `admin`
- **Admin pages**: `adminGuard` hides them from customers; the admin API refuses non-admins on its own
- **JWT auth flow**: `AuthService` → `AuthInterceptor` → auto-refresh on 401
- **Cart state**: `CartService` fetches/resets on auth state change; debounced quantity updates
- **Form controls**: `InputField` implements `ControlValueAccessor`; `QuantityInput` emits `QuantityUpdate`
- **BEM + SCSS partials** for all component styles
