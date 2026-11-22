-- Updates in the Inbox (src/updates.ts; liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item
-- pushes" and "Inbox", Work Tracker 1340): what changed on a page someone watches, within its hour (liveknowledge's
-- Watching). An item pushes its whole set (`PUT /app/items/:id/updates`, at most 50), which replaces its rows here;
-- `item_update_people` is whom each is for, so "my updates" walks an index on the person. Both go with the item,
-- and the daily run sweeps updates past 14 days. Only adds tables. Written by hand.
CREATE TABLE item_updates (
  item_id     TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  update_id   TEXT    NOT NULL,
  app         TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  tab_name    TEXT    NOT NULL,
  kinds       TEXT    NOT NULL,
  actors      TEXT    NOT NULL,
  actor_count INTEGER NOT NULL,
  count       INTEGER NOT NULL,
  first_at    INTEGER NOT NULL,
  latest_at   INTEGER NOT NULL,
  PRIMARY KEY (item_id, update_id)
);
CREATE INDEX item_updates_latest ON item_updates (latest_at);

CREATE TABLE item_update_people (
  person_id TEXT    NOT NULL,
  item_id   TEXT    NOT NULL,
  update_id TEXT    NOT NULL,
  latest_at INTEGER NOT NULL,
  PRIMARY KEY (person_id, item_id, update_id),
  FOREIGN KEY (item_id, update_id) REFERENCES item_updates (item_id, update_id) ON DELETE CASCADE
);
CREATE INDEX item_update_people_latest ON item_update_people (person_id, latest_at DESC);
CREATE INDEX item_update_people_update ON item_update_people (item_id, update_id);
