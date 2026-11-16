-- Approvals (liveworkspace/docs/specs/004-index/approvals.md, Work Tracker 937): an Editor of the whole item asks
-- named people to approve it, and each approves or asks for changes. Two new tables and one new column; nothing
-- existing changes.
--
-- approvals: one row per request. An item has at most one `open` request (approvals_open), and keeps its newest
-- APPROVALS_KEPT (src/approvals.ts deletes older ones in the request's batch). A purged item takes its requests.
CREATE TABLE approvals (
  id           TEXT    PRIMARY KEY,
  item_id      TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  -- Who asked; `deleted` once their account closes.
  requested_by TEXT    NOT NULL,
  note         TEXT    NULL,
  -- The day hoped for, YYYY-MM-DD.
  due_day      TEXT    NULL,
  -- The snapshot the editor took of the item as it was asked about (the item's own, 014-snapshots).
  snapshot_id  TEXT    NULL,
  -- open, approved or cancelled.
  state        TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  -- When it was approved (the last approval) or cancelled.
  closed_at    INTEGER NULL
);
-- The item's newest request.
CREATE INDEX approvals_item ON approvals (item_id, created_at DESC);
-- Never two open requests on one item, even when two requests race.
CREATE UNIQUE INDEX approvals_open ON approvals (item_id) WHERE state = 'open';
-- Closing an account: the requests they made.
CREATE INDEX approvals_requester ON approvals (requested_by);

-- approval_people: each request's approvers, in the order named, with their decision.
CREATE TABLE approval_people (
  approval_id TEXT    NOT NULL REFERENCES approvals (id) ON DELETE CASCADE,
  -- An account; `deleted` once it closes.
  person_id   TEXT    NOT NULL,
  position    INTEGER NOT NULL,
  -- pending, approved or changes_requested.
  decision    TEXT    NOT NULL DEFAULT 'pending',
  note        TEXT    NULL,
  decided_at  INTEGER NULL,
  PRIMARY KEY (approval_id, person_id)
);
-- Closing an account: the decisions they hold.
CREATE INDEX approval_people_person ON approval_people (person_id);

-- The item's revision: its newest content save, as its app's summary push reports it (src/app-routes.ts). Only moves
-- forward; a rename, a move or a share leaves it alone. Null until the first push after this migration.
ALTER TABLE items ADD COLUMN content_at INTEGER NULL;
