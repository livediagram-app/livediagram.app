-- Plan cards on the Inbox (docs/specs/013-workspace/inbox.md §2.4).
--
-- The read finds a reader's cards by their hashed assignee id, so the item store gets an expression index on
-- it. Whether a card is still open, and which board to open it on, comes from the boards in tab JSON, so the
-- collaboration index gains a per-tab projection of each board's column statuses, written in the tab save's
-- own batch like collab_actions.
CREATE INDEX items_assignee ON items (json_extract(fields, '$.assignee.id'));

CREATE TABLE plan_board_statuses (
  tab_id TEXT NOT NULL,
  element_id TEXT NOT NULL,
  board_title TEXT NOT NULL,
  status TEXT NOT NULL,
  done INTEGER NOT NULL,
  board_order INTEGER NOT NULL,
  position INTEGER NOT NULL,
  -- Status before element: the read's Done check seeks (tab_id, status) for every candidate card.
  PRIMARY KEY (tab_id, status, element_id),
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);

-- Re-run every reader's one-shot backfill on their next visit, so boards saved before this shipped are indexed.
-- The backfill is a full replace per tab, so re-running it over actions and threads is harmless.
DELETE FROM collab_index_state;
