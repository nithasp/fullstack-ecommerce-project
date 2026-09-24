-- pg_trgm is left installed: another object may depend on it, and re-running the up migration
-- is a no-op when it is already there.
DROP INDEX IF EXISTS idx_products_description_trgm;

DROP INDEX IF EXISTS idx_products_name_trgm;

DROP INDEX IF EXISTS idx_products_category_lower;
