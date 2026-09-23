CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);

ALTER TABLE addresses
  ALTER COLUMN created_at TYPE TIMESTAMP,
  ALTER COLUMN updated_at TYPE TIMESTAMP;

ALTER TABLE cart_items
  ALTER COLUMN created_at TYPE TIMESTAMP,
  ALTER COLUMN updated_at TYPE TIMESTAMP;

ALTER TABLE refresh_tokens
  ALTER COLUMN expires_at TYPE TIMESTAMP,
  ALTER COLUMN created_at TYPE TIMESTAMP,
  ALTER COLUMN used_at TYPE TIMESTAMP;
