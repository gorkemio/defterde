CREATE TABLE catalog_state (id integer PRIMARY KEY CHECK (id=1), version integer NOT NULL DEFAULT 0, draft jsonb NOT NULL, published_revision integer NOT NULL DEFAULT 0);
CREATE TABLE catalog_revisions (id integer PRIMARY KEY, items jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), actor text NOT NULL);
CREATE TABLE admin_sessions (hash text PRIMARY KEY, user_id text NOT NULL, csrf text NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX admin_sessions_expiry ON admin_sessions(expires_at);
CREATE TABLE oauth_states (hash text PRIMARY KEY, verifier text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE daily_opens (day date NOT NULL, slug text NOT NULL, count bigint NOT NULL DEFAULT 0 CHECK(count >= 0), PRIMARY KEY(day,slug));
CREATE TABLE admin_audit (id bigserial PRIMARY KEY, action text NOT NULL, actor text NOT NULL, revision integer, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX admin_audit_time ON admin_audit(created_at);
