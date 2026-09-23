DROP INDEX IF EXISTS idx_order_products_product_id;
DROP INDEX IF EXISTS idx_order_products_order_id;
DROP INDEX IF EXISTS idx_orders_created_at;
DROP INDEX IF EXISTS idx_orders_user_id;

ALTER TABLE order_products DROP CONSTRAINT IF EXISTS order_products_product_id_fkey;
ALTER TABLE order_products ADD CONSTRAINT order_products_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE order_products DROP CONSTRAINT IF EXISTS order_products_unit_price_check;
ALTER TABLE order_products DROP CONSTRAINT IF EXISTS order_products_quantity_check;
ALTER TABLE order_products DROP COLUMN IF EXISTS unit_price;
ALTER TABLE order_products DROP COLUMN IF EXISTS type_id;

ALTER TABLE order_products ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE order_products ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE orders DROP COLUMN IF EXISTS created_at;
ALTER TABLE orders ALTER COLUMN status DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
