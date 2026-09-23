# API Requirements

## API Endpoints

**Base path:** every route below is served under `/api/v1` — e.g. `POST /api/v1/auth/login`. The tables leave the prefix out for readability. Only `GET /` (health check), `GET /docs` and `GET /openapi.yaml` sit outside it; any other unknown path answers `404` with the envelope.

**Envelope:** every response is `{ status, message, data }`, and an error adds a machine-readable `code` (`invalid_request`, `no_token`, `token_expired`, `token_invalid`, `invalid_credentials`, `forbidden`, `not_found`, `conflict`, `rate_limited`, `internal_error`).

**Pagination:** list routes marked *paginated* accept `?limit=` (1–100, default 50) and `?offset=` (default 0), and add a `meta` object next to `data`:

```json
{ "status": 200, "message": "Products fetched.", "data": [ ... ], "meta": { "limit": 50, "offset": 0, "total": 134 } }
```

**Money:** `price`, `unitPrice` and `total` are `NUMERIC` columns, which the driver returns as strings (`"19.99"`) so no decimal is lost.

**Passwords:** every route that sets a password requires at least 8 characters and stores it exactly as typed — surrounding spaces are not trimmed.

**Errors from the database:** a value Postgres rejects is the client's mistake, so it gets a 4xx rather than a 500 — a taken username is `409 Username already exists`, an id that points at nothing is `400`, a value too long or too large for its column is `400`.

### Auth

The refresh token is **not** in the response body. It is set as a cookie the browser keeps and JavaScript cannot read: `HttpOnly; SameSite=Strict; Path=/api/v1/auth` (and `Secure` in production). Browser clients send these calls with credentials.

| Method | Route               | Auth | Description                          |
| ------ | ------------------- | ---- | ------------------------------------ |
| POST   | `/auth/register`    | No   | Register — returns `{ user, accessToken }`, sets the refresh cookie |
| POST   | `/auth/login`       | No   | Log in — same shape; a wrong username and a wrong password answer identically |
| POST   | `/auth/refresh`     | Cookie | New access token and a rotated cookie — presenting an already-used token revokes that whole session |
| POST   | `/auth/logout`      | Cookie | End that session and clear the cookie |
| POST   | `/auth/logout-all`  | JWT  | End every session of the account     |
| GET    | `/auth/me`          | JWT  | The signed-in account                |

### Roles

Every account has a `role`: `customer` (default) or `admin`. Self-registration always creates a customer; a `role` in the register or update body is ignored. Admins are created by `npm run seed:admin`, `POST /admin/users` or `PUT /admin/users/:id/role`.

Customer routes serve the token's **own** account only — another account's id answers 403 (users, addresses) or 404 (orders, cart items). That holds for an admin's token too: cross-account work belongs to `/admin`, where the role is re-read from the database on every request.

### Users

| Method | Route                  | Auth | Description                              |
| ------ | ---------------------- | ---- | ---------------------------------------- |
| GET    | `/users/:id`           | JWT  | Own account, with recent purchases — 403 for any other id |
| PATCH  | `/users/:id`           | JWT  | Own profile (`firstName`, `lastName`, `username`) — at least one |
| PUT    | `/users/:id/password`  | JWT  | Change own password: needs `currentPassword`; ends every other session and returns a fresh session |
| DELETE | `/users/:id`           | JWT  | Close own account: profile scrubbed, addresses and cart deleted, sessions ended, orders kept |

### Products

Read-only, and limited to products on sale. Managing the catalog is an admin function under `/admin/products`.

| Method | Route                  | Auth | Description                              |
| ------ | ---------------------- | ---- | ---------------------------------------- |
| GET    | `/products`            | JWT  | Catalog (paginated; `?category=` exact, `?search=` name or description — both case-insensitive) |
| GET    | `/products/categories` | JWT  | Every category on sale, sorted           |
| GET    | `/products/popular`    | JWT  | Five most bought products, counting completed orders only |
| GET    | `/products/:id`        | JWT  | One product on sale (an archived one answers 404) |

### Orders

Checkout is the only way a customer creates an order, and orders are read-only for customers afterwards.

| Method | Route                  | Auth | Description                      |
| ------ | ---------------------- | ---- | -------------------------------- |
| GET    | `/orders`              | JWT  | Own orders, newest first, with totals (paginated; `?status=`) |
| GET    | `/orders/:id`          | JWT  | Own order — someone else's answers 404 |
| GET    | `/orders/:id/products` | JWT  | Lines of an own order, each with the price paid |

### Cart

