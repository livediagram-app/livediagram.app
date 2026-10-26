-- Closing an account asks the index to purge everything it holds for the person
-- (liveworkspace/docs/specs/003-accounts/accounts.md "Closing an account"). The request is written here before the account
-- goes, and cleared once the index has it, so a purge the index couldn't take is never lost: the cron
-- sends it again until it is. Written by hand, like 0002. No foreign key: the user row is gone by then.
CREATE TABLE pending_purges (
  userId        TEXT    NOT NULL PRIMARY KEY,
  -- The teams that closed with the account (JSON array of ids): the index purges the person's items in
  -- them too.
  teamIds       TEXT    NOT NULL DEFAULT '[]',
  createdAt     INTEGER NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  lastAttemptAt INTEGER,
  lastError     TEXT
);
-- The cron's queue: never tried first, then the longest since a try.
CREATE INDEX pending_purges_due ON pending_purges (lastAttemptAt);

-- The Timeline's team and API token events (liveworkspace/docs/specs/003-accounts/accounts.md "On the Timeline"), waiting for the
-- index. Each is written in the batch that makes its change, sent after the response, and resent by the cron
-- until the index takes it; `id` is the event's own, so a resend changes nothing there.
CREATE TABLE index_timeline_outbox (
  id        TEXT    NOT NULL PRIMARY KEY,
  -- The event as the index takes it (POST /internal/timeline): JSON.
  body      TEXT    NOT NULL,
  createdAt INTEGER NOT NULL,
  attempts  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX index_timeline_outbox_order ON index_timeline_outbox (createdAt);
