-- Start a Call Here (liveworkspace/docs/specs/004-index/item-calls.md, blueprint item-calls.md, Work Tracker 1367): one
-- row a livehuddle call about an item. The Space is the call; `share_code` is its Participant link, the way in. `people`
-- and `names` are as the Space's room last said (names first come, at most ITEM_CALL_NAMES_MAX). A call is live while
-- `ended_at` is null and someone is in it, or nobody has joined yet within ITEM_CALL_START_GRACE_MS. The summary's page
-- and the plan its actions went to are kept once sent. The rows cascade from both the item and the Space.
CREATE TABLE item_calls (
  id              TEXT    PRIMARY KEY,
  item_id         TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  space_id        TEXT    NOT NULL UNIQUE REFERENCES items (id) ON DELETE CASCADE,
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
  updated_at      INTEGER NOT NULL
);
-- An item's calls, newest first: its pill and its Meetings.
CREATE INDEX item_calls_item ON item_calls (item_id, started_at DESC);
-- A closing account's calls, for the purge to anonymise their host.
CREATE INDEX item_calls_host ON item_calls (host_id);

-- An invite to a call, one a person a call: `by_name` is the inviter as the invite named them. Goes with its call, or
-- with the person when their account closes.
CREATE TABLE item_call_invites (
  id        TEXT    PRIMARY KEY,
  call_id   TEXT    NOT NULL REFERENCES item_calls (id) ON DELETE CASCADE,
  person_id TEXT    NOT NULL,
  by_name   TEXT    NOT NULL,
  at        INTEGER NOT NULL
);
-- A person's Inbox read, newest first.
CREATE INDEX item_call_invites_person ON item_call_invites (person_id, at DESC);
