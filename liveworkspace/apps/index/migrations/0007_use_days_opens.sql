-- Most Used counts opens, not days (Work Tracker #62): each person's row for an item and UTC day now also holds how
-- many times they opened it that day (src/items.ts `useDayStatements`, at most one a minute). The rows written
-- before this read as one open each, which is what they recorded. Adds a column only; nothing is rewritten.
ALTER TABLE use_days ADD COLUMN opens INTEGER NOT NULL DEFAULT 1;
