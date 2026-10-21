-- The workspace scope of workbench embeds (docs/specs/013-workspace/workbench-embeds.md "Two scopes", blueprint
-- docs/specs/013-workspace/blueprints/workbench-embeds.md "Data and persistence", WB64). A ticket, a session, a
-- pairing and a pairing request each carry a scope: `document` (one document) or `workspace` (the person's whole
-- workspace). Every row from before is a `document` row, as the spec says of the pairings approved before scopes.

-- One live request per token, origin and scope: a document request and a workspace request never share a code, so
-- the pairing page never shows one question while answering another.
ALTER TABLE workbench_pairing_requests ADD COLUMN scope TEXT NOT NULL DEFAULT 'document'
  CHECK (scope IN ('document', 'workspace'));
DROP INDEX workbench_pairing_requests_live;
CREATE UNIQUE INDEX workbench_pairing_requests_live
  ON workbench_pairing_requests (token_id, origin, scope) WHERE status = 'pending';

-- A workspace pairing covers the document scope too; approving a workspace request widens a document pairing in
-- place (WB50).
ALTER TABLE workbench_pairings ADD COLUMN scope TEXT NOT NULL DEFAULT 'document'
  CHECK (scope IN ('document', 'workspace'));

-- Tickets and sessions name no document in the workspace scope. SQLite cannot drop a NOT NULL, so both tables are
-- rebuilt; no table references either, so the old ones drop with nothing to park. A workspace row may name the
-- folder it starts on; it has no foreign key, since a folder deleted since is only a start place the Explorer
-- reports as gone.
CREATE TABLE workbench_tickets_new (
  ticket_hash TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  pairing_id TEXT NOT NULL REFERENCES workbench_pairings(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'document' CHECK (scope IN ('document', 'workspace')),
  document_id TEXT NULL REFERENCES documents(id) ON DELETE CASCADE,
  folder_id TEXT NULL,
  tab_id TEXT NULL,
  origin TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER NULL,
  CHECK ((scope = 'document') = (document_id IS NOT NULL)),
  CHECK (scope = 'workspace' OR folder_id IS NULL)
);
INSERT INTO workbench_tickets_new
  (ticket_hash, owner_id, token_id, pairing_id, scope, document_id, folder_id, tab_id, origin, role, created_at,
   expires_at, used_at)
SELECT ticket_hash, owner_id, token_id, pairing_id, 'document', document_id, NULL, tab_id, origin, role, created_at,
       expires_at, used_at
  FROM workbench_tickets;
DROP TABLE workbench_tickets;
ALTER TABLE workbench_tickets_new RENAME TO workbench_tickets;
CREATE INDEX workbench_tickets_expiry ON workbench_tickets (expires_at);
CREATE INDEX workbench_tickets_document_idx ON workbench_tickets (document_id);

CREATE TABLE workbench_sessions_new (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  pairing_id TEXT NOT NULL REFERENCES workbench_pairings(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'document' CHECK (scope IN ('document', 'workspace')),
  document_id TEXT NULL REFERENCES documents(id) ON DELETE CASCADE,
  folder_id TEXT NULL,
  tab_id TEXT NULL,
  origin TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK ((scope = 'document') = (document_id IS NOT NULL)),
  CHECK (scope = 'workspace' OR folder_id IS NULL)
);
INSERT INTO workbench_sessions_new
  (id, secret_hash, owner_id, token_id, pairing_id, scope, document_id, folder_id, tab_id, origin, role, created_at,
   expires_at)
SELECT id, secret_hash, owner_id, token_id, pairing_id, 'document', document_id, NULL, tab_id, origin, role,
       created_at, expires_at
  FROM workbench_sessions;
DROP TABLE workbench_sessions;
ALTER TABLE workbench_sessions_new RENAME TO workbench_sessions;
CREATE INDEX workbench_sessions_pairing ON workbench_sessions (pairing_id);
CREATE INDEX workbench_sessions_expiry ON workbench_sessions (expires_at);
CREATE INDEX workbench_sessions_document_idx ON workbench_sessions (document_id);

-- The rooms a workspace session joined, so unpairing or revoking closes them as it closes a document session's
-- (WB55). Recorded on each room ticket the session mints; gone with its session or its document.
CREATE TABLE workbench_session_rooms (
  session_id TEXT NOT NULL REFERENCES workbench_sessions(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, document_id)
);
-- A purged document's cascade finds its rows by document.
CREATE INDEX workbench_session_rooms_document_idx ON workbench_session_rooms (document_id);
