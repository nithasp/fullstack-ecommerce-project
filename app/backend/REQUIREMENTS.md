# API Requirements

## API Endpoints

### Auth
| Method | Route               | Auth | Description                          |
| ------ | ------------------- | ---- | ------------------------------------ |
| POST   | `/auth/register`    | No   | Register — returns access + refresh token |
| POST   | `/auth/login`       | No   | Login — returns access + refresh token    |
| POST   | `/auth/refresh`     | No   | Exchange refresh token for new tokens |
| POST   | `/auth/logout`      | No   | Revoke a refresh token               |
| POST   | `/auth/logout-all`  | JWT  | Revoke all sessions for current user |
| GET    | `/auth/me`          | JWT  | Get current authenticated user       |

### Roles
Every account has a `role`: `customer` (default) or `admin`. Self-registration always creates a customer; a `role` in the register or update body is ignored. Admins are created by `npm run seed:admin`, `POST /admin/users`, or `PUT /admin/users/:id/role`. Admins bypass the ownership rules below and can use the `/admin` routes.

### Users
| Method | Route        | Auth  | Description                              |
| ------ | ------------ | ----- | ---------------------------------------- |
| GET    | `/users`     | Admin | List all users                           |
| GET    | `/users/:id` | JWT   | Get own user (includes recent purchases) — 403 for other users unless admin |
| POST   | `/users`     | Admin | Create user                              |
| PUT    | `/users/:id` | JWT   | Update own user (profile fields only) — 403 for other users unless admin |
| DELETE | `/users/:id` | JWT   | Delete own user — 403 for other users unless admin |

### Products
| Method | Route                | Auth | Description                              |
| ------ | -------------------- | ---- | ---------------------------------------- |
| GET    | `/products`          | JWT  | List all products (`?category=` to filter) |
| GET    | `/products/popular`  | JWT  | Most popular products (by total quantity ordered) |
| GET    | `/products/:id`      | JWT  | Get product by id                        |
| POST   | `/products`          | Admin | Create product                          |
| POST   | `/products/bulk`     | Admin | Bulk create products (array body)       |
| PUT    | `/products/:id`      | Admin | Update product                          |
| DELETE | `/products/:id`      | Admin | Delete product                          |

### Orders
Orders are scoped to the token user: another user's order id returns 404, and another user's id in the URL, query or body returns 403. Admin tokens are exempt from both rules.

| Method | Route                            | Auth | Description                      |
| ------ | -------------------------------- | ---- | -------------------------------- |
| GET    | `/orders`                        | JWT  | List own orders (`?status=` `?userId=`) |
| GET    | `/orders/:id`                    | JWT  | Get own order by id              |
| GET    | `/orders/:id/products`           | JWT  | Get products in own order        |
| GET    | `/orders/user/:userId/current`   | JWT  | Own active orders                |
| GET    | `/orders/user/:userId/completed` | JWT  | Own completed orders             |
| POST   | `/orders`                        | JWT  | Create order for the token user  |
| POST   | `/orders/:id/products`           | JWT  | Add product to own order         |
| PUT    | `/orders/:id`                    | JWT  | Update own order status          |
| DELETE | `/orders/:id`                    | JWT  | Delete own order                 |

### Cart
| Method | Route             | Auth | Description                                      |
| ------ | ----------------- | ---- | ------------------------------------------------ |
| GET    | `/cart`           | JWT  | Get current user's cart                          |
| POST   | `/cart`           | JWT  | Add item (upserts — increments qty if exists)    |
| POST   | `/cart/checkout`  | JWT  | Checkout: create completed order, clear cart     |
| PUT    | `/cart/:id`       | JWT  | Update item quantity                             |
| DELETE | `/cart/:id`       | JWT  | Remove item                                      |
| DELETE | `/cart`           | JWT  | Clear cart                                       |

