# API Testing (cURL)

> API base URL: `http://localhost:3000/api/v1` — run `npm run watch` first. (The health check, `/docs` and `/openapi.yaml` sit at the server root.)
>
> Prefer Postman? Import [`postman/storefront-api.postman_collection.json`](postman/storefront-api.postman_collection.json) — it covers every route below and saves tokens and ids automatically.
>
> Prefer a browser? With the server running, open **http://localhost:3000/docs** for Swagger UI,
> backed by [`openapi.yaml`](openapi.yaml) — the same routes, callable from the page.

Every response uses the shape `{ "status": <code>, "message": "...", "data": ... }`, and an error
adds a `"code"` such as `token_expired` or `not_found`. Paginated lists (`?limit=` 1–100, default
50, and `?offset=`) add `"meta": { "limit", "offset", "total" }`.

Money (`price`, `unitPrice`, `total`) comes back as a **string** like `"19.99"`, so no decimal is
lost on the way.

## Sessions and cookies

`register`, `login` and `refresh` return `{ user, accessToken }` in the body and set the refresh
token as an **HttpOnly cookie**. With cURL, keep a cookie jar so the session survives between
calls:

```bash
API=http://localhost:3000/api/v1
JAR=cookies.txt      # -c writes cookies, -b sends them
```

Everything else needs the access token: `Authorization: Bearer <accessToken>`. Access tokens last
15 minutes; `POST /auth/refresh` issues a new one from the cookie.

Accounts have a `role` of `customer` (default) or `admin`. Everything under `/admin` needs an
admin token — a customer token gets `403`. Create the first admin with `npm run seed:admin`.

Passwords must be at least 8 characters wherever one is set. A taken username returns `409`; an id
that points at nothing returns `400` or `404`.

---

## Quick walkthrough

```bash
API=http://localhost:3000/api/v1
JAR=cookies.txt

# 1. Create the admin once, then log in as it and copy data.accessToken
npm run seed:admin                     # uses ADMIN_USERNAME / ADMIN_PASSWORD from .env
curl -s -c $JAR -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-admin-password"}'

ADMIN_TOKEN="admin.access.token"

# 2. Add products (admin only)
curl -s -X POST $API/admin/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Keyboard","price":49.99,"category":"Electronics","stock":25}'

curl -s -X POST $API/admin/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Mouse","price":29.99,"category":"Electronics","stock":40}'

# 3. Register a customer (its own cookie jar) and copy data.accessToken
curl -s -c customer.txt -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","username":"johndoe","password":"pass1234"}'

TOKEN="customer.access.token"

# 4. Put things in the cart — the reply carries the cart row id
curl -s -X POST $API/cart \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":2}'

# 5. Buy the rows you picked (ids from step 4 or from GET /cart)
curl -s -X POST $API/cart/checkout \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"cartItemIds":[1]}'

# 6. The order, with what it cost
curl -s $API/orders -H "Authorization: Bearer $TOKEN"

# 7. Most bought products
curl -s $API/products/popular -H "Authorization: Bearer $TOKEN"
```

---

## Health check

```bash
curl http://localhost:3000/
# { "message": "Storefront API is running!" }
```

---

## Auth

```bash
# Register — sets the refresh cookie, returns { user, accessToken }
curl -s -c $JAR -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"johndoe","password":"pass1234","firstName":"John","lastName":"Doe"}'

# Log in (firstName/lastName are not needed here)
curl -s -c $JAR -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"johndoe","password":"pass1234"}'

# Renew the session from the cookie: new access token, rotated cookie
curl -s -b $JAR -c $JAR -X POST $API/auth/refresh

# The signed-in account
curl -s $API/auth/me -H "Authorization: Bearer $TOKEN"

# End this session (clears the cookie)
curl -s -b $JAR -c $JAR -X POST $API/auth/logout

# End every session of the account
curl -s -b $JAR -c $JAR -X POST $API/auth/logout-all -H "Authorization: Bearer $TOKEN"
```

