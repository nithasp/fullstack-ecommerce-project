ALTER TABLE products ADD COLUMN IF NOT EXISTS types JSONB NOT NULL DEFAULT '[]';

UPDATE products p
SET types = COALESCE(
  (SELECT jsonb_agg(
            jsonb_strip_nulls(jsonb_build_object(
              '_id', v.ext_id,
              'productId', v.product_id,
              'color', v.color,
              'price', v.price,
              'stock', v.stock,
              'image', v.image
            ))
            ORDER BY v.position, v.id
          )
   FROM product_variants v
   WHERE v.product_id = p.id),
  '[]'::jsonb
);

DROP INDEX IF EXISTS idx_order_products_variant_id;

ALTER TABLE order_products DROP COLUMN IF EXISTS variant_id;

ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS type_id VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS selected_type JSONB;

UPDATE cart_items ci
SET type_id = COALESCE(v.ext_id, ''),
    selected_type = jsonb_strip_nulls(jsonb_build_object(
      '_id', v.ext_id,
      'productId', v.product_id,
      'color', v.color,
      'price', v.price,
      'stock', v.stock,
      'image', v.image
    ))
FROM product_variants v
WHERE v.id = ci.variant_id;

DROP INDEX IF EXISTS cart_items_user_product_variant_unique;

ALTER TABLE cart_items DROP COLUMN IF EXISTS variant_id;

ALTER TABLE cart_items ADD CONSTRAINT cart_items_user_product_type_unique UNIQUE (user_id, product_id, type_id);

DROP TABLE IF EXISTS product_variants;