### Addresses
| Method | Route             | Auth | Description          |
| ------ | ----------------- | ---- | -------------------- |
| GET    | `/addresses`      | JWT  | List user's addresses |
| GET    | `/addresses/:id`  | JWT  | Get address by id    |
| POST   | `/addresses`      | JWT  | Create address       |
| PUT    | `/addresses/:id`  | JWT  | Update address       |
| DELETE | `/addresses/:id`  | JWT  | Delete address       |

### Admin
All routes require an admin token. The role is re-read from the database on every request and every non-GET request is audit-logged. List routes accept `?limit=` (1–100, default 50) and `?offset=`.

| Method | Route                          | Description                                   |
| ------ | ------------------------------ | --------------------------------------------- |
| GET    | `/admin/users`                 | List every user (with role)                   |
| GET    | `/admin/users/:id`             | Any user, with recent purchases               |
| POST   | `/admin/users`                 | Create user; optional `role`                  |
| PUT    | `/admin/users/:id`             | Update any user's profile fields              |
| PUT    | `/admin/users/:id/role`        | Set `customer` / `admin`; revokes that user's refresh tokens; not on self |
| DELETE | `/admin/users/:id`             | Delete any user; not on self                  |
| GET    | `/admin/orders`                | Every order (`?status=` `?userId=`)           |
| GET    | `/admin/orders/:id`            | Any order                                     |
| POST   | `/admin/orders`                | Create order for `userId` in body             |
| PUT    | `/admin/orders/:id`            | Update any order status                       |
| DELETE | `/admin/orders/:id`            | Delete any order                              |
| GET    | `/admin/orders/:id/products`   | Products in any order                         |
| POST   | `/admin/orders/:id/products`   | Add product to any order                      |
| GET    | `/admin/carts`                 | Every user's cart items (`?userId=`)          |
| GET    | `/admin/carts/:userId`         | One user's cart                               |
| POST   | `/admin/carts/:userId`         | Add item to a user's cart                     |
| DELETE | `/admin/carts/:userId`         | Clear a user's cart                           |
| GET    | `/admin/cart-items/:id`        | Any cart item                                 |
| PUT    | `/admin/cart-items/:id`        | Update any cart item quantity                 |
| DELETE | `/admin/cart-items/:id`        | Remove any cart item                          |
| GET    | `/admin/addresses`             | Every user's addresses (`?userId=`)           |
| GET    | `/admin/addresses/:id`         | Any address                                   |
| POST   | `/admin/addresses`             | Create address for `userId` in body           |
| PUT    | `/admin/addresses/:id`         | Update any address                            |
| DELETE | `/admin/addresses/:id`         | Delete any address                            |

**Auth:** Protected routes require `Authorization: Bearer <accessToken>`. Tokens are issued by `/auth/register` and `/auth/login` and carry `userId` and `role`.

---

## Database Schema

### users
| Column     | Type         | Constraints     |
| ---------- | ------------ | --------------- |
| id         | SERIAL       | PRIMARY KEY     |
| first_name | VARCHAR(100) | NOT NULL        |
| last_name  | VARCHAR(100) | NOT NULL        |
| username   | VARCHAR(100) | UNIQUE NOT NULL |
| password   | VARCHAR(255) | NOT NULL        |
| role       | VARCHAR(20)  | NOT NULL, DEFAULT 'customer', CHECK IN ('customer', 'admin') |

### products
| Column         | Type           | Constraints        |
| -------------- | -------------- | ------------------ |
| id             | SERIAL         | PRIMARY KEY        |
| name           | VARCHAR(255)   | NOT NULL           |
| price          | NUMERIC(10,2)  | NOT NULL           |
| category       | VARCHAR(100)   |                    |
| image          | VARCHAR(500)   |                    |
| description    | TEXT           |                    |
| preview_img    | JSONB          | DEFAULT `[]`       |
| types          | JSONB          | DEFAULT `[]`       |
| reviews        | JSONB          | DEFAULT `[]`       |
| overall_rating | NUMERIC(3,1)   | DEFAULT 0          |
| stock          | INTEGER        | DEFAULT 0          |
| is_active      | BOOLEAN        | DEFAULT true       |
| shop_id        | VARCHAR(255)   |                    |
| shop_name      | VARCHAR(255)   |                    |

