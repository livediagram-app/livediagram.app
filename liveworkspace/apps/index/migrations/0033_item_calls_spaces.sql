-- Calls Spaces (liveworkspace/docs/specs/004-index/item-calls.md "Your Calls Space", blueprint item-calls.md "Tables",
-- Work Tracker 1409): a person's chosen livehuddle Space holds one call after another, so a Space has many rows and
-- its call is its newest. SQLite can't drop the UNIQUE on `space_id` in place, so `item_calls` is rebuilt with the
-- same columns and rows, plus `chosen` (1 for a call held in the host's Calls Space; every existing row is 0), the
-- way 0026_items_liveknowledge.sql rebuilt `items`.
--
-- `item_call_invites` is its one child (ON DELETE CASCADE), and D1 keeps foreign keys on inside a migration, so its
-- rows are copied aside into a plain table first, it is dropped, `item_calls` is rebuilt, and it is made again with
-- the DDL it has today and refilled from the copy. Every statement is one plain INSERT ... SELECT or DDL. D1 runs the
-- file as one transaction: all of it or none.

-- 1. The child aside, then dropped (its index goes with it).
CREATE TABLE aside_item_call_invites AS SELECT * FROM item_call_invites;
DROP TABLE item_call_invites;

-- 2. item_calls rebuilt. Nothing references it now, so dropping the old one cascades nowhere.
CREATE TABLE item_calls_next (
  id              TEXT    PRIMARY KEY,
  item_id         TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  space_id        TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  host_id         TEXT    NOT NULL,
  share_code      TEXT    NULL REFERENCES share_links (code) ON DELETE SET NULL,
  people          INTEGER NOT NULL DEFAULT 0,
  names           TEXT    NOT NULL DEFAULT '[]',
  started_at      INTEGER NOT NULL,
  live_at         INTEGER NULL,
  ended_at        INTEGER NULL,
  summary_item_id TEXT    NULL REFERENCES items (id) ON DELETE SET NULL,
  summary_link    TEXT    NULL,
  summary_title   TEXT    NULL,
  plan_id         TEXT    NULL REFERENCES items (id) ON DELETE SET NULL,
  updated_at      INTEGER NOT NULL,
  chosen          INTEGER NOT NULL DEFAULT 0
);
INSERT INTO item_calls_next (id, item_id, space_id, host_id, share_code, people, names, started_at, live_at, ended_at,
  summary_item_id, summary_link, summary_title, plan_id, updated_at, chosen)
SELECT id, item_id, space_id, host_id, share_code, people, names, started_at, live_at, ended_at, summary_item_id,
  summary_link, summary_title, plan_id, updated_at, 0
FROM item_calls;
DROP TABLE item_calls;
ALTER TABLE item_calls_next RENAME TO item_calls;
-- An item's calls, newest first: its pill and its Meetings.
CREATE INDEX item_calls_item ON item_calls (item_id, started_at DESC);
-- A Space's call: its newest row (the room's push, livehuddle's editor, Send to Plan's line back).
CREATE INDEX item_calls_space ON item_calls (space_id, started_at DESC);
-- A closing account's calls, for the purge to anonymise their host.
CREATE INDEX item_calls_host ON item_calls (host_id);

-- 3. The child made again, as 0031_item_calls.sql made it, and refilled.
CREATE TABLE item_call_invites (
  id        TEXT    PRIMARY KEY,
  call_id   TEXT    NOT NULL REFERENCES item_calls (id) ON DELETE CASCADE,
  person_id TEXT    NOT NULL,
  by_name   TEXT    NOT NULL,
  at        INTEGER NOT NULL
);
INSERT INTO item_call_invites (id, call_id, person_id, by_name, at)
SELECT id, call_id, person_id, by_name, at FROM aside_item_call_invites;
-- A person's Inbox read, newest first.
CREATE INDEX item_call_invites_person ON item_call_invites (person_id, at DESC);

-- 4. The copy goes.
DROP TABLE aside_item_call_invites;
