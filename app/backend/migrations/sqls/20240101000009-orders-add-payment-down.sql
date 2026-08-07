DROP INDEX IF EXISTS orders_payment_intent_id_unique;

ALTER TABLE orders
    DROP COLUMN IF EXISTS payment_status,
    DROP COLUMN IF EXISTS payment_intent_id,
    DROP COLUMN IF EXISTS total_cents,
    DROP COLUMN IF EXISTS currency;
