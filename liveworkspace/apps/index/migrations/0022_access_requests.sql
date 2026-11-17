-- Request Access (liveworkspace/docs/specs/004-index/request-access.md, Work Tracker 1137): a signed-in person asks the
-- people who run an item they can't open to share it with them. Two new tables; nothing existing changes.
--
-- access_requests: one row per person and item, asked again rather than repeated. `open` until a manager grants it
-- (`granted`, with the share link it made) or declines it (`declined`). A purged item takes its requests.
CREATE TABLE access_requests (
  id             TEXT    PRIMARY KEY,
  item_id        TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  -- The account asking; its rows go when it closes.
  requester_id   TEXT    NOT NULL,
  -- Their name as accounts gave it when they asked, for the Inbox; null when it couldn't say.
  requester_name TEXT    NULL,
  note           TEXT    NULL,
  state          TEXT    NOT NULL CHECK (state IN ('open', 'granted', 'declined')),
  asked_at       INTEGER NOT NULL,
  -- When the managers were last emailed about it: the item's day's email limit counts these.
  emailed_at     INTEGER NULL,
  closed_at      INTEGER NULL,
  -- The share link a grant made (no key: a deleted link leaves the row as it was).
  share_code     TEXT    NULL
);
-- One request per person and item; also closing an account (its range by requester).
CREATE UNIQUE INDEX access_requests_person_item ON access_requests (requester_id, item_id);
-- The Inbox's read: an item's open requests, newest first.
CREATE INDEX access_requests_item ON access_requests (item_id, state, asked_at DESC);
-- The item's emails of the last day.
CREATE INDEX access_requests_item_emailed ON access_requests (item_id, emailed_at) WHERE emailed_at IS NOT NULL;

-- access_request_tries: each ask, whatever the id, for the person's day's limit. At most a day's per person: each ask
-- deletes its asker's older ones.
CREATE TABLE access_request_tries (
  person_id TEXT    NOT NULL,
  at        INTEGER NOT NULL
);
CREATE INDEX access_request_tries_person ON access_request_tries (person_id, at);
