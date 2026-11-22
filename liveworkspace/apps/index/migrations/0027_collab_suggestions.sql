-- A tab's suggested edits for the Inbox (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item
-- pushes" and "Inbox", blueprints/inbox.md, Work Tracker 1362): an agent's change waiting on a page (liveknowledge),
-- replaced by each collab push of the tab as its threads are. `owner_id` is the person it waits on, null for the
-- item's owner. `before_text` and `after_text` are cut to 2,000 characters, `reason` to 500, `agent` to 200: the whole
-- suggestion stays in the app, which accepts it. Every row cascades from its item, as the other collab tables do.
CREATE TABLE collab_suggestions (
  app           TEXT    NOT NULL,
  item_id       TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  tab_id        TEXT    NOT NULL,
  tab_name      TEXT    NOT NULL DEFAULT '',
  suggestion_id TEXT    NOT NULL,
  owner_id      TEXT    NULL,
  agent         TEXT    NOT NULL,
  reason        TEXT    NOT NULL DEFAULT '',
  kind          TEXT    NOT NULL CHECK (kind IN ('replace', 'append')),
  before_text   TEXT    NOT NULL DEFAULT '',
  after_text    TEXT    NOT NULL,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (app, item_id, tab_id, suggestion_id)
);
-- The Inbox's read by person: the suggestions waiting on them by name, newest first; also the purge's and the
-- guest merge's range.
CREATE INDEX collab_suggestions_owner ON collab_suggestions (owner_id, created_at DESC);
-- The Inbox's read through the person's own items (`owner_id` null), and an item's own rows.
CREATE INDEX collab_suggestions_item ON collab_suggestions (item_id, owner_id, created_at DESC);