A username is matched case-insensitively, so `JohnDoe` and `johndoe` are the same account. A
refresh token works once: sending the same one twice revokes that whole session, and the second
call answers `401 token_invalid`.

---

## Users

These routes serve the token's own account. Any other id answers `403` — even with an admin
token, which has `/admin/users` for that.

```bash
# Your account, with your five most recent purchases
curl -s $API/users/1 -H "Authorization: Bearer $TOKEN"

# Change your profile (at least one of firstName, lastName, username)
curl -s -X PATCH $API/users/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"firstName":"Johnny"}'

# Change your password: needs the current one; every other session ends and
# the reply carries a fresh access token and cookie
curl -s -b $JAR -c $JAR -X PUT $API/users/1/password \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"currentPassword":"pass1234","newPassword":"newpass1234"}'

# Close your account: profile scrubbed, addresses and cart deleted, sessions ended,
# orders kept, username freed
curl -s -X DELETE $API/users/1 -H "Authorization: Bearer $TOKEN"
```

---

## Products

Read-only, and limited to products on sale. Managing the catalog is under [Admin · Products](#products-1).

```bash
# The catalog, paginated
curl -s "$API/products?limit=10&offset=0" -H "Authorization: Bearer $TOKEN"

# Filter by category (exact) or search name and description — both case-insensitive
curl -s "$API/products?category=Electronics" -H "Authorization: Bearer $TOKEN"
curl -s "$API/products?search=keyboard" -H "Authorization: Bearer $TOKEN"

# Every category on sale
curl -s $API/products/categories -H "Authorization: Bearer $TOKEN"

# The five most bought products, counting completed orders only
curl -s $API/products/popular -H "Authorization: Bearer $TOKEN"

# One product (an archived one answers 404)
curl -s $API/products/1 -H "Authorization: Bearer $TOKEN"
```

---

## Cart

```bash
# What is in the cart, each row with its product
curl -s $API/cart -H "Authorization: Bearer $TOKEN"

# Add a product; adding the same one again adds up the quantity
curl -s -X POST $API/cart \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":2}'

# Add a specific option of a product — its price and stock come from the product
curl -s -X POST $API/cart \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":1,"typeId":"69999b5d6decb17b3853fc1d"}'

# Change a quantity / remove a row / empty the cart
curl -s -X PATCH $API/cart/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"quantity":3}'
curl -s -X DELETE $API/cart/1 -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE $API/cart -H "Authorization: Bearer $TOKEN"

# Buy the rows you picked: quantities come from the cart, prices and stock from the
# products, and only those rows leave the cart
curl -s -X POST $API/cart/checkout \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"cartItemIds":[1,2]}'
```

Checkout answers `409` and changes nothing when a product was archived, an option is gone, stock
is short, or one of the ids is not in your cart:

```json
{ "status": 409, "message": "Only 2 left of \"Keyboard\"", "data": null, "code": "conflict" }
```

---

## Orders

Checkout creates them; they are read-only here. Someone else's order answers `404`.

```bash
# Your orders, newest first, each with its total
curl -s "$API/orders?limit=10" -H "Authorization: Bearer $TOKEN"
curl -s "$API/orders?status=complete" -H "Authorization: Bearer $TOKEN"

# One order, and what it holds (each line keeps the price paid)
curl -s $API/orders/1 -H "Authorization: Bearer $TOKEN"
curl -s $API/orders/1/products -H "Authorization: Bearer $TOKEN"
```

---

## Addresses

```bash
# Your addresses, default first
curl -s $API/addresses -H "Authorization: Bearer $TOKEN"
curl -s $API/addresses/1 -H "Authorization: Bearer $TOKEN"

# Save one — the first address saved becomes the default
curl -s -X POST $API/addresses \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fullName":"John Doe","phone":"0700000000","address":"12 Main Street","city":"London","label":"home","isDefault":true}'

# Change one (at least one field) / delete one
curl -s -X PATCH $API/addresses/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"city":"Oxford"}'
curl -s -X DELETE $API/addresses/1 -H "Authorization: Bearer $TOKEN"
```

Deleting the default address hands the default to the oldest one left.

---

## Page views

```bash
# The frontend reports each page a signed-in user opens
curl -s -X POST $API/page-views \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"path":"/products/5","page":"Product detail"}'
```

These land in `page_views`, read by admins at `GET /admin/page-views`. They are not part of the
audit log.

---

## Admin

Every route needs an admin token, and the role is re-read from the database on each request.
List routes are paginated.

### Users

```bash
# Every open account
curl -s "$API/admin/users?limit=20" -H "Authorization: Bearer $ADMIN_TOKEN"

# One account, with its recent purchases
curl -s $API/admin/users/2 -H "Authorization: Bearer $ADMIN_TOKEN"

# Create an account with a role (customer | admin)
curl -s -X POST $API/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"firstName":"Jane","lastName":"Doe","username":"janedoe","password":"pass1234","role":"admin"}'

# Profile fields of any account
curl -s -X PATCH $API/admin/users/2 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"lastName":"Smith"}'

# Change a role — ends that account's sessions; you cannot change your own
curl -s -X PUT $API/admin/users/2/role \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"role":"admin"}'

# Reset a password without the old one — ends that account's sessions
curl -s -X PUT $API/admin/users/2/password \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"newPassword":"freshpass1234"}'

# Close an account (keeps its orders); you cannot close your own here
curl -s -X DELETE $API/admin/users/2 -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Products

```bash
# Every product, archived ones included
curl -s "$API/admin/products?limit=20" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s $API/admin/products/1 -H "Authorization: Bearer $ADMIN_TOKEN"

# Add one. Options each carry their own price and stock
curl -s -X POST $API/admin/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Keyboard","price":49.99,"category":"Electronics","stock":25,
       "types":[{"_id":"black","color":"Black","price":49.99,"stock":15},
                {"_id":"white","color":"White","price":54.99,"stock":10}]}'

