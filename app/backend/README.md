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
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # optional, see Stripe Payments below
STRIPE_CURRENCY=usd               # optional, defaults to usd
```

### 4. Run migrations
```bash
npm run migrate:up
```

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

| Group      | Base Path     | Auth Required |
| ---------- | ------------- | ------------- |
| Auth       | `/auth`       | Partial       |
| Users      | `/users`      | JWT           |
| Products   | `/products`   | Partial       |
| Orders     | `/orders`     | JWT           |
| Cart       | `/cart`       | JWT           |
| Addresses  | `/addresses`  | JWT           |
| Payments   | `/payments`   | Partial       |
| Webhooks   | `/webhooks`   | Stripe signature |

See [API_TESTING.md](API_TESTING.md) for full cURL examples.

---

## Stripe Payments

Card checkout ("Visa" / "Mastercard" in the cart) is processed by Stripe using Payment Intents + Stripe Elements.

**Flow**

1. `POST /payments/create-intent` — body `{ cartItemIds: number[], discountCode? }`. The server prices the items from the database (client amounts are never trusted), creates an order (`status='active'`, `payment_status='pending'`) and a PaymentIntent, and returns the `clientSecret`.
2. The frontend collects card details in the Stripe Payment Element and confirms the payment.
3. `POST /payments/confirm` — body `{ paymentIntentId }`. Verifies the payment with Stripe, marks the order `complete` / `paid`, and removes the purchased items from the cart. Idempotent.
4. `POST /webhooks/stripe` — same finalization driven by Stripe events (`payment_intent.succeeded`, `payment_intent.payment_failed`). This is the source of truth if the client disconnects after paying.

**Setup**

1. Grab test keys from the [Stripe dashboard](https://dashboard.stripe.com/test/apikeys) and set `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` in `.env`. The frontend fetches the publishable key from `GET /payments/config` — no frontend config needed.
2. Run `npm run migrate:up` (adds payment columns to `orders`).
3. Optional (recommended): forward webhooks locally and set the printed secret as `STRIPE_WEBHOOK_SECRET`:

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
```

Without the webhook secret, orders are still finalized through `POST /payments/confirm` after the client-side payment succeeds.

**Testing** — use Stripe test cards, e.g. `4242 4242 4242 4242` (success) or `4000 0000 0000 0002` (declined), any future expiry / any CVC.

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
