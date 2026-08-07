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
OMISE_SECRET_KEY=skey_test_...    # see Omise Payments below
OMISE_PUBLIC_KEY=pkey_test_...    # optional (not used by the current flows)
OMISE_CURRENCY=thb                # optional, defaults to thb
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
| Webhooks   | `/webhooks`   | Stripe: signature / Omise: charge re-fetch |

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

## Omise Payments (Thai local methods)

TrueMoney Wallet, Rabbit LINE Pay, ShopeePay, mobile/internet banking, and installments (ผ่อนชำระ) are processed by [Omise (Opn Payments)](https://www.omise.co/). These are **redirect-based** payments: the customer approves the charge in their wallet/bank app and is then sent back to the store.

**Flow**

1. `GET /payments/omise/config` — which methods (and banks / installment terms) are enabled on the Omise account, driven by the Omise capability API. The cart dialog renders only what can actually charge.
2. `POST /payments/omise/create-charge` — body `{ cartItemIds, discountCode?, method, phoneNumber?, bankSourceType?, installmentBank?, installmentTerm?, returnOrigin }`. The server prices the items from the database, creates an order (`payment_provider='omise'`), an Omise source + charge, and returns the `authorizeUri` to redirect the customer to.
3. The customer approves (or cancels) the payment on the wallet/bank page and is redirected back to `/cart/confirmation?provider=omise&orderId=N`.
4. `POST /payments/omise/confirm` — body `{ orderId }`. Re-fetches the charge from Omise, finalizes the order (`paid` / `failed`), and removes purchased items from the cart. The confirmation page polls this while the charge is pending. Idempotent.
5. `POST /webhooks/omise` — same finalization driven by Omise `charge.*` events. Omise webhooks are unsigned, so the handler never trusts the payload — it re-fetches the charge from the API and only that verified object drives order state.

**Setup**

1. [Sign up for a free Omise account](https://dashboard.omise.co/signup) (test mode needs no business documents) and copy the **test secret key** from Keys → set `OMISE_SECRET_KEY` in `.env`.
2. In the Omise dashboard (test mode), enable the payment methods you want to offer (TrueMoney, Rabbit LINE Pay, ShopeePay, mobile banking, installments). Methods not enabled on the account are hidden in the cart automatically.
3. Run `npm run migrate:up` (adds `payment_provider` / `payment_method` columns to `orders`).
4. Optional: point an Omise webhook at `https://<your-tunnel>/webhooks/omise` (dashboard → Webhooks). Without it, orders are still finalized by the confirmation page through `POST /payments/omise/confirm`.

**Notes**

- Omise Thailand accounts charge in THB (`OMISE_CURRENCY=thb`); amounts are sent in satang. Most methods require a minimum charge of ฿20, and installments have per-bank minimums — Omise's error message is surfaced to the customer if the total is too low.
- In test mode the `authorizeUri` opens a simulator page where you can click **Mark as successful / failed / expired** to exercise every outcome.
- Going live requires an approved Omise merchant account (Thai business registration + Thai bank account) and live keys.

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
