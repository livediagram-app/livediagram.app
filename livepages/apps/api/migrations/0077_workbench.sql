-- Workbench embeds (docs/specs/013-workspace/workbench-embeds.md, blueprint "Data and persistence").
--
-- A developer tool (a workbench) frames the editor signed in as a person. A token mints tickets only for an
-- origin its owner approved (a pairing); a ticket, redeemed once, opens a session confined to one document.
-- Secrets (tickets, sessions) are stored as SHA-256 hex only. Everything here is account-only: a guest never
-- holds a token, so never a row.

-- One ask to pair a token with an origin, answered once by the token's owner. `code` is the request's public
-- handle in the pairing URL: it grants nothing without the owner's own session.
CREATE TABLE workbench_pairing_requests (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  name TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  answered_at INTEGER NULL
);
CREATE UNIQUE INDEX workbench_pairing_requests_live
  ON workbench_pairing_requests (token_id, origin) WHERE status = 'pending';
CREATE INDEX workbench_pairing_requests_expiry ON workbench_pairing_requests (expires_at);

-- A token and an origin its owner approved. Removing one ends its tickets and sessions (cascade).
CREATE TABLE workbench_pairings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  name TEXT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (token_id, origin)
);
CREATE INDEX workbench_pairings_owner ON workbench_pairings (owner_id);

-- Single-use, one-minute credentials that open one session each.
CREATE TABLE workbench_tickets (
  ticket_hash TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  pairing_id TEXT NOT NULL REFERENCES workbench_pairings(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tab_id TEXT NULL,
  origin TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER NULL
);
CREATE INDEX workbench_tickets_expiry ON workbench_tickets (expires_at);

-- The frame acting as the person on one document.
CREATE TABLE workbench_sessions (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  pairing_id TEXT NOT NULL REFERENCES workbench_pairings(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tab_id TEXT NULL,
  origin TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX workbench_sessions_pairing ON workbench_sessions (pairing_id);
CREATE INDEX workbench_sessions_expiry ON workbench_sessions (expires_at);

-- The room's handle on a workbench socket, so unpairing closes exactly that pairing's sockets.
ALTER TABLE ws_tickets ADD COLUMN workbench_pairing TEXT NULL;
