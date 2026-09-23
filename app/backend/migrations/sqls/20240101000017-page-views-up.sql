CREATE TABLE IF NOT EXISTS page_views (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id INTEGER,
    username VARCHAR(100),
    path VARCHAR(255) NOT NULL,
    page VARCHAR(60),
    ip_address VARCHAR(45),
    user_agent VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_user_id ON page_views (user_id, created_at DESC);

INSERT INTO page_views (created_at, user_id, username, path, page, ip_address, user_agent)
SELECT created_at, user_id, username, COALESCE(NULLIF(path, ''), '/'), details ->> 'page', ip_address, user_agent
FROM audit_logs
WHERE action = 'PAGE_VIEW';

DELETE FROM audit_logs WHERE action = 'PAGE_VIEW';

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'SECURITY'));
