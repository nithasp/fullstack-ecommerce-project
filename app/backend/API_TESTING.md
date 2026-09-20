# API Testing (cURL)

> Base URL: `http://localhost:3000` — run `npm run watch` first.
>
> Prefer Postman? Import [`postman/storefront-api.postman_collection.json`](postman/storefront-api.postman_collection.json) — it covers every route below and saves tokens and ids automatically.
>
> Prefer a browser? With the server running, open **http://localhost:3000/docs** for Swagger UI,
> backed by [`openapi.yaml`](openapi.yaml) — the same routes, callable from the page.

All responses use the shape `{ "status": <code>, "message": "...", "data": ... }`.

Every route except `/`, `/auth/register`, `/auth/login`, `/auth/refresh` and `/auth/logout` requires `Authorization: Bearer <accessToken>`.

Accounts have a `role` of `customer` (default) or `admin`. Product create/update/delete, `GET /users`, `POST /users` and everything under `/admin` need an **admin** token — a customer token gets `403`. Create the admin once with `npm run seed:admin` (see [Admin](#admin)).

---

## Quick Walkthrough

```bash
# 1. Create the admin (once) and log in as it; copy data.accessToken
npm run seed:admin          # uses ADMIN_USERNAME / ADMIN_PASSWORD from .env
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"change-me-to-a-long-password"}'

ADMIN_TOKEN="admin.access.token"

# 2. Create products (admin only)
curl -s -X POST http://localhost:3000/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Keyboard","price":49.99,"category":"Electronics"}'

curl -s -X POST http://localhost:3000/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Mouse","price":29.99,"category":"Electronics"}'

# 3. Register a customer and copy data.accessToken
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","username":"johndoe","password":"pass1234"}'

TOKEN="your.access.token"

# 4. Add items to cart and checkout
curl -s -X POST http://localhost:3000/cart \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":2}'

curl -s -X POST http://localhost:3000/cart/checkout \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"productId":1,"quantity":2},{"productId":2,"quantity":1}]}'

# 5. Most popular products
curl http://localhost:3000/products/popular -H "Authorization: Bearer $TOKEN"
```

---

## Health Check

```bash
curl http://localhost:3000/
```

---

## Auth

> `register`, `login` and `refresh` are rate limited to 20 requests per 15 minutes. Access tokens expire after 15 minutes.

**Register** (password must be at least 8 characters; returns `user`, `accessToken`, `refreshToken`; always creates a `customer` — a `role` in the body is ignored):
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","username":"johndoe","password":"pass1234"}'
```

**Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"johndoe","password":"pass1234"}'
```

**Refresh access token** (rotates both tokens — the old refresh token stops working):
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"your.refresh.token"}'
```

**Get current user:**
```bash
curl http://localhost:3000/auth/me -H "Authorization: Bearer $TOKEN"
```

**Logout:**
```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"your.refresh.token"}'
```

**Logout all sessions:**
```bash
curl -X POST http://localhost:3000/auth/logout-all -H "Authorization: Bearer $TOKEN"
```

---

## Users

> All user routes require `Authorization: Bearer <token>`.
> Get, update and delete only work on **your own** account — use your id (`data.user.id` from register/login). Another user's id returns `403` (admins are exempt).
> Listing and creating users require an **admin** token.

**List all users** (admin):
```bash
curl http://localhost:3000/users -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Get your user** (includes 5 most recent purchases as `recentPurchases`):
```bash
curl http://localhost:3000/users/1 -H "Authorization: Bearer $TOKEN"
```

**Create user** (admin; all four fields required):
```bash
curl -X POST http://localhost:3000/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"firstName":"Jane","lastName":"Smith","username":"janesmith","password":"pass1234"}'
```

**Update your user** (at least one of `firstName`, `lastName`, `username`, `password`; `role` cannot be changed here):
```bash
curl -X PUT http://localhost:3000/users/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"firstName":"Jane"}'
```

**Delete your user:**
```bash
curl -X DELETE http://localhost:3000/users/1 -H "Authorization: Bearer $TOKEN"
```

---

## Products

> All product routes require `Authorization: Bearer <token>`. Create, bulk create, update and delete require an **admin** token (`403` otherwise).

