-- Which documents are empty, without reading a tab body (docs/specs/006-document/document-snapshots.md,
-- "An empty document is never asked for").
--
-- tabs.element_count: how many elements the tab's `data` holds, or null when unknown. Every tab write binds
-- it from the tab the api already holds. Existing tabs start unknown (null reads as not empty, so their
-- thumbnail is still asked for) and are filled in lazily, by their next write or by the thumbnail route
-- once it has parsed them: no statement here reads a body, so this migration is constant-time however
-- large the table is.
ALTER TABLE tabs ADD COLUMN element_count INTEGER NULL;
