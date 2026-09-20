# Storefront Backend API

## Setup

### 1. Install packages
```bash
npm install
```

### 2. Database setup
The application uses **PostgreSQL** on port **5432**.

**Option A — Docker (recommended):**
```bash
docker-compose up -d
```
Starts PostgreSQL and creates `storefront_dev` + `storefront_test` databases automatically. Skip to step 4.

**Option B — Local PostgreSQL:**
```sql
CREATE USER storefront_user WITH PASSWORD 'storefront_pass';
CREATE DATABASE storefront_dev;
CREATE DATABASE storefront_test;
GRANT ALL PRIVILEGES ON DATABASE storefront_dev TO storefront_user;
GRANT ALL PRIVILEGES ON DATABASE storefront_test TO storefront_user;
```

### 3. Environment variables
Copy `.env.example` to `.env` and fill in values:

```
ENV=dev
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=storefront_dev
POSTGRES_TEST_DB=storefront_test
POSTGRES_USER=storefront_user
POSTGRES_PASSWORD=storefront_pass
BCRYPT_PASSWORD=your-secret-pepper
SALT_ROUNDS=10
TOKEN_SECRET=your-jwt-secret
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY_DAYS=7
PORT=3000
ALLOWED_ORIGIN=http://localhost:4200
API_RATE_LIMIT=500          # requests per IP per 15 min (optional)
JSON_BODY_LIMIT=1mb         # max JSON body (optional)
ADMIN_USERNAME=admin        # used by `npm run seed:admin` only
ADMIN_PASSWORD=change-me-to-a-long-password
```

### 4. Run migrations
```bash
npm run migrate:up
```

### 4b. Create the first admin
Self-registration always creates a `customer`. The only ways to get an `admin` account are this script or an existing admin calling `PUT /admin/users/:id/role`.

```bash
# set ADMIN_USERNAME / ADMIN_PASSWORD (12+ chars) in .env, then:
npm run seed:admin
```
Re-running it is safe: an existing account with that username is promoted, not recreated.

### 5. Start the server
```bash
npm run watch    # development (auto-reload)
npm start        # production (build first)
```

### 6. Run tests
```bash
npm test
```

---

## API Routes

| Group      | Base Path     | Auth Required            |
| ---------- | ------------- | ------------------------ |
| Auth       | `/auth`       | Partial                  |
| Users      | `/users`      | JWT (list/create: admin) |
| Products   | `/products`   | JWT (writes: admin)      |
| Orders     | `/orders`     | JWT                      |
| Cart       | `/cart`       | JWT                      |
| Addresses  | `/addresses`  | JWT                      |
| Admin      | `/admin`      | JWT + admin role         |

### Roles
Every account has a `role`: `customer` (default) or `admin`.

- **Customers** only reach their own users/orders/cart/addresses (another user's id returns `403` or `404`).
- **Admins** bypass those ownership checks and get the `/admin` namespace: list and CRUD **every** user's orders, carts and addresses, manage users and roles, and write to the product catalog.
- Admin routes re-check the role in the database on every call, and every admin mutation is written to the audit log.

See [API_TESTING.md](API_TESTING.md) for full cURL examples and [SECURITY.md](SECURITY.md) for how the API maps to the OWASP API Security Top 10.

---

## Ports

| Service  | Port |
| -------- | ---- |
| Backend  | 3000 |
| Database | 5432 |

## Scripts

| Command                  | Description                |
| ------------------------ | -------------------------- |
| `npm run watch`          | Dev server with auto-reload |
| `npm run build`          | Compile TypeScript          |
| `npm start`              | Run compiled server         |
| `npm test`               | Run test suite              |
| `npm run migrate:up`     | Run migrations              |
| `npm run migrate:down`   | Rollback last migration     |
| `npm run migrate:reset`  | Reset all migrations        |
| `npm run seed:admin`     | Create/promote the admin account from `ADMIN_USERNAME` / `ADMIN_PASSWORD` |
