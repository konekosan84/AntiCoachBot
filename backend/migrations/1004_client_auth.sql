-- SLOTIQ — Client auth (SMS code login for end-customers)
-- One-time codes go into client_auth_codes; sessions into client_auth_tokens.

CREATE TABLE IF NOT EXISTS public.client_auth_codes (
  phone        VARCHAR(20) PRIMARY KEY,
  code         VARCHAR(8)  NOT NULL,
  attempts     INT         NOT NULL DEFAULT 0,
  expires_at   TIMESTAMP   NOT NULL,
  created_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_auth_tokens (
  token        VARCHAR(64) PRIMARY KEY,
  client_id    INT NOT NULL,
  tenant_id    INT NOT NULL DEFAULT 1,
  created_at   TIMESTAMP   NOT NULL DEFAULT NOW(),
  last_seen    TIMESTAMP   NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMP   NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_tokens_client ON public.client_auth_tokens(client_id);
