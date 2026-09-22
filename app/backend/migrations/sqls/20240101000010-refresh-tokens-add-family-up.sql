-- Every token issued by rotating the same login shares a family_id. A rotated token is marked
-- used_at instead of being deleted, so if it is ever presented again the whole family is revoked.
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS family_id UUID;

UPDATE refresh_tokens SET family_id = md5(random()::text || id::text)::uuid WHERE family_id IS NULL;

ALTER TABLE refresh_tokens ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS used_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens(family_id);
