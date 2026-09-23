# MyStore — Angular Frontend

E-commerce SPA built with Angular 18. Authenticate, browse products, manage a cart, and complete checkout.

## Prerequisites

- Node.js v22+
- Angular CLI v18

## Setup

```bash
npm install
ng serve          # http://localhost:4200
ng test           # Karma + Jasmine (20 spec files)
ng build          # production build
```

## Features

| Area | Description |
|------|-------------|
| **Auth** | Register / Login / Logout. The access token stays in memory and the session lives in an HttpOnly cookie the API sets, so a script on the page cannot read it; the interceptor attaches the token and renews it on a 401. |
| **Products** | Product list and detail pages. Products have type variants (color/price/stock) and reviews. |
| **Cart** | Add/remove items, debounced quantity updates, grouped by shop. Synced to backend REST API. |
| **Checkout** | Address dialog (add/edit/select), order confirmation page. Only the ticked cart rows are sent, by id — the server prices them and reduces stock. |
| **Admin** | Two pages, admins only: **Activity Log** (`/admin/activity`) — who did what and when, filtered by user, type, result and date range, with reads hidden until the checkbox is ticked — and **Page views** (`/admin/page-views`) — the pages people opened, filtered by user, path and date range. |
| **Page views** | `PageViewService` reports each page a signed-in user opens to `POST /page-views`, named by the route's `data.page`. Reports fail quietly (the `QUIET_ERRORS` request flag keeps the interceptor from showing a toast). |
| **Shared** | Navbar, confirm dialog, loading spinner, reusable form controls, `truncate` pipe, toast notifications (`ngx-toastr`). |

## Project Structure

```
src/
├── app/
│   ├── core/
│   │   ├── config/          # API base URL
│   │   ├── guards/          # Auth and admin route guards
│   │   ├── interceptors/    # Attaches the access token, renews the session on a 401
│   │   ├── models/          # AuthUser (with role), AuthSession, CartApiItem, ConfirmDialogConfig, QuantityUpdate
│   │   └── services/
│   │       ├── activity/    # PageViewService (reports the pages people open)
│   │       ├── auth/        # AuthService, AuthApiService
│   │       ├── cart/        # CartService, CartApiService
│   │       └── ui/          # NotificationService, ConfirmDialogService
│   ├── features/
│   │   ├── auth/            # Login, Register components (lazy-loaded)
│   │   ├── products/        # ProductList, ProductDetail, ProductCard (lazy-loaded)
│   │   ├── cart/            # CartPage, OrderConfirmation, AddressDialog (lazy-loaded)
│   │   └── admin/           # ActivityLog and PageViews pages, HumanizePipe (lazy-loaded, admins only)
│   └── shared/
│       ├── components/      # Navbar, LoadingSpinner, DialogConfirm, InputField, QuantityInput
│       └── pipes/           # TruncatePipe
├── environments/            # environment.ts / environment.production.ts
└── styles/                  # SCSS partials (variables, mixins, base, auth, animations)
```

## Key Patterns

- **Lazy-loaded feature modules**: `auth`, `products`, `cart`, `admin`
- **Admin pages**: `adminGuard` hides them from customers; the admin API refuses non-admins on its own
- **Session flow**: `AuthService` keeps the access token in memory → `AuthInterceptor` attaches it and renews from the refresh cookie on a 401 → a reload asks `POST /auth/refresh` for a new one
- **Cart state**: `CartService` fetches/resets on auth state change; debounced quantity updates
- **Form controls**: `InputField` implements `ControlValueAccessor`; `QuantityInput` emits `QuantityUpdate`
- **BEM + SCSS partials** for all component styles
