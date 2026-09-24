-- The catalog filter and the search read every row: LOWER(category) and a substring match cannot
-- use a plain btree index. The expression index serves the category filter, and the trigram
-- indexes serve the ILIKE the repository issues in place of STRPOS.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_category_lower ON products (LOWER(category));

CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING GIN (description gin_trgm_ops);
