# API Testing (cURL)

> Base URL: `http://localhost:3000` — run `npm run watch` first.

---

## Quick Walkthrough

```bash
# 1. Register and save tokens
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","username":"johndoe","password":"pass1234"}'

TOKEN="your.access.token"

# 2. Create products
curl -s -X POST http://localhost:3000/products \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Keyboard","price":49.99,"category":"electronics"}'

curl -s -X POST http://localhost:3000/products \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Mouse","price":29.99,"category":"electronics"}'

# 3. Add items to cart and checkout
curl -s -X POST http://localhost:3000/cart \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":2}'

curl -s -X POST http://localhost:3000/cart/checkout \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"productId":1,"quantity":2},{"productId":2,"quantity":1}]}'

# 4. Most popular products
curl http://localhost:3000/products/popular
```

---

## Auth

**Register** (returns `accessToken` + `refreshToken`):
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

**Refresh access token:**
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

**List all users:**
```bash
curl http://localhost:3000/users -H "Authorization: Bearer $TOKEN"
```

**Get user by id** (includes 5 most recent purchases):
```bash
curl http://localhost:3000/users/1 -H "Authorization: Bearer $TOKEN"
```

**Create user (admin):**
```bash
curl -X POST http://localhost:3000/users \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"firstName":"Jane","lastName":"Smith","username":"janesmith","password":"pass1234"}'
```

**Update user:**
```bash
curl -X PUT http://localhost:3000/users/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"firstName":"Jane"}'
```

**Delete user:**
```bash
curl -X DELETE http://localhost:3000/users/1 -H "Authorization: Bearer $TOKEN"
```

---

## Products

