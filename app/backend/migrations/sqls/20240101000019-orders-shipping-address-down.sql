DROP INDEX IF EXISTS idx_orders_address_id;

ALTER TABLE orders
  DROP COLUMN IF EXISTS ship_label,
  DROP COLUMN IF EXISTS ship_city,
  DROP COLUMN IF EXISTS ship_address,
  DROP COLUMN IF EXISTS ship_phone,
  DROP COLUMN IF EXISTS ship_full_name,
  DROP COLUMN IF EXISTS address_id;
