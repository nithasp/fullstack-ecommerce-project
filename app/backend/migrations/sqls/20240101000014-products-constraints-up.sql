UPDATE products SET is_active = false, price = 0 WHERE price = 'NaN';
UPDATE products SET stock = 0 WHERE stock IS NULL OR stock < 0;
UPDATE products SET is_active = true WHERE is_active IS NULL;
UPDATE products SET overall_rating = 0
WHERE overall_rating IS NULL OR overall_rating < 0 OR overall_rating > 5;
UPDATE products SET preview_img = '[]'::jsonb WHERE preview_img IS NULL;
UPDATE products SET types = '[]'::jsonb WHERE types IS NULL;
UPDATE products SET reviews = '[]'::jsonb WHERE reviews IS NULL;

ALTER TABLE products ALTER COLUMN stock SET NOT NULL;
ALTER TABLE products ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE products ALTER COLUMN overall_rating SET NOT NULL;
ALTER TABLE products ALTER COLUMN preview_img SET NOT NULL;
ALTER TABLE products ALTER COLUMN types SET NOT NULL;
ALTER TABLE products ALTER COLUMN reviews SET NOT NULL;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_price_check;
ALTER TABLE products ADD CONSTRAINT products_price_check CHECK (price >= 0 AND price <> 'NaN');
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_check;
ALTER TABLE products ADD CONSTRAINT products_stock_check CHECK (stock >= 0);
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_overall_rating_check;
ALTER TABLE products ADD CONSTRAINT products_overall_rating_check
  CHECK (overall_rating >= 0 AND overall_rating <= 5);

CREATE INDEX IF NOT EXISTS idx_products_active ON products (id) WHERE is_active;
