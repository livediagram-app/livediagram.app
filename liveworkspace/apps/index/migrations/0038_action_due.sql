-- An action's due day on its Inbox row (liveworkspace/docs/specs/004-index/inbox-reading.md, blueprint inbox.md
-- "The pushes", Work Tracker 1487).
--
-- `collab_actions` gains `due`: the action's due day as its app pushes it (`YYYY-MM-DD`, a calendar day with no zone),
-- null when it has none, as every existing row reads until its app pushes the tab again. A card's due day stays in its
-- `card` JSON. One plain ALTER: no rebuild, no index.

ALTER TABLE collab_actions ADD COLUMN due TEXT;
