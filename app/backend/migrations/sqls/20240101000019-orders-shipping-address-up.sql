-- An order has to say where it was shipped. The address is copied onto the order as well as
-- referenced, so editing or deleting the address later cannot rewrite what was already sent out.
-- SET NULL rather than RESTRICT so a customer can still delete an old address, and so closing an
-- account (which clears its addresses) does not fail for anyone who has ordered.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ship_full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS ship_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ship_address TEXT,
  ADD COLUMN IF NOT EXISTS ship_city VARCHAR(255),
  ADD COLUMN IF NOT EXISTS ship_label VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_orders_address_id ON orders (address_id);

UPDATE orders o
SET address_id = a.id,
    ship_full_name = a.full_name,
    ship_phone = a.phone,
    ship_address = a.address,
    ship_city = a.city,
    ship_label = a.label
FROM addresses a
WHERE a.user_id = o.user_id
  AND a.is_default
  AND o.ship_address IS NULL;
