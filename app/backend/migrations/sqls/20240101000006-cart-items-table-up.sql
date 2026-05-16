CREATE TABLE IF NOT EXISTS cart_items (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  type_id       VARCHAR(255) NOT NULL DEFAULT '',
  selected_type JSONB,
  shop_id       VARCHAR(255),
  shop_name     VARCHAR(255),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cart_items_user_product_type_unique UNIQUE (user_id, product_id, type_id)
);
