-- An order line keeps the price paid, so a later price change cannot rewrite what a customer was
-- charged, and RESTRICT stops a product or account delete from erasing order history.
ALTER TABLE orders ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN status SET NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE order_products ALTER COLUMN order_id SET NOT NULL;
ALTER TABLE order_products ALTER COLUMN product_id SET NOT NULL;

ALTER TABLE order_products ADD COLUMN IF NOT EXISTS type_id VARCHAR(255);
ALTER TABLE order_products ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2);

UPDATE order_products op
SET unit_price = COALESCE((SELECT p.price FROM products p WHERE p.id = op.product_id), 0)
WHERE op.unit_price IS NULL;

ALTER TABLE order_products ALTER COLUMN unit_price SET NOT NULL;

ALTER TABLE order_products DROP CONSTRAINT IF EXISTS order_products_quantity_check;
ALTER TABLE order_products ADD CONSTRAINT order_products_quantity_check CHECK (quantity > 0);
ALTER TABLE order_products DROP CONSTRAINT IF EXISTS order_products_unit_price_check;
ALTER TABLE order_products ADD CONSTRAINT order_products_unit_price_check
  CHECK (unit_price >= 0 AND unit_price <> 'NaN');

ALTER TABLE order_products DROP CONSTRAINT IF EXISTS order_products_product_id_fkey;
ALTER TABLE order_products ADD CONSTRAINT order_products_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_products_order_id ON order_products (order_id);
CREATE INDEX IF NOT EXISTS idx_order_products_product_id ON order_products (product_id);