| Method | Route             | Auth | Description                                      |
| ------ | ----------------- | ---- | ------------------------------------------------ |
| GET    | `/cart`           | JWT  | Own cart, each row with its product              |
| POST   | `/cart`           | JWT  | Add `productId`, optional `typeId` and `quantity` — the same product and option again adds up (max 999). Price, option and shop come from the product |
| POST   | `/cart/checkout`  | JWT  | Buy the rows named by `cartItemIds`: quantities from the cart, price and stock from the product, stock reduced, price stored on each line, rows bought leave the cart. All or nothing |
| PATCH  | `/cart/:id`       | JWT  | Change a row's quantity                          |
| DELETE | `/cart/:id`       | JWT  | Remove a row                                     |
| DELETE | `/cart`           | JWT  | Empty the cart                                   |

Checkout answers `409` and changes nothing when a product was archived, an option is gone, stock is short, or a row is no longer in the cart.

### Addresses

| Method | Route             | Auth | Description          |
| ------ | ----------------- | ---- | -------------------- |
| GET    | `/addresses`      | JWT  | Own addresses, default first |
| GET    | `/addresses/:id`  | JWT  | One own address      |
| POST   | `/addresses`      | JWT  | Save an address; the first one becomes the default |
| PATCH  | `/addresses/:id`  | JWT  | Change an address — at least one field |
| DELETE | `/addresses/:id`  | JWT  | Delete an address; deleting the default hands it to the oldest one left |

### Page views

| Method | Route         | Auth | Description |
| ------ | ------------- | ---- | ----------- |
| POST   | `/page-views` | JWT  | Report a page the user opened (`path`, optional `page` name). Stored in `page_views`, not in the audit log |

### Admin

All routes require an admin token, and the role is re-read from the database on every request. List routes are paginated. Admin reads of account data are recorded in the audit log.

| Method | Route                          | Description                                   |
| ------ | ------------------------------ | --------------------------------------------- |
| GET    | `/admin/users`                 | Every open account                            |
| GET    | `/admin/users/:id`             | One account, with recent purchases            |
| POST   | `/admin/users`                 | Create an account; optional `role`            |
| PATCH  | `/admin/users/:id`             | Profile fields of any account                 |
| PUT    | `/admin/users/:id/role`        | Set `customer` / `admin`; ends that account's sessions; not on self |
| PUT    | `/admin/users/:id/password`    | Reset a password without the old one; ends that account's sessions |
| DELETE | `/admin/users/:id`             | Close an account (scrub + keep orders); not on self |
| GET    | `/admin/products`              | Every product, archived ones included (`?category=` `?search=`) |
| POST   | `/admin/products`              | Add a product                                 |
| POST   | `/admin/products/bulk`         | Add 1–500 products in one transaction         |
| GET    | `/admin/products/:id`          | One product, archived or not                  |
| PATCH  | `/admin/products/:id`          | Change a product; `isActive: true` puts an archived one back on sale |
| DELETE | `/admin/products/:id`          | Archive a product (`isActive: false`) — the row stays, so past orders keep it |
| GET    | `/admin/orders`                | Every order (`?status=` `?userId=`)           |
| POST   | `/admin/orders`                | Open an order for `userId`                    |
| GET    | `/admin/orders/:id`            | Any order                                     |
| PATCH  | `/admin/orders/:id`            | Change an order's status                      |
| DELETE | `/admin/orders/:id`            | Delete an order and its lines                 |
| GET    | `/admin/orders/:id/products`   | Lines of any order                            |
| POST   | `/admin/orders/:id/products`   | Add a line, priced from the product now       |
| GET    | `/admin/carts`                 | Cart rows across accounts (`?userId=`)        |
| GET    | `/admin/carts/:userId`         | One account's cart                            |
| POST   | `/admin/carts/:userId`         | Add to an account's cart                      |
| DELETE | `/admin/carts/:userId`         | Empty an account's cart                       |
| GET    | `/admin/cart-items/:id`        | One cart row                                  |
| PATCH  | `/admin/cart-items/:id`        | Change a cart row's quantity                  |
| DELETE | `/admin/cart-items/:id`        | Remove a cart row                             |
| GET    | `/admin/addresses`             | Addresses across accounts (`?userId=`)        |
| POST   | `/admin/addresses`             | Save an address for `userId`                  |
| GET    | `/admin/addresses/:id`         | One address                                   |
| PATCH  | `/admin/addresses/:id`         | Change an address                             |
| DELETE | `/admin/addresses/:id`         | Delete an address                             |
| GET    | `/admin/audit-logs`            | Audit log, newest first (`?userId=` `?username=` `?action=` `?result=` `?from=` `?to=`); read-only |
| GET    | `/admin/page-views`            | Page views, newest first (`?userId=` `?username=` `?path=` `?from=` `?to=`); read-only |

**Auth header:** protected routes require `Authorization: Bearer <accessToken>`. Access tokens are HS256 JWTs (any other algorithm is rejected) and expire after 15 minutes by default.

