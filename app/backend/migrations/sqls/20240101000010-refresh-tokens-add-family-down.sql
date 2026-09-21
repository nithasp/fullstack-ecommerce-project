-- Code before this migration deletes a token when it is used, so used tokens must go first:
-- otherwise dropping used_at would make every rotated token valid again
DELETE FROM refresh_tokens WHERE used_at IS NOT NULL;

DROP INDEX IF EXISTS idx_refresh_tokens_family_id;
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS used_at;
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS family_id;
