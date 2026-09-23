DROP INDEX IF EXISTS idx_users_deleted_at;
DROP INDEX IF EXISTS users_username_lower_key;

ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);

ALTER TABLE users DROP COLUMN IF EXISTS password_version;
ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
