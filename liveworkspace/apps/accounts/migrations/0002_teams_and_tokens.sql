-- Teams and API tokens belong to the liveworkspace account (liveworkspace/docs/accounts.md "Teams" and
-- "API tokens"), so a team made once is the same team in every app, and one token works on every app's
-- API and MCP server. Written by hand: these are liveworkspace's own tables, not Better Auth's.

-- A team. Deleting one leaves a tombstone (deletedAt) so the apps' copies learn it is gone.
CREATE TABLE team (
  id        TEXT    NOT NULL PRIMARY KEY,
  name      TEXT    NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  deletedAt INTEGER,
  -- Where this row sits in the change feed the apps read (team_seq below).
  rev       INTEGER NOT NULL
);
CREATE INDEX team_rev_idx ON team (rev, id);

-- A member, or an invitation by email until it is answered. A row is never deleted: a member who
-- leaves or is removed becomes 'removed', so the change feed carries that too.
CREATE TABLE team_member (
  id        TEXT    NOT NULL PRIMARY KEY,
  teamId    TEXT    NOT NULL REFERENCES team (id),
  -- Set once the invitation is accepted; the account it belongs to.
  userId    TEXT    REFERENCES "user" (id) ON DELETE SET NULL,
  -- The address invited, lower-cased. Accepting needs a signed-in account with this verified address.
  email     TEXT    NOT NULL,
  role      TEXT    NOT NULL CHECK (role IN ('admin', 'member')),
  status    TEXT    NOT NULL CHECK (status IN ('invited', 'joined', 'declined', 'removed')),
  invitedBy TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  rev       INTEGER NOT NULL
);
CREATE INDEX team_member_team_idx ON team_member (teamId);
CREATE INDEX team_member_user_idx ON team_member (userId);
CREATE INDEX team_member_email_idx ON team_member (email);
CREATE INDEX team_member_rev_idx ON team_member (rev, id);
-- One open row (invited or joined) per address per team.
CREATE UNIQUE INDEX team_member_open_email_uq ON team_member (teamId, email)
  WHERE status IN ('invited', 'joined');

-- The one counter every team and member write takes its rev from, in the same batch, so the apps can
-- ask for "everything after rev N" and never miss a change.
CREATE TABLE team_seq (
  id    INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
  value INTEGER NOT NULL
);
INSERT INTO team_seq (id, value) VALUES (1, 0);

-- An API token. Only its SHA-256 hash is kept; the secret is shown once, when it is made.
CREATE TABLE api_token (
  id         TEXT    NOT NULL PRIMARY KEY,
  userId     TEXT    NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  tokenHash  TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  readOnly   INTEGER NOT NULL DEFAULT 0,
  createdAt  INTEGER NOT NULL,
  lastUsedAt INTEGER,
  expiresAt  INTEGER NOT NULL,
  revokedAt  INTEGER
);
CREATE INDEX api_token_user_idx ON api_token (userId);
