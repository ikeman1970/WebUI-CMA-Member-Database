ALTER TABLE app.accounts
  ADD COLUMN IF NOT EXISTS auth_user_id text,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_password_change_at timestamptz;

CREATE TABLE IF NOT EXISTS app.account_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  account_id uuid NOT NULL REFERENCES app.accounts(id) ON DELETE CASCADE,
  person_id uuid REFERENCES app.people(id) ON DELETE SET NULL,
  invite_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by_account_id uuid
);

CREATE INDEX IF NOT EXISTS account_invite_tokens_account_id_expires_at_idx
  ON app.account_invite_tokens(account_id, expires_at);

CREATE INDEX IF NOT EXISTS account_invite_tokens_person_id_idx
  ON app.account_invite_tokens(person_id);