---

## Database Schema

### users

| Column           | Type         | Constraints     |
| ---------------- | ------------ | --------------- |
| id               | SERIAL       | PRIMARY KEY     |
| first_name       | VARCHAR(100) | NOT NULL        |
| last_name        | VARCHAR(100) | NOT NULL        |
| username         | VARCHAR(100) | NOT NULL, UNIQUE on `LOWER(username)` — case-insensitive |
| password         | VARCHAR(255) | NOT NULL        |
| password_version | SMALLINT     | NOT NULL, DEFAULT 1 — 1: password + pepper, 2: HMAC-SHA256 with the pepper, then bcrypt |
| role             | VARCHAR(20)  | NOT NULL, DEFAULT 'customer', CHECK IN ('customer', 'admin') |
| deleted_at       | TIMESTAMPTZ  | set when the account is closed; every read skips those rows |

### products

| Column         | Type           | Constraints        |
| -------------- | -------------- | ------------------ |
| id             | SERIAL         | PRIMARY KEY        |
| name           | VARCHAR(255)   | NOT NULL           |
| price          | NUMERIC(10,2)  | NOT NULL, CHECK >= 0 and not NaN |
| category       | VARCHAR(100)   |                    |
| image          | VARCHAR(500)   |                    |
| description    | TEXT           |                    |
| preview_img    | JSONB          | NOT NULL, DEFAULT `[]` |
| types          | JSONB          | NOT NULL, DEFAULT `[]` — options, each with its own price and stock |
| reviews        | JSONB          | NOT NULL, DEFAULT `[]` |
| overall_rating | NUMERIC(3,1)   | NOT NULL, DEFAULT 0, CHECK 0–5 |
| stock          | INTEGER        | NOT NULL, DEFAULT 0, CHECK >= 0 |
| is_active      | BOOLEAN        | NOT NULL, DEFAULT true — `false` is archived |
| shop_id        | VARCHAR(255)   |                    |
| shop_name      | VARCHAR(255)   |                    |

Partial index on `(id) WHERE is_active` for catalog reads.

### orders

| Column     | Type        | Constraints                                       |
| ---------- | ----------- | ------------------------------------------------- |
| id         | SERIAL      | PRIMARY KEY                                       |
| user_id    | INTEGER     | NOT NULL, REFERENCES users(id) **ON DELETE RESTRICT** |
| status     | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK IN ('active', 'complete') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                           |

Indexes on `user_id` and `created_at DESC`.

### order_products

| Column     | Type          | Constraints                               |
| ---------- | ------------- | ----------------------------------------- |
| id         | SERIAL        | PRIMARY KEY                               |
| order_id   | INTEGER       | NOT NULL, REFERENCES orders(id) ON DELETE CASCADE |
| product_id | INTEGER       | NOT NULL, REFERENCES products(id) **ON DELETE RESTRICT** |
| type_id    | VARCHAR(255)  | the option bought, if any                 |
| quantity   | INTEGER       | NOT NULL, DEFAULT 1, CHECK > 0            |
| unit_price | NUMERIC(10,2) | NOT NULL, CHECK >= 0 — what one cost when the order was placed |

Indexes on `order_id` and `product_id`.

### refresh_tokens

| Column     | Type         | Constraints                          |
| ---------- | ------------ | ------------------------------------ |
| id         | SERIAL       | PRIMARY KEY                          |
| user_id    | INTEGER      | REFERENCES users(id) ON DELETE CASCADE |
| token_hash | VARCHAR(64)  | UNIQUE NOT NULL — SHA-256 of the token, never the token itself |
| family_id  | UUID         | NOT NULL — shared by every token rotated from one login |
| expires_at | TIMESTAMPTZ  | NOT NULL                             |
| used_at    | TIMESTAMPTZ  | set when the token is exchanged; reuse after that revokes the family |
| created_at | TIMESTAMPTZ  | DEFAULT CURRENT_TIMESTAMP            |

### cart_items

| Column        | Type         | Constraints                               |
| ------------- | ------------ | ----------------------------------------- |
| id            | SERIAL       | PRIMARY KEY                               |
| user_id       | INTEGER      | NOT NULL, REFERENCES users(id) ON DELETE CASCADE |
| product_id    | INTEGER      | NOT NULL, REFERENCES products(id) ON DELETE CASCADE |
| quantity      | INTEGER      | NOT NULL, DEFAULT 1, CHECK > 0            |
| type_id       | VARCHAR(255) | NOT NULL, DEFAULT ''                      |
| selected_type | JSONB        | the option as the product defines it      |
| shop_id       | VARCHAR(255) |                                           |
| shop_name     | VARCHAR(255) |                                           |
| created_at    | TIMESTAMPTZ  | DEFAULT CURRENT_TIMESTAMP                 |
| updated_at    | TIMESTAMPTZ  | DEFAULT CURRENT_TIMESTAMP                 |

