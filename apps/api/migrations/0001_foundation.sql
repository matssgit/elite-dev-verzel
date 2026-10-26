CREATE TYPE user_role AS ENUM ('LEILOEIRO', 'LICITANTE');
CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 name text NOT NULL, email text NOT NULL UNIQUE CHECK (email = lower(email)),
 password_hash text NOT NULL, role user_role NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE wallets (
 user_id uuid PRIMARY KEY REFERENCES users(id), total_cents bigint NOT NULL DEFAULT 0,
 committed_cents bigint NOT NULL DEFAULT 0,
 CONSTRAINT wallet_valid CHECK (committed_cents >= 0 AND total_cents >= committed_cents AND total_cents <= 9007199254740991)
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE wallet_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 amount_cents bigint NOT NULL CHECK (amount_cents > 0), kind text NOT NULL CHECK (kind = 'DEPOSIT'),
 idempotency_key uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (user_id, idempotency_key)
);
CREATE INDEX wallet_entries_user_idx ON wallet_entries(user_id,created_at);