**Create product** (admin; `name` and non-negative `price` required; see [Sample Product Data](#sample-product-data) for more products):
```bash
curl -X POST http://localhost:3000/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "name": "Smart Fitness Tracker Watch",
    "price": "129.99",
    "category": "Electronics",
    "image": "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=500",
    "description": "Advanced fitness tracker with heart rate monitor, sleep tracking, GPS, and 7-day battery life. Compatible with iOS and Android. Track your workouts and health goals effortlessly.",
    "previewImg": [
      "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=500",
      "https://images.unsplash.com/photo-1544117519-31a4b719223d?w=500",
      "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=500"
    ],
    "types": [
      {"_id":"69999b5d6decb17b3853fc1c","productId":5001,"color":"Black","quantity":60,"price":129.99,"stock":60,"image":"https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=500"},
      {"_id":"69999b5d6decb17b3853fc1d","productId":5002,"color":"Rose Gold","quantity":40,"price":139.99,"stock":40,"image":"https://images.unsplash.com/photo-1544117519-31a4b719223d?w=500"},
      {"_id":"69999b5d6decb17b3853fc1e","productId":5003,"color":"Silver","quantity":45,"price":134.99,"stock":45,"image":"https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=500"}
    ],
    "reviews": [
      {"_id":"69999b5d6decb17b3853fc1f","date":"2026-01-08T08:30:00.000Z","star":5,"userId":"user135","comment":"Excellent fitness tracker! Accurate tracking and great battery life.","userName":"Jennifer Martinez"},
      {"_id":"69999b5d6decb17b3853fc20","date":"2026-01-19T15:10:00.000Z","star":4,"userId":"user864","comment":"Good features for the price. GPS could be more accurate.","userName":"Chris Lee"}
    ],
    "overallRating": 4.7,
    "stock": 145,
    "isActive": true,
    "shopId": "shop_001",
    "shopName": "TechZone Store"
  }'
```

**Bulk create products** (admin) from `sample-product-data/products.json` (run from `app/backend/`):
```bash
curl -X POST http://localhost:3000/products/bulk \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d @sample-product-data/products.json
```

**List all / filter by category:**
```bash
curl http://localhost:3000/products -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3000/products?category=Electronics" -H "Authorization: Bearer $TOKEN"
```

**Most popular (ranked by total quantity ordered):**
```bash
curl http://localhost:3000/products/popular -H "Authorization: Bearer $TOKEN"
```

**Get / Update (admin) / Delete (admin):**
```bash
curl http://localhost:3000/products/1 -H "Authorization: Bearer $TOKEN"

curl -X PUT http://localhost:3000/products/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"price":14.99,"stock":50}'

curl -X DELETE http://localhost:3000/products/1 -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Orders

> All order routes require `Authorization: Bearer <token>` and only work on **your own** orders. `status` is `active` or `complete`.
> Another user's order id returns `404`. Another user's id in the URL, query or body returns `403`. Admin tokens are exempt from both.

**Create order** (created for the token user; `userId` is optional and must be your own id; `status` defaults to `active`):
```bash
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"active"}'
```

**Add product to order:**
```bash
curl -X POST http://localhost:3000/orders/1/products \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":3}'
```

**List / filter your orders:**
```bash
curl http://localhost:3000/orders -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3000/orders?status=active" -H "Authorization: Bearer $TOKEN"
```

**Get / Update / Delete:**
```bash
curl http://localhost:3000/orders/1 -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/orders/1/products -H "Authorization: Bearer $TOKEN"

curl -X PUT http://localhost:3000/orders/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"complete"}'

curl -X DELETE http://localhost:3000/orders/1 -H "Authorization: Bearer $TOKEN"
```

**Your order queries** (`:userId` must be your own id):
```bash
curl http://localhost:3000/orders/user/1/current   -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/orders/user/1/completed -H "Authorization: Bearer $TOKEN"
```

---

## Cart

> All cart routes require `Authorization: Bearer <token>` and act on the user from the token.

**Get cart:**
```bash
curl http://localhost:3000/cart -H "Authorization: Bearer $TOKEN"
```

**Add item** (increments quantity if same product+type already exists; `quantity` defaults to 1; `typeId`, `selectedType`, `shopId`, `shopName` are optional):
```bash
curl -X POST http://localhost:3000/cart \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":2,"typeId":"69999b5d6decb17b3853fc1c","selectedType":{"color":"Black","price":129.99},"shopId":"shop_001","shopName":"TechZone Store"}'
```

**Update item quantity:**
```bash
curl -X PUT http://localhost:3000/cart/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"quantity":5}'
```

**Remove item:**
```bash
curl -X DELETE http://localhost:3000/cart/1 -H "Authorization: Bearer $TOKEN"
```

**Clear cart:**
```bash
curl -X DELETE http://localhost:3000/cart -H "Authorization: Bearer $TOKEN"
```

**Checkout** (creates a completed order from `items` and clears the cart):
```bash
curl -X POST http://localhost:3000/cart/checkout \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"productId":1,"quantity":2},{"productId":2,"quantity":1}]}'
```

---

## Addresses

> All address routes require `Authorization: Bearer <token>` and act on the user from the token.

**List addresses:**
```bash
curl http://localhost:3000/addresses -H "Authorization: Bearer $TOKEN"
```

**Get address:**
```bash
curl http://localhost:3000/addresses/1 -H "Authorization: Bearer $TOKEN"
```

**Create address** (`fullName`, `address`, `city` required; `label` is `home` | `work` | `other`, defaults to `home`):
```bash
curl -X POST http://localhost:3000/addresses \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fullName":"John Doe","address":"123 Main St","city":"New York","phone":"555-1234","label":"home","isDefault":true}'
```

**Update address:**
```bash
curl -X PUT http://localhost:3000/addresses/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"city":"Brooklyn","isDefault":true}'
```

**Delete address:**
```bash
curl -X DELETE http://localhost:3000/addresses/1 -H "Authorization: Bearer $TOKEN"
```

---

## Admin

> Every `/admin` route requires an **admin** token. The role is re-checked in the database on each call (a demoted admin is blocked immediately) and every non-GET request is written to the server audit log.
> List routes accept `?limit=` (1–100, default 50) and `?offset=`.

**Create the first admin** (self-registration can never create one). Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` (12+ characters) in `.env`, then:
```bash
npm run seed:admin
```
Then log in with those credentials at `POST /auth/login` and use the returned `accessToken` as `$ADMIN_TOKEN`. A customer token on any admin route returns `403 Admin access required`.

### Users
```bash
# List every user (with role), paginated
curl "http://localhost:3000/admin/users?limit=50&offset=0" -H "Authorization: Bearer $ADMIN_TOKEN"

# Any user, with recentPurchases
curl http://localhost:3000/admin/users/2 -H "Authorization: Bearer $ADMIN_TOKEN"

# Create a user with an explicit role (customer | admin)
curl -X POST http://localhost:3000/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"firstName":"Staff","lastName":"Member","username":"staff1","password":"staffpass123","role":"admin"}'

# Update any user's profile fields
curl -X PUT http://localhost:3000/admin/users/2 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"firstName":"Renamed"}'

# Change a role (revokes that user's refresh tokens; you cannot change your own role)
curl -X PUT http://localhost:3000/admin/users/2/role \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"role":"admin"}'

# Delete any user (you cannot delete your own account here)
curl -X DELETE http://localhost:3000/admin/users/2 -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Orders
```bash
# Every order from every user; optional ?status= and ?userId=
curl "http://localhost:3000/admin/orders?status=active&userId=2&limit=50" -H "Authorization: Bearer $ADMIN_TOKEN"

# Create an order for a user
curl -X POST http://localhost:3000/admin/orders \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"userId":2,"status":"active"}'

# Get / update / delete any order, and manage its products
curl http://localhost:3000/admin/orders/1 -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X PUT http://localhost:3000/admin/orders/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"complete"}'
curl http://localhost:3000/admin/orders/1/products -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X POST http://localhost:3000/admin/orders/1/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":2}'
curl -X DELETE http://localhost:3000/admin/orders/1 -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Carts
```bash
# Every user's cart items (joined with product data); optional ?userId=
curl "http://localhost:3000/admin/carts?userId=2&limit=50" -H "Authorization: Bearer $ADMIN_TOKEN"

# One user's cart / add an item to it / clear it
curl http://localhost:3000/admin/carts/2 -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X POST http://localhost:3000/admin/carts/2 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":2}'
curl -X DELETE http://localhost:3000/admin/carts/2 -H "Authorization: Bearer $ADMIN_TOKEN"

# Any single cart item by id
curl http://localhost:3000/admin/cart-items/1 -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X PUT http://localhost:3000/admin/cart-items/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"quantity":5}'
curl -X DELETE http://localhost:3000/admin/cart-items/1 -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Addresses
```bash
# Every user's addresses; optional ?userId=
curl "http://localhost:3000/admin/addresses?userId=2&limit=50" -H "Authorization: Bearer $ADMIN_TOKEN"

# Create an address for a user
curl -X POST http://localhost:3000/admin/addresses \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"userId":2,"fullName":"John Doe","address":"123 Main St","city":"New York","label":"home","isDefault":true}'

# Get / update / delete any address
curl http://localhost:3000/admin/addresses/1 -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X PUT http://localhost:3000/admin/addresses/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"city":"Brooklyn"}'
curl -X DELETE http://localhost:3000/admin/addresses/1 -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Sample Product Data

Use `POST /products/bulk` to insert all products in a **single request** (requires an admin `$ADMIN_TOKEN`).
This dataset covers multiple categories and includes variant types, reviews, and stock info.

**PowerShell (Windows)** — run from `app/backend/`:
```powershell
$ADMIN_TOKEN = "admin.access.token"
$body = Get-Content -Raw "sample-product-data/products.json"
Invoke-RestMethod -Method Post -Uri http://localhost:3000/products/bulk `
  -Headers @{ Authorization="Bearer $ADMIN_TOKEN"; "Content-Type"="application/json" } `
  -Body $body
```

**cURL add all sample product data from sample-product-data/products.json**
```bash
curl -X POST http://localhost:3000/products/bulk \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d @sample-product-data/products.json
```
