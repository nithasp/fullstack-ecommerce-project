CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    ext_id VARCHAR(64) NOT NULL,
    color VARCHAR(60) NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0 AND price <> 'NaN'),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image VARCHAR(500),
    position INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT product_variants_product_ext_unique UNIQUE (product_id, ext_id)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants (product_id);

WITH exploded AS (
  SELECT p.id AS product_id,
         p.price AS product_price,
         t.ordinality::int AS position,
         t.value AS v
  FROM products p,
       LATERAL jsonb_array_elements(p.types) WITH ORDINALITY AS t(value, ordinality)
  WHERE jsonb_typeof(p.types) = 'array' AND jsonb_typeof(t.value) = 'object'
),
named AS (
  SELECT product_id,
         product_price,
         position,
         v,
         COALESCE(NULLIF(TRIM(v ->> '_id'), ''), 'v' || position) AS raw_ext
  FROM exploded
),
deduped AS (
  SELECT *,
         ROW_NUMBER() OVER (PARTITION BY product_id, raw_ext ORDER BY position) AS copy
  FROM named
)
INSERT INTO product_variants (product_id, ext_id, color, price, stock, image, position)
SELECT product_id,
       LEFT(CASE WHEN copy = 1 THEN raw_ext ELSE raw_ext || '-' || position END, 64),
       LEFT(COALESCE(NULLIF(TRIM(v ->> 'color'), ''), 'Default'), 60),
       GREATEST(COALESCE(NULLIF(v ->> 'price', 'NaN')::numeric, product_price), 0),
       GREATEST(COALESCE((v ->> 'stock')::numeric, 0)::int, 0),
       LEFT(NULLIF(TRIM(v ->> 'image'), ''), 500),
       position
FROM deduped;

ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE;

UPDATE cart_items ci
SET variant_id = v.id
FROM product_variants v
WHERE v.product_id = ci.product_id AND v.ext_id = ci.type_id AND COALESCE(ci.type_id, '') <> '';

DELETE FROM cart_items ci
WHERE ci.variant_id IS NULL
  AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = ci.product_id);

ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_user_product_type_unique;

CREATE UNIQUE INDEX IF NOT EXISTS cart_items_user_product_variant_unique
  ON cart_items (user_id, product_id, COALESCE(variant_id, 0));

ALTER TABLE cart_items DROP COLUMN IF EXISTS selected_type;
ALTER TABLE cart_items DROP COLUMN IF EXISTS type_id;

-- SET NULL, not RESTRICT: an admin may retire an option, and the order line keeps type_id and
-- unit_price as its own record of what was bought
ALTER TABLE order_products ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL;

UPDATE order_products op
SET variant_id = v.id
FROM product_variants v
WHERE v.product_id = op.product_id AND v.ext_id = op.type_id AND op.type_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_products_variant_id ON order_products (variant_id);

ALTER TABLE products DROP COLUMN IF EXISTS types;