# Add many at once — one bad product rejects the whole import
curl -s -X POST $API/admin/products/bulk \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '[{"name":"Mouse","price":29.99},{"name":"Monitor","price":199.00}]'

# Change only the fields you send
curl -s -X PATCH $API/admin/products/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"price":44.99,"stock":30}'

# Archive it (isActive: false) — the row stays, so past orders keep it
curl -s -X DELETE $API/admin/products/1 -H "Authorization: Bearer $ADMIN_TOKEN"

# Put it back on sale
curl -s -X PATCH $API/admin/products/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"isActive":true}'
```

### Orders

```bash
# Every order; optional ?status= and ?userId=
curl -s "$API/admin/orders?status=complete&limit=20" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s $API/admin/orders/1 -H "Authorization: Bearer $ADMIN_TOKEN"

# Open an order for a user, then add lines (priced from the product now)
curl -s -X POST $API/admin/orders \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"userId":2,"status":"active"}'

curl -s -X POST $API/admin/orders/1/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":2}'

curl -s $API/admin/orders/1/products -H "Authorization: Bearer $ADMIN_TOKEN"

# Change the status / delete the order and its lines
curl -s -X PATCH $API/admin/orders/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"complete"}'
curl -s -X DELETE $API/admin/orders/1 -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Carts

```bash
# Cart rows across accounts; optional ?userId=
curl -s "$API/admin/carts?userId=2" -H "Authorization: Bearer $ADMIN_TOKEN"

# One account's cart / add to it / empty it
curl -s $API/admin/carts/2 -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s -X POST $API/admin/carts/2 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":2}'
curl -s -X DELETE $API/admin/carts/2 -H "Authorization: Bearer $ADMIN_TOKEN"

# One cart row by id
curl -s $API/admin/cart-items/1 -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s -X PATCH $API/admin/cart-items/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"quantity":5}'
curl -s -X DELETE $API/admin/cart-items/1 -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Addresses

```bash
# Addresses across accounts; optional ?userId=
curl -s "$API/admin/addresses?userId=2" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s $API/admin/addresses/1 -H "Authorization: Bearer $ADMIN_TOKEN"

