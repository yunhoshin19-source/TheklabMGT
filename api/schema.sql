CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS app_users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL UNIQUE,
 display_name text NOT NULL,
 password_hash text NOT NULL,
 role text NOT NULL CHECK (role IN ('admin','manager','staff','accountant')),
 is_active boolean NOT NULL DEFAULT TRUE,
 failed_attempts integer NOT NULL DEFAULT 0,
 locked_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_login_at timestamptz
);
CREATE TABLE IF NOT EXISTS app_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expiry ON app_sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid,
 action text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
