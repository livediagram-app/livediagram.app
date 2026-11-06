-- Connected tabs (liveworkspace/docs/specs/004-index/connected-tabs.md, Work Tracker #569): one row per connected tab,
-- a tab in one item (the host) that stands for another (the target), with the share link made for it (its pass). One
-- new table; nothing existing changes. It references items, share_links and itself, so a later rebuild of items or
-- share_links carries it too (blueprints/items.md "Rebuilding items").

CREATE TABLE connections (
  -- `cn_` and 24 random letters and digits (IDX22).
  id             TEXT    PRIMARY KEY,
  -- The host goes, its connected tabs go.
  host_item_id   TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  -- The tab in the host holding it. Null only while a reverse (both ways) waits for the target app's answer.
  host_tab_id    TEXT    NULL,
  -- Null once the target is purged: the row stays so its tab says the file is no longer there.
  target_item_id TEXT    NULL REFERENCES items (id) ON DELETE SET NULL,
  -- The pass: a share link on the target. Null once it is deleted (from Share, or with the target), so the tab offers
  -- Connect Again.
  share_code     TEXT    NULL REFERENCES share_links (code) ON DELETE SET NULL,
  -- The other connection made with it both ways; null when there is none or it went.
  pair_id        TEXT    NULL REFERENCES connections (id) ON DELETE SET NULL,
  created_at     INTEGER NOT NULL,
  -- When the host app said the tab is in; still null an hour on, the sweep takes it and its pass back (IDX27).
  confirmed_at   INTEGER NULL
);
-- The host's count, Connect Again's lookup and the doors' match, and the cascade from items.
CREATE INDEX connections_host ON connections (host_item_id, host_tab_id);
-- The target's purge (ON DELETE SET NULL).
CREATE INDEX connections_target ON connections (target_item_id);
-- A deleted link (ON DELETE SET NULL), and the Share dialog's mark.
CREATE INDEX connections_code ON connections (share_code);
-- A deleted connection clearing its pair (ON DELETE SET NULL).
CREATE INDEX connections_pair ON connections (pair_id);
-- The sweep: the oldest unconfirmed first.
CREATE INDEX connections_unconfirmed ON connections (created_at) WHERE confirmed_at IS NULL;