# Save one for a user, change it, delete it
curl -s -X POST $API/admin/addresses \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"userId":2,"fullName":"Jane Doe","address":"5 High Street","city":"Leeds"}'
curl -s -X PATCH $API/admin/addresses/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"isDefault":true}'
curl -s -X DELETE $API/admin/addresses/1 -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Audit log

Security-relevant events, newest first. Read-only: no route edits or deletes an entry, and rows
older than `AUDIT_LOG_RETENTION_DAYS` (default 90) are deleted daily.

```bash
# The newest entries
curl -s "$API/admin/audit-logs?limit=25" -H "Authorization: Bearer $ADMIN_TOKEN"

# One account's entries, or any username containing "ali"
curl -s "$API/admin/audit-logs?userId=2" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s "$API/admin/audit-logs?username=ali" -H "Authorization: Bearer $ADMIN_TOKEN"

# Only some types (comma-separated): CREATE, READ, UPDATE, DELETE,
# LOGIN, LOGIN_FAILED, LOGOUT, REGISTER, SECURITY
curl -s "$API/admin/audit-logs?action=LOGIN,LOGIN_FAILED" -H "Authorization: Bearer $ADMIN_TOKEN"

# Only failed requests (status 400 and above) in a time range; `to` is exclusive
curl -s "$API/admin/audit-logs?result=failure&from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

One entry looks like this:

```json
{
  "id": 42,
  "createdAt": "2026-09-22T10:42:05.000Z",
  "userId": 7,
  "username": "johndoe",
  "userRole": "customer",
  "action": "CREATE",
  "event": "cart.item_added",
  "method": "POST",
  "path": "/api/v1/cart",
  "statusCode": 201,
  "ipAddress": "203.0.113.5",
  "userAgent": "Mozilla/5.0 ...",
  "details": { "productId": 5, "quantity": 2 }
}
```

`details` keeps a few non-secret facts only — ids, quantities, or the names of the fields an
update carried. Never a password, a token or a whole request body.

### Page views

```bash
# The pages people opened, newest first
curl -s "$API/admin/page-views?limit=25" -H "Authorization: Bearer $ADMIN_TOKEN"

# One account, or every view of a path
curl -s "$API/admin/page-views?userId=2" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s "$API/admin/page-views?path=/products" -H "Authorization: Bearer $ADMIN_TOKEN"

# A time range; `to` is exclusive
curl -s "$API/admin/page-views?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Errors you will meet

| Status | `code` | When |
| ------ | ------ | ---- |
| 400 | `invalid_request` | A field is missing or wrong — `message` names it, e.g. `quantity must be a whole number between 1 and 999` |
| 401 | `no_token` / `token_expired` / `token_invalid` | No `Authorization` header, an expired access token, or one that does not check out |
| 401 | `invalid_credentials` | Wrong username or password, or a wrong `currentPassword` |
| 403 | `forbidden` | Someone else's account, or a customer token on `/admin` |
| 404 | `not_found` | Nothing with that id — or it belongs to someone else |
| 409 | `conflict` | A taken username, or a checkout that no longer adds up |
| 413 | `invalid_request` | Body over `JSON_BODY_LIMIT` (1 MB by default) |
| 429 | `rate_limited` | Too many requests from this IP |
| 500 | `internal_error` | Something went wrong; the details are in the server log under the `X-Request-Id` of the response |

---

## Sample product data

[`sample-product-data/products.json`](sample-product-data/products.json) holds nine products with
options, reviews and images. Import them all at once:

```bash
curl -s -X POST $API/admin/products/bulk \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  --data-binary @sample-product-data/products.json
```
