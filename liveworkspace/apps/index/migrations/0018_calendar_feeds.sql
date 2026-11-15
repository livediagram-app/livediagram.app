-- Calendar feeds (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Calendar feeds", blueprints/inbox.md): a
-- person's private calendar feed of the open cards assigned to them in one app (liveplanner's My Work feed). Only the
-- feed token's SHA-256 is kept, never the token; a new hash over the row is Reset Link. The account purge drops a
-- person's rows. Written by hand.
CREATE TABLE IF NOT EXISTS calendar_feeds (
  person_id  TEXT    NOT NULL,
  app        TEXT    NOT NULL,
  token_hash TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (person_id, app)
);
CREATE UNIQUE INDEX IF NOT EXISTS calendar_feeds_token ON calendar_feeds (token_hash);
