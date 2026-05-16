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

### Users
| Method | Route        | Auth | Description                              |
| ------ | ------------ | ---- | ---------------------------------------- |
| GET    | `/users`     | JWT  | List all users                           |
| GET    | `/users/:id` | JWT  | Get user by id (includes recent purchases) |
| POST   | `/users`     | JWT  | Create user (admin)                      |
| PUT    | `/users/:id` | JWT  | Update user                              |
| DELETE | `/users/:id` | JWT  | Delete user                              |

### Products
| Method | Route                | Auth | Description                              |
| ------ | -------------------- | ---- | ---------------------------------------- |
| GET    | `/products`          | No   | List all products (`?category=` to filter) |
| GET    | `/products/popular`  | No   | Most popular products (by total quantity ordered) |
| GET    | `/products/:id`      | No   | Get product by id                        |
| POST   | `/products`          | JWT  | Create product                           |
| PUT    | `/products/:id`      | JWT  | Update product                           |
| DELETE | `/products/:id`      | JWT  | Delete product                           |

### Orders
| Method | Route                            | Auth | Description                      |
| ------ | -------------------------------- | ---- | -------------------------------- |
| GET    | `/orders`                        | JWT  | List orders (`?status=` `?userId=`) |
| GET    | `/orders/:id`                    | JWT  | Get order by id                  |
| GET    | `/orders/:id/products`           | JWT  | Get products in order            |
| GET    | `/orders/user/:userId/current`   | JWT  | Active orders for user           |
| GET    | `/orders/user/:userId/completed` | JWT  | Completed orders for user        |
| POST   | `/orders`                        | JWT  | Create order                     |
| POST   | `/orders/:id/products`           | JWT  | Add product to order             |
| PUT    | `/orders/:id`                    | JWT  | Update order status              |
| DELETE | `/orders/:id`                    | JWT  | Delete order                     |

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

**Auth:** Protected routes require `Authorization: Bearer <accessToken>`. Tokens are issued by `/auth/register` and `/auth/login`.

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
User        { id: number, firstName: string, lastName: string, username: string, password: string }
Product     { id: number, name: string, price: number, category?: string, image?: string,
              description?: string, stock: number, isActive: boolean, shopId?: string, shopName?: string }
Order       { id: number, userId: number, status: 'active' | 'complete' }
OrderProduct{ id: number, orderId: number, productId: number, quantity: number }
CartItem    { id: number, userId: number, productId: number, quantity: number,
              typeId: string, selectedType?: object, shopId?: string, shopName?: string }
Address     { id: number, userId: number, fullName: string, phone?: string, address: string,
              city: string, label: 'home' | 'work' | 'other', isDefault: boolean }
```
