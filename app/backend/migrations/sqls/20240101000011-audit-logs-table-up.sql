-- user_id deliberately has no foreign key: the log is history and has to outlive the account,
-- which is also why the username is copied into each row instead of joined in when read.
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id INTEGER,
    username VARCHAR(100),
    user_role VARCHAR(20),
    action VARCHAR(20) NOT NULL
      CHECK (action IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'SECURITY')),
    event VARCHAR(60) NOT NULL,
    method VARCHAR(10),
    path VARCHAR(255),
    status_code SMALLINT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    details JSONB
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
