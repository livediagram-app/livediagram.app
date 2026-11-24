-- Send to Diagram (liveworkspace/docs/specs/004-index/send-to-diagram.md "The chip", blueprint send-to-diagram.md, Work
-- Tracker 1393): one row a place a livediagram tab was drawn from. `ref` names the place (`tab:element`); the
-- diagram's title is read from its item on each read. The rows cascade from both the source item and the diagram, so
-- a purge of either takes them, and they hold no person and no words.
CREATE TABLE diagram_sends (
  id             TEXT    PRIMARY KEY,
  source_id      TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  ref            TEXT    NOT NULL,
  diagram_id     TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  diagram_tab_id TEXT    NOT NULL,
  at             INTEGER NOT NULL
);
-- A source's read, newest first.
CREATE INDEX diagram_sends_source ON diagram_sends (source_id, at DESC);
-- The cascade from a diagram's purge.
CREATE INDEX diagram_sends_diagram ON diagram_sends (diagram_id);
