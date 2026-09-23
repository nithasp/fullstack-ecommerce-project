DROP INDEX IF EXISTS idx_products_active;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_overall_rating_check;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_check;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_price_check;

ALTER TABLE products ALTER COLUMN reviews DROP NOT NULL;
ALTER TABLE products ALTER COLUMN types DROP NOT NULL;
ALTER TABLE products ALTER COLUMN preview_img DROP NOT NULL;
ALTER TABLE products ALTER COLUMN overall_rating DROP NOT NULL;
ALTER TABLE products ALTER COLUMN is_active DROP NOT NULL;
ALTER TABLE products ALTER COLUMN stock DROP NOT NULL;
