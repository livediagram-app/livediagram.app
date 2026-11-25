-- Send to Knowledge Base (liveworkspace/docs/specs/004-index/send-to-knowledge.md "The chips", blueprint
-- send-to-knowledge.md, Work Tracker 1425): one row a section written on a knowledgebase page from a selection.
-- `elements` is the JSON array of the source's element ids; `place_link` the Sent From line's link back, which the
-- page's chip matches; `page_title` the page's title when it was written. The rows cascade from both the source item
-- and the knowledgebase, so a purge of either takes them, and they hold no person and no words but the page's title.
CREATE TABLE knowledge_sends (
  id            TEXT    NOT NULL PRIMARY KEY,
  source_id     TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  source_tab_id TEXT    NOT NULL,
  elements      TEXT    NOT NULL,
  kb_id         TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  page_id       TEXT    NOT NULL,
  page_title    TEXT    NOT NULL,
  place_link    TEXT    NOT NULL,
  at            INTEGER NOT NULL
);
-- A source's read, newest first.
CREATE INDEX knowledge_sends_source ON knowledge_sends (source_id, at DESC);
-- A knowledgebase's read, newest first, and the cascade from its purge.
CREATE INDEX knowledge_sends_kb ON knowledge_sends (kb_id, at DESC);