### orders
| Column  | Type        | Constraints                                       |
| ------- | ----------- | ------------------------------------------------- |
| id      | SERIAL      | PRIMARY KEY                                       |
| user_id | INTEGER     | REFERENCES users(id) ON DELETE CASCADE            |
| status  | VARCHAR(20) | DEFAULT 'active', CHECK IN ('active', 'complete') |

### order_products
| Column     | Type    | Constraints                               |
| ---------- | ------- | ----------------------------------------- |
| id         | SERIAL  | PRIMARY KEY                               |
| order_id   | INTEGER | REFERENCES orders(id) ON DELETE CASCADE   |
| product_id | INTEGER | REFERENCES products(id) ON DELETE CASCADE |
| quantity   | INTEGER | NOT NULL, DEFAULT 1                       |

### refresh_tokens
| Column     | Type         | Constraints                          |
| ---------- | ------------ | ------------------------------------ |
| id         | SERIAL       | PRIMARY KEY                          |
| user_id    | INTEGER      | REFERENCES users(id) ON DELETE CASCADE |
| token_hash | VARCHAR(64)  | UNIQUE NOT NULL                      |
| expires_at | TIMESTAMP    | NOT NULL                             |
| created_at | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP            |

### cart_items
| Column        | Type         | Constraints                               |
| ------------- | ------------ | ----------------------------------------- |
| id            | SERIAL       | PRIMARY KEY                               |
| user_id       | INTEGER      | REFERENCES users(id) ON DELETE CASCADE    |
| product_id    | INTEGER      | REFERENCES products(id) ON DELETE CASCADE |
| quantity      | INTEGER      | NOT NULL, DEFAULT 1, CHECK > 0            |
| type_id       | VARCHAR(255) | NOT NULL, DEFAULT ''                      |
| selected_type | JSONB        |                                           |
| shop_id       | VARCHAR(255) |                                           |
| shop_name     | VARCHAR(255) |                                           |
| created_at    | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP                 |
| updated_at    | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP                 |

Unique constraint: `(user_id, product_id, type_id)`

### addresses
| Column     | Type         | Constraints                                    |
| ---------- | ------------ | ---------------------------------------------- |
| id         | SERIAL       | PRIMARY KEY                                    |
| user_id    | INTEGER      | REFERENCES users(id) ON DELETE CASCADE         |
| full_name  | VARCHAR(255) | NOT NULL                                       |
| phone      | VARCHAR(50)  |                                                |
| address    | TEXT         | NOT NULL                                       |
| city       | VARCHAR(255) | NOT NULL                                       |
| label      | VARCHAR(20)  | DEFAULT 'home', CHECK IN ('home','work','other') |
| is_default | BOOLEAN      | NOT NULL, DEFAULT false                        |
| created_at | TIMESTAMP    | DEFAULT NOW()                                  |
| updated_at | TIMESTAMP    | DEFAULT NOW()                                  |

---

## Data Shapes (TypeScript)

```typescript
User        { id: number, firstName: string, lastName: string, username: string, password: string,
              role: 'customer' | 'admin' }
Product     { id: number, name: string, price: number, category?: string, image?: string,
              description?: string, stock: number, isActive: boolean, shopId?: string, shopName?: string }
Order       { id: number, userId: number, status: 'active' | 'complete' }
OrderProduct{ id: number, orderId: number, productId: number, quantity: number }
CartItem    { id: number, userId: number, productId: number, quantity: number,
              typeId: string, selectedType?: object, shopId?: string, shopName?: string }
Address     { id: number, userId: number, fullName: string, phone?: string, address: string,
              city: string, label: 'home' | 'work' | 'other', isDefault: boolean }
```
