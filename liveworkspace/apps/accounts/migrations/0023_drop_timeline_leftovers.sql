-- The Timeline's leftovers in accounts (liveworkspace/docs/specs/003-accounts/blueprints/accounts.md "Migrations").
-- Written by hand, like 0002.
--
-- The team events' outbox takes the name of what it feeds now, the index's event log and the teams' audit logs
-- (liveworkspace/docs/specs/003-accounts/accounts.md "Team events for the audit log"). A rename keeps every row
-- waiting, with its attempts; nothing references the table by foreign key. Its one index is renamed with it.
ALTER TABLE index_timeline_outbox RENAME TO index_events_outbox;
DROP INDEX index_timeline_outbox_order;
CREATE INDEX index_events_outbox_order ON index_events_outbox (createdAt);

-- api_token loses expiryNotedAt (when a token's expiry went on its owner's Timeline), which nothing writes or reads,
-- and its index. SQLite's DROP COLUMN refuses this table (it re-reads the CREATE with the column's comment and fails
-- on it), so the table is rebuilt with the same rows and its other indexes. It is only ever a child (it references
-- "user"; nothing references it), so dropping the old table deletes nothing anywhere else.
CREATE TABLE api_token_next (
  id         TEXT    NOT NULL PRIMARY KEY,
  userId     TEXT    NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  tokenHash  TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  readOnly   INTEGER NOT NULL DEFAULT 0,
  createdAt  INTEGER NOT NULL,
  lastUsedAt INTEGER,
  expiresAt  INTEGER NOT NULL,
  revokedAt  INTEGER,
  -- When its owner was warned it expires soon (liveworkspace/docs/specs/003-accounts/accounts.md "API tokens"): once per
  -- token, so the daily run never warns twice.
  expiryWarnedAt INTEGER
);
INSERT INTO api_token_next
  (id, userId, tokenHash, name, readOnly, createdAt, lastUsedAt, expiresAt, revokedAt, expiryWarnedAt)
  SELECT id, userId, tokenHash, name, readOnly, createdAt, lastUsedAt, expiresAt, revokedAt, expiryWarnedAt
  FROM api_token;
DROP TABLE api_token;
ALTER TABLE api_token_next RENAME TO api_token;
CREATE INDEX api_token_user_idx ON api_token (userId);
-- The daily expiry warning's list: live tokens not yet warned, soonest to expire first.
CREATE INDEX api_token_expiry_warning_idx ON api_token (expiresAt)
  WHERE revokedAt IS NULL AND expiryWarnedAt IS NULL;