**Create product** (see [Sample Product Data](#sample-product-data) for more products):
```bash
curl -X POST http://localhost:3000/products \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
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

**List all / filter by category:**
```bash
curl http://localhost:3000/products
curl "http://localhost:3000/products?category=gadgets"
```

**Most popular (ranked by total quantity ordered):**
```bash
curl http://localhost:3000/products/popular
```

**Get / Update / Delete:**
```bash
curl http://localhost:3000/products/1

curl -X PUT http://localhost:3000/products/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"price":14.99}'

curl -X DELETE http://localhost:3000/products/1 -H "Authorization: Bearer $TOKEN"
```

---

## Orders

**Create order:**
```bash
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"user_id":1}'
```

**Add product to order:**
```bash
curl -X POST http://localhost:3000/orders/1/products \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"product_id":1,"quantity":3}'
```

**List / filter orders:**
```bash
curl http://localhost:3000/orders -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3000/orders?status=active&userId=1" -H "Authorization: Bearer $TOKEN"
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

**User order queries:**
```bash
curl http://localhost:3000/orders/user/1/current   -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/orders/user/1/completed -H "Authorization: Bearer $TOKEN"
```

---

## Cart

> All cart routes require `Authorization: Bearer <token>`.

**Get cart:**
```bash
curl http://localhost:3000/cart -H "Authorization: Bearer $TOKEN"
```

**Add item** (increments quantity if same product+type already exists):
```bash
curl -X POST http://localhost:3000/cart \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":2}'
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

**Checkout** (creates a completed order and clears the cart):
```bash
curl -X POST http://localhost:3000/cart/checkout \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"productId":1,"quantity":2},{"productId":2,"quantity":1}]}'
```

---

## Addresses

> All address routes require `Authorization: Bearer <token>`.

**List addresses:**
```bash
curl http://localhost:3000/addresses -H "Authorization: Bearer $TOKEN"
```

**Get address:**
```bash
curl http://localhost:3000/addresses/1 -H "Authorization: Bearer $TOKEN"
```

**Create address:**
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

## Sample Product Data

The endpoint accepts **one product object per request**, so send each item individually
via `POST /products` (requires a valid `$TOKEN`).
This dataset covers multiple categories and includes variant types, reviews, and stock info.

```json
[
    {
        "id": 2,
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
            {
                "_id": "69999b5d6decb17b3853fc1c",
                "productId": 5001,
                "color": "Black",
                "quantity": 60,
                "price": 129.99,
                "stock": 60,
                "image": "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=500"
            },
            {
                "_id": "69999b5d6decb17b3853fc1d",
                "productId": 5002,
                "color": "Rose Gold",
                "quantity": 40,
                "price": 139.99,
                "stock": 40,
                "image": "https://images.unsplash.com/photo-1544117519-31a4b719223d?w=500"
            },
            {
                "_id": "69999b5d6decb17b3853fc1e",
                "productId": 5003,
                "color": "Silver",
                "quantity": 45,
                "price": 134.99,
                "stock": 45,
                "image": "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=500"
            }
        ],
        "reviews": [
            {
                "_id": "69999b5d6decb17b3853fc1f",
                "date": "2026-01-08T08:30:00.000Z",
                "star": 5,
                "userId": "user135",
                "comment": "Excellent fitness tracker! Accurate tracking and great battery life.",
                "userName": "Jennifer Martinez"
            },
            {
                "_id": "69999b5d6decb17b3853fc20",
                "date": "2026-01-19T15:10:00.000Z",
                "star": 4,
                "userId": "user864",
                "comment": "Good features for the price. GPS could be more accurate.",
                "userName": "Chris Lee"
            }
        ],
        "overallRating": 4.7,
        "stock": 145,
        "isActive": true,
        "shopId": "shop_001",
        "shopName": "TechZone Store"
    },
    {
        "id": 3,
        "name": "USB-C Laptop Charger 65W",
        "price": "39.99",
        "category": "Electronics",
        "image": "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500",
        "description": "Universal 65W USB-C fast charger compatible with most laptops, tablets, and smartphones. Compact design with foldable prongs for travel.",
        "previewImg": [
            "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500",
            "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500"
        ],
        "types": [
            {
                "_id": "69999b5d6decb17b3853fc30",
                "productId": 6001,
                "color": "White",
                "quantity": 200,
                "price": 39.99,
                "stock": 200,
                "image": "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500"
            },
            {
                "_id": "69999b5d6decb17b3853fc31",
                "productId": 6002,
                "color": "Black",
                "quantity": 180,
                "price": 39.99,
                "stock": 180,
                "image": "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500"
            }
        ],
        "reviews": [
            {
                "_id": "69999b5d6decb17b3853fc32",
                "date": "2026-02-01T09:00:00.000Z",
                "star": 5,
                "userId": "user901",
                "comment": "Works perfectly with my MacBook and iPad. Very compact!",
                "userName": "Alex Turner"
            }
        ],
        "overallRating": 4.8,
        "stock": 380,
        "isActive": true,
        "shopId": "shop_001",
        "shopName": "TechZone Store"
    },
    {
        "id": 7,
        "name": "Organic Cotton T-Shirt",
        "price": "29.99",
        "category": "Clothing",
        "image": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500",
        "description": "100% organic cotton t-shirt with a modern fit. Soft, breathable, and eco-friendly. Available in multiple colors and sizes.",
        "previewImg": [
            "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500",
            "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=500"
        ],
        "types": [
            {
                "_id": "69999b5d6decb17b3853fc17",
                "productId": 4001,
                "color": "White",
                "quantity": 150,
                "price": 29.99,
                "stock": 150,
                "image": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500"
            },
            {
                "_id": "69999b5d6decb17b3853fc18",
                "productId": 4002,
                "color": "Navy",
                "quantity": 120,
                "price": 29.99,
                "stock": 120,
                "image": "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=500"
            },
            {
                "_id": "69999b5d6decb17b3853fc19",
                "productId": 4003,
                "color": "Gray",
                "quantity": 130,
                "price": 29.99,
                "stock": 130,
                "image": "https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=500"
            }
        ],
        "reviews": [
            {
                "_id": "69999b5d6decb17b3853fc1a",
                "date": "2026-01-12T13:45:00.000Z",
                "star": 5,
                "userId": "user987",
                "comment": "Super comfortable and high quality. Will buy more!",
                "userName": "Lisa Anderson"
            },
            {
                "_id": "69999b5d6decb17b3853fc1b",
                "date": "2026-01-25T10:00:00.000Z",
                "star": 4,
                "userId": "user246",
                "comment": "Nice shirt, fits well. Good value for the price.",
                "userName": "Robert Taylor"
            }
        ],
        "overallRating": 4.5,
        "stock": 400,
        "isActive": true,
        "shopId": "shop_003",
        "shopName": "Urban Fashion Co"
    },
    {
        "id": 8,
        "name": "Classic Denim Jacket",
        "price": "89.99",
        "category": "Clothing",
        "image": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500",
        "description": "Timeless denim jacket with a relaxed fit. Features classic button-front closure, chest pockets, and durable cotton denim construction.",
        "previewImg": [
            "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500",
            "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=500"
        ],
        "types": [
            {
                "_id": "69999b5d6decb17b3853fc50",
                "productId": 8001,
                "color": "Classic Blue",
                "quantity": 40,
                "price": 89.99,
                "stock": 40,
                "image": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500"
            },
            {
                "_id": "69999b5d6decb17b3853fc51",
                "productId": 8002,
                "color": "Dark Wash",
                "quantity": 35,
                "price": 94.99,
                "stock": 35,
                "image": "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=500"
            }
        ],
        "reviews": [
            {
                "_id": "69999b5d6decb17b3853fc52",
                "date": "2026-02-05T11:20:00.000Z",
                "star": 5,
                "userId": "user345",
                "comment": "Perfect jacket for spring. Great quality denim.",
                "userName": "Rachel Kim"
            },
            {
                "_id": "69999b5d6decb17b3853fc53",
                "date": "2026-02-10T14:00:00.000Z",
                "star": 4,
                "userId": "user678",
                "comment": "Fits true to size. Love the classic look.",
                "userName": "Tom Harris"
            }
        ],
        "overallRating": 4.5,
        "stock": 75,
        "isActive": true,
        "shopId": "shop_003",
        "shopName": "Urban Fashion Co"
    },
    {
        "id": 4,
        "name": "Ergonomic Office Chair",
        "price": "249.99",
        "category": "Furniture",
        "image": "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=500",
        "description": "Professional ergonomic office chair with adjustable lumbar support, breathable mesh back, and 360-degree swivel. Designed for all-day comfort and productivity.",
        "previewImg": [
            "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=500",
            "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=500"
        ],
        "types": [
            {
                "_id": "69999b5d6decb17b3853fc0f",
                "productId": 2001,
                "color": "Black",
                "quantity": 25,
                "price": 249.99,
                "stock": 25,
                "image": "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=500"
            },
            {
                "_id": "69999b5d6decb17b3853fc10",
                "productId": 2002,
                "color": "Gray",
                "quantity": 20,
                "price": 249.99,
                "stock": 20,
                "image": "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=500"
            }
        ],
        "reviews": [
            {
                "_id": "69999b5d6decb17b3853fc11",
                "date": "2026-01-10T09:15:00.000Z",
                "star": 5,
                "userId": "user789",
                "comment": "My back pain disappeared after using this chair. Highly recommended!",
                "userName": "Michael Johnson"
            }
        ],
        "overallRating": 5,
        "stock": 45,
        "isActive": true,
        "shopId": "shop_002",
        "shopName": "HomeComfort Hub"
    },
    {
        "id": 5,
        "name": "Stainless Steel Water Bottle",
        "price": "24.99",
        "category": "Sports & Outdoors",
        "image": "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500",
        "description": "Insulated stainless steel water bottle that keeps drinks cold for 24 hours or hot for 12 hours. BPA-free, leak-proof, and perfect for gym, hiking, or daily use.",
        "previewImg": [
            "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500",
            "https://images.unsplash.com/photo-1607003008253-de03b3a43e92?w=500"
        ],
        "types": [
            {
                "_id": "69999b5d6decb17b3853fc12",
                "productId": 3001,
                "color": "Blue",
                "quantity": 100,
                "price": 24.99,
                "stock": 100,
                "image": "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500"
            },
            {
                "_id": "69999b5d6decb17b3853fc13",
                "productId": 3002,
                "color": "Pink",
                "quantity": 80,
                "price": 24.99,
                "stock": 80,
                "image": "https://images.unsplash.com/photo-1607003008253-de03b3a43e92?w=500"
            },
            {
                "_id": "69999b5d6decb17b3853fc14",
                "productId": 3003,
                "color": "Black",
                "quantity": 120,
                "price": 24.99,
                "stock": 120,
                "image": "https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=500"
            }
        ],
        "reviews": [
            {
                "_id": "69999b5d6decb17b3853fc15",
                "date": "2026-01-18T16:20:00.000Z",
                "star": 4,
                "userId": "user321",
                "comment": "Great bottle, keeps water cold all day. The only downside is it's a bit heavy.",
                "userName": "Emma Wilson"
            },
            {
                "_id": "69999b5d6decb17b3853fc16",
                "date": "2026-01-22T11:30:00.000Z",
                "star": 5,
                "userId": "user654",
                "comment": "Perfect for my morning runs. Love the color options!",
                "userName": "David Brown"
            }
        ],
        "overallRating": 4.5,
        "stock": 300,
        "isActive": true,
        "shopId": "shop_002",
        "shopName": "HomeComfort Hub"
    },
    {
        "id": 6,
        "name": "Scented Soy Candle Set",
        "price": "34.99",
        "category": "Home Decor",
        "image": "https://images.unsplash.com/photo-1603006905003-be475563bc59?w=500",
        "description": "Set of 3 hand-poured soy candles in lavender, vanilla, and eucalyptus scents. Burns for 40+ hours each. Perfect for relaxation and home ambiance.",
        "previewImg": [
            "https://images.unsplash.com/photo-1603006905003-be475563bc59?w=500"
        ],
        "types": [
            {
                "_id": "69999b5d6decb17b3853fc41",
                "productId": 7002,
                "color": "Vanilla",
                "quantity": 60,
                "price": 34.99,
                "stock": 60,
                "image": "https://images.unsplash.com/photo-1603006905003-be475563bc59?w=500"
            }
        ],
        "reviews": [
            {
                "_id": "69999b5d6decb17b3853fc42",
                "date": "2026-01-28T17:30:00.000Z",
                "star": 5,
                "userId": "user777",
                "comment": "Beautiful scent and long burn time. Will repurchase!",
                "userName": "Sophie Clark"
            }
        ],
        "overallRating": 4.6,
        "stock": 135,
        "isActive": true,
        "shopId": "shop_002",
        "shopName": "HomeComfort Hub"
    },
    {
        "id": 9,
        "name": "Running Sneakers Pro",
        "price": "119.99",
        "category": "Footwear",
        "image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500",
        "description": "Lightweight performance running shoes with responsive cushioning, breathable mesh upper, and durable rubber outsole. Ideal for daily runs and training.",
        "previewImg": [
            "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500",
            "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=500"
        ],
        "types": [
            {
                "_id": "69999b5d6decb17b3853fc60",
                "productId": 9001,
                "color": "Red",
                "quantity": 55,
                "price": 119.99,
                "stock": 55,
                "image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500"
            },
            {
                "_id": "69999b5d6decb17b3853fc61",
                "productId": 9002,
                "color": "Black",
                "quantity": 70,
                "price": 119.99,
                "stock": 70,
                "image": "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=500"
            }
        ],
        "reviews": [
            {
                "_id": "69999b5d6decb17b3853fc62",
                "date": "2026-02-08T07:45:00.000Z",
                "star": 5,
                "userId": "user444",
                "comment": "Best running shoes I've ever had. Super lightweight!",
                "userName": "Mark Stevens"
            },
            {
                "_id": "69999b5d6decb17b3853fc63",
                "date": "2026-02-12T16:30:00.000Z",
                "star": 4,
                "userId": "user555",
                "comment": "Great for daily training. Cushioning is excellent.",
                "userName": "Nina Patel"
            }
        ],
        "overallRating": 4.5,
        "stock": 125,
        "isActive": true,
        "shopId": "shop_003",
        "shopName": "Urban Fashion Co"
    },
    {
        "id": 10,
        "name": "Wireless Bluetooth Headphones",
        "price": "79.99",
        "category": "Electronics",
        "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500",
        "description": "Premium wireless headphones with active noise cancellation, 30-hour battery life, and crystal-clear sound quality. Perfect for music lovers and professionals.",
        "previewImg": [
            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500",
            "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=500",
            "https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=500"
        ],
        "types": [
            {
                "_id": "69999b5d6decb17b3853fc0b",
                "productId": 1001,
                "color": "Black",
                "quantity": 50,
                "price": 79.99,
                "stock": 50,
                "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500"
            },
            {
                "_id": "69999b5d6decb17b3853fc0c",
                "productId": 1002,
                "color": "Silver",
                "quantity": 35,
                "price": 84.99,
                "stock": 35,
                "image": "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=500"
            }
        ],
        "reviews": [
            {
                "_id": "69999b5d6decb17b3853fc0d",
                "date": "2026-01-15T10:30:00.000Z",
                "star": 5,
                "userId": "user123",
                "comment": "Amazing sound quality! Best headphones I've ever owned.",
                "userName": "John Doe"
            },
            {
                "_id": "69999b5d6decb17b3853fc0e",
                "date": "2026-01-20T14:45:00.000Z",
                "star": 4,
                "userId": "user456",
                "comment": "Great product, but a bit pricey. Worth it for the quality though.",
                "userName": "Sarah Smith"
            }
        ],
        "overallRating": 4.5,
        "stock": 85,
        "isActive": true,
        "shopId": "shop_001",
        "shopName": "TechZone Store"
    }
]
```
