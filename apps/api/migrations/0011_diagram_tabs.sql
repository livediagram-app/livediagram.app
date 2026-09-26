-- Many-to-many tab ↔ diagram link table. See docs/specs/006-diagram/tab-diagram-many-to-many.md for the full
-- model + phasing. This migration is the first of four:
--
--   0011 (this) — add diagram_tabs, backfill from tabs.diagram_id /
--                 tabs.order_index. Reads start going through the
--                 link table; writes update both the link table
--                 AND the legacy tabs.diagram_id column. No
--                 surface change.
--   #14         — drop change_log.diagram_id (now derivable).
--   #15         — drop change_log.participant_name + _color.
--   future     — drop tabs.diagram_id + tabs.order_index once
--                 every reader has moved off the legacy path.

CREATE TABLE diagram_tabs (
  diagram_id  TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  order_index INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  PRIMARY KEY (diagram_id, tab_id),
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE,
  FOREIGN KEY (tab_id)     REFERENCES tabs(id)     ON DELETE CASCADE
);

-- Lookup orderings: "give me this diagram's tabs in order" is the
-- hot read path, and "which diagrams contain this tab?" is the
-- inverted one #14 + #15 will lean on.
CREATE INDEX diagram_tabs_by_diagram ON diagram_tabs(diagram_id, order_index);
CREATE INDEX diagram_tabs_by_tab     ON diagram_tabs(tab_id);

-- Backfill from the legacy tabs.diagram_id column. Every existing
-- (id, diagram_id, order_index) becomes one link row at the same
-- order_index. updated_at is the best available timestamp for
-- "when did this tab join this diagram" — the original create
-- time wasn't tracked.
INSERT INTO diagram_tabs (diagram_id, tab_id, order_index, added_at)
SELECT diagram_id, id, order_index, updated_at FROM tabs;
