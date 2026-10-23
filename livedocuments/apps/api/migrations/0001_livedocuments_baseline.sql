-- livedocuments's baseline schema (docs/specs/015-api/api.md "Storage"): every table the api worker reads and writes,
-- in one migration. It replaces the hundred-odd migrations inherited from livediagram: nothing was deployed, so
-- there is no older database to bring forward. A later change is a new numbered migration after this one.
--
-- Times are epoch milliseconds (INTEGER). JSON lives in TEXT columns. An owner id is a liveworkspace account id
-- (`user_…`) or guest id (`guest_…`, docs/specs/014-identity/auth-and-guest-access.md).
--
-- Where a document is and who may reach it (its title, folder, team, Trash state, share links, favourites, opens,
-- the Timeline, and the Inbox's comments and actions) is liveworkspace's index (liveworkspace/docs/one-explorer.md), never here;
-- a document's content, and the images it places and may serve, is its own Durable Object
-- (src/document-room/document-schema.ts); the images themselves are liveworkspace's media service's. A person's settings, name and colour,
-- sign-ups and onboarding emails are the liveworkspace accounts Worker's (liveworkspace/docs/accounts.md). What is
-- left is the API tokens this app has seen and workbench embeds.

-- ---------------------------------------------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------------------------------------------

-- The liveworkspace account tokens this app has seen (src/db/api-tokens.ts): its mirror, which workbench
-- pairings and sessions hang off. Only the hash is kept.
CREATE TABLE api_tokens (
  id               TEXT    PRIMARY KEY,
  owner_id         TEXT    NOT NULL,
  token_hash       TEXT    NOT NULL UNIQUE,
  name             TEXT,
  created_at       INTEGER NOT NULL,
  last_used_at     INTEGER,
  expires_at       INTEGER NOT NULL,
  revoked          INTEGER NOT NULL DEFAULT 0,
  expiry_warned_at INTEGER,
  read_only        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX api_tokens_owner_idx ON api_tokens (owner_id);

-- ---------------------------------------------------------------------------------------------------------------
-- Workbench embeds (docs/specs/013-workspace/workbench-embeds.md)
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE workbench_pairings (
  id         TEXT    PRIMARY KEY,
  owner_id   TEXT    NOT NULL,
  token_id   TEXT    NOT NULL REFERENCES api_tokens (id) ON DELETE CASCADE,
  origin     TEXT    NOT NULL,
  name       TEXT    NULL,
  created_at INTEGER NOT NULL,
  scope      TEXT    NOT NULL DEFAULT 'document' CHECK (scope IN ('document', 'workspace')),
  UNIQUE (token_id, origin)
);
CREATE INDEX workbench_pairings_owner ON workbench_pairings (owner_id);

CREATE TABLE workbench_pairing_requests (
  id          TEXT    PRIMARY KEY,
  code        TEXT    NOT NULL UNIQUE,
  owner_id    TEXT    NOT NULL,
  token_id    TEXT    NOT NULL REFERENCES api_tokens (id) ON DELETE CASCADE,
  origin      TEXT    NOT NULL,
  name        TEXT    NULL,
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  answered_at INTEGER NULL,
  scope       TEXT    NOT NULL DEFAULT 'document' CHECK (scope IN ('document', 'workspace'))
);
CREATE INDEX workbench_pairing_requests_expiry ON workbench_pairing_requests (expires_at);
CREATE UNIQUE INDEX workbench_pairing_requests_live
  ON workbench_pairing_requests (token_id, origin, scope) WHERE status = 'pending';

CREATE TABLE workbench_tickets (
  ticket_hash TEXT    PRIMARY KEY,
  owner_id    TEXT    NOT NULL,
  token_id    TEXT    NOT NULL REFERENCES api_tokens (id) ON DELETE CASCADE,
  pairing_id  TEXT    NOT NULL REFERENCES workbench_pairings (id) ON DELETE CASCADE,
  scope       TEXT    NOT NULL DEFAULT 'document' CHECK (scope IN ('document', 'workspace')),
  document_id  TEXT    NULL,
  folder_id   TEXT    NULL,
  tab_id      TEXT    NULL,
  origin      TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER NULL,
  CHECK ((scope = 'document') = (document_id IS NOT NULL)),
  CHECK (scope = 'workspace' OR folder_id IS NULL)
);
CREATE INDEX workbench_tickets_document_idx ON workbench_tickets (document_id);
CREATE INDEX workbench_tickets_expiry ON workbench_tickets (expires_at);

CREATE TABLE workbench_sessions (
  id          TEXT    PRIMARY KEY,
  secret_hash TEXT    NOT NULL UNIQUE,
  owner_id    TEXT    NOT NULL,
  token_id    TEXT    NOT NULL REFERENCES api_tokens (id) ON DELETE CASCADE,
  pairing_id  TEXT    NOT NULL REFERENCES workbench_pairings (id) ON DELETE CASCADE,
  scope       TEXT    NOT NULL DEFAULT 'document' CHECK (scope IN ('document', 'workspace')),
  document_id  TEXT    NULL,
  folder_id   TEXT    NULL,
  tab_id      TEXT    NULL,
  origin      TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  CHECK ((scope = 'document') = (document_id IS NOT NULL)),
  CHECK (scope = 'workspace' OR folder_id IS NULL)
);
CREATE INDEX workbench_sessions_document_idx ON workbench_sessions (document_id);
CREATE INDEX workbench_sessions_expiry ON workbench_sessions (expires_at);
CREATE INDEX workbench_sessions_pairing ON workbench_sessions (pairing_id);

-- The documents a workspace-scoped session has opened rooms on, so revoking the session closes them.
CREATE TABLE workbench_session_rooms (
  session_id  TEXT NOT NULL REFERENCES workbench_sessions (id) ON DELETE CASCADE,
  document_id TEXT NOT NULL,
  PRIMARY KEY (session_id, document_id)
);
CREATE INDEX workbench_session_rooms_document_idx ON workbench_session_rooms (document_id);
