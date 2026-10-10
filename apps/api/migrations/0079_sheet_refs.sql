-- Deleting a sheet (docs/specs/029-sheets/sheet-store.md "Deleting a sheet", blueprint sheet-store.md "Deleting a
-- sheet"): which elements reference each sheet, kept by every tab write, so a sheet nothing references is noted
-- the moment it happens and expires by one indexed query, instead of a daily sample of tabs.
ALTER TABLE sheets RENAME COLUMN unframed_since TO unreferenced_since;

-- 1 when the editor deleted the sheet with its element: the sheet goes as soon as nothing references it.
ALTER TABLE sheets ADD COLUMN delete_when_unreferenced INTEGER;

-- A tab's references: every Sheet element's sheetId, and every copy not yet made's copyOf.
CREATE TABLE sheet_refs (
  tab_id TEXT NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  sheet_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, sheet_id)
);

CREATE INDEX sheet_refs_sheet ON sheet_refs(sheet_id);

CREATE INDEX sheets_unreferenced ON sheets(unreferenced_since) WHERE unreferenced_since IS NOT NULL;

-- The document's sheets settle as their references change, and only then: a tab write whose references are as they
-- were inserts and deletes no row here, so it pays nothing. Milliseconds since the epoch, from SQLite's own clock.
-- A removed reference: the sheet is unreferenced from now if nothing else references it, and deleted when the
-- editor deleted it with its element.
CREATE TRIGGER sheet_refs_removed AFTER DELETE ON sheet_refs
BEGIN
  DELETE FROM sheets
   WHERE id = OLD.sheet_id
     AND document_id IN (SELECT document_id FROM document_tabs WHERE tab_id = OLD.tab_id)
     AND delete_when_unreferenced = 1
     AND NOT EXISTS (SELECT 1 FROM sheet_refs r JOIN document_tabs dt ON dt.tab_id = r.tab_id
                      WHERE r.sheet_id = sheets.id AND dt.document_id = sheets.document_id);
  UPDATE sheets SET unreferenced_since = CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
   WHERE id = OLD.sheet_id
     AND document_id IN (SELECT document_id FROM document_tabs WHERE tab_id = OLD.tab_id)
     AND unreferenced_since IS NULL
     AND NOT EXISTS (SELECT 1 FROM sheet_refs r JOIN document_tabs dt ON dt.tab_id = r.tab_id
                      WHERE r.sheet_id = sheets.id AND dt.document_id = sheets.document_id);
END;

-- An added reference: the sheet is referenced again.
CREATE TRIGGER sheet_refs_added AFTER INSERT ON sheet_refs
BEGIN
  UPDATE sheets SET unreferenced_since = NULL
   WHERE id = NEW.sheet_id
     AND document_id IN (SELECT document_id FROM document_tabs WHERE tab_id = NEW.tab_id)
     AND unreferenced_since IS NOT NULL;
END;
