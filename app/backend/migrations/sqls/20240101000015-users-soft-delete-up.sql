-- Orders must outlive the account that placed them, so an account is closed by scrubbing its
-- personal data and stamping deleted_at, never by deleting the row.
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_version SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON users (LOWER(username));

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NOT NULL;
