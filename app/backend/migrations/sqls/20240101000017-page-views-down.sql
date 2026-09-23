ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'SECURITY', 'PAGE_VIEW'));

INSERT INTO audit_logs (created_at, user_id, username, user_role, action, event, method, path, status_code, ip_address, user_agent, details)
SELECT created_at, user_id, username, NULL, 'PAGE_VIEW', 'page.viewed', NULL, path, 201, ip_address, user_agent,
       CASE WHEN page IS NULL THEN NULL ELSE jsonb_build_object('page', page) END
FROM page_views;

DROP TABLE IF EXISTS page_views;
