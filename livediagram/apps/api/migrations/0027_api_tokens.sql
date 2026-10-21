-- API tokens for external callers (docs/specs/015-api/public-api-and-tokens.md). Signed-in (Clerk) users only — a
-- token always acts as a Clerk userId, never a guest id. We store only the
-- SHA-256 hash of the secret (the plaintext is shown once at creation and is
-- never persisted); lookup is by that unique hash. `expires_at` is NOT NULL
-- and fixed at created_at + 6 months — there are no never-expires tokens.
-- Account deletion cascades here via a DELETE in db/account.ts (owner_id match).

CREATE TABLE api_tokens (
  id           TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  name         TEXT,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER,
  expires_at   INTEGER NOT NULL,
  revoked      INTEGER NOT NULL DEFAULT 0
);

-- owner_id index serves the management list + the per-owner live-count cap.
-- token_hash is already indexed by its UNIQUE constraint (the auth lookup).
CREATE INDEX api_tokens_owner_idx ON api_tokens (owner_id);
