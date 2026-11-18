-- Where a pass the daily cron makes a page at a time has got to, one row per job (Work Tracker 957). The first job is
-- `guest-seen-backfill` (src/guest-seen-backfill.ts, liveworkspace/docs/specs/004-index/one-explorer-contracts.md
-- "Guests"): `cursor` is the last guest owner sent to accounts, and `finished_at` is set once the pass reaches the end,
-- after which the job never runs again. Every read and write is by the primary key. Written by hand.
CREATE TABLE cron_cursors (
  job         TEXT    NOT NULL PRIMARY KEY,
  cursor      TEXT    NOT NULL,
  finished_at INTEGER NULL,
  updated_at  INTEGER NOT NULL
) WITHOUT ROWID;