Unique constraint: `(user_id, product_id, type_id)`

### addresses

| Column     | Type         | Constraints                                    |
| ---------- | ------------ | ---------------------------------------------- |
| id         | SERIAL       | PRIMARY KEY                                    |
| user_id    | INTEGER      | NOT NULL, REFERENCES users(id) ON DELETE CASCADE |
| full_name  | VARCHAR(255) | NOT NULL                                       |
| phone      | VARCHAR(50)  |                                                |
| address    | TEXT         | NOT NULL                                       |
| city       | VARCHAR(255) | NOT NULL                                       |
| label      | VARCHAR(20)  | DEFAULT 'home', CHECK IN ('home','work','other') |
| is_default | BOOLEAN      | NOT NULL, DEFAULT false                        |
| created_at | TIMESTAMPTZ  | DEFAULT NOW()                                  |
| updated_at | TIMESTAMPTZ  | DEFAULT NOW()                                  |

### audit_logs

Security-relevant events. `user_id` has no foreign key and the username is copied in, so entries outlive a closed account. Rows older than `AUDIT_LOG_RETENTION_DAYS` (default 90) are deleted daily.

| Column      | Type         | Constraints                                    |
| ----------- | ------------ | ---------------------------------------------- |
| id          | BIGSERIAL    | PRIMARY KEY                                    |
| created_at  | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                        |
| user_id     | INTEGER      |                                                |
| username    | VARCHAR(100) |                                                |
| user_role   | VARCHAR(20)  |                                                |
| action      | VARCHAR(20)  | NOT NULL, CHECK IN ('CREATE','READ','UPDATE','DELETE','LOGIN','LOGIN_FAILED','LOGOUT','REGISTER','SECURITY') |
| event       | VARCHAR(60)  | NOT NULL — e.g. `cart.item_added`              |
| method      | VARCHAR(10)  |                                                |
| path        | VARCHAR(255) |                                                |
| status_code | SMALLINT     |                                                |
| ip_address  | VARCHAR(45)  |                                                |
| user_agent  | VARCHAR(255) |                                                |
| details     | JSONB        | small, non-secret facts — never a password or a token |

### page_views

Analytics, kept apart from the security trail. Also without a foreign key, and cleared after `PAGE_VIEW_RETENTION_DAYS` (default 90).

| Column     | Type         | Constraints             |
| ---------- | ------------ | ----------------------- |
| id         | BIGSERIAL    | PRIMARY KEY             |
| created_at | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW() |
| user_id    | INTEGER      |                         |
| username   | VARCHAR(100) |                         |
| path       | VARCHAR(255) | NOT NULL                |
| page       | VARCHAR(60)  | the name the frontend gives the page |
| ip_address | VARCHAR(45)  |                         |
| user_agent | VARCHAR(255) |                         |

---

## Data Shapes (TypeScript)

```typescript
User        { id: number, firstName: string, lastName: string, username: string,
              role: 'customer' | 'admin' }   // there is no password field on this shape
AuthSession { user: User, accessToken: string }   // the refresh token is in the cookie
Product     { id: number, name: string, price: string, category: string | null,
              image: string | null, description: string | null, previewImg: string[],
              types: ProductType[], reviews: Review[], overallRating: number,
              stock: number, isActive: boolean, shopId: string | null, shopName: string | null }
ProductType { _id?: string, color: string, price: number, stock: number, image?: string }
Order       { id: number, userId: number, status: 'active' | 'complete',
              createdAt: string, total: string }
OrderLine   { id: number, orderId: number, productId: number, typeId: string | null,
              quantity: number, unitPrice: string }
CartItem    { id: number, userId: number, productId: number, quantity: number,
              typeId: string | null, selectedType: ProductType | null,
              shopId: string | null, shopName: string | null,
              productName: string, productPrice: string, ... }   // plus the other product fields
Address     { id: number, userId: number, fullName: string, phone: string | null,
              address: string, city: string, label: 'home' | 'work' | 'other',
              isDefault: boolean, createdAt: string, updatedAt: string }
AuditLog    { id: number, createdAt: string, userId: number | null, username: string | null,
              userRole: 'customer' | 'admin' | null, action: 'CREATE' | 'READ' | 'UPDATE' |
              'DELETE' | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'REGISTER' | 'SECURITY',
              event: string, method: string | null, path: string | null,
              statusCode: number | null, ipAddress: string | null, userAgent: string | null,
              details: object | null }
PageView    { id: number, createdAt: string, userId: number | null, username: string | null,
              path: string, page: string | null, ipAddress: string | null, userAgent: string | null }
```
