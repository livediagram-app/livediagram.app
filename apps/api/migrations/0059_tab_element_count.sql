-- Which documents are empty, without reading a tab body (docs/specs/006-document/document-snapshots.md,
-- "An empty document is never asked for").
--
-- tabs.element_count: how many elements the tab's `data` holds; null when `data` is not a JSON object
-- with an `elements` array (an uncountable body reads as not empty, so its thumbnail is still asked for).
-- The triggers keep it on every write path, so no writer has to remember it.
ALTER TABLE tabs ADD COLUMN element_count INTEGER NULL;

UPDATE tabs
   SET element_count = CASE WHEN json_valid(data) THEN json_array_length(data, '$.elements') END;

CREATE TRIGGER tabs_element_count_insert AFTER INSERT ON tabs
BEGIN
  UPDATE tabs
     SET element_count = CASE WHEN json_valid(NEW.data) THEN json_array_length(NEW.data, '$.elements') END
   WHERE id = NEW.id;
END;

CREATE TRIGGER tabs_element_count_update AFTER UPDATE OF data ON tabs
BEGIN
  UPDATE tabs
     SET element_count = CASE WHEN json_valid(NEW.data) THEN json_array_length(NEW.data, '$.elements') END
   WHERE id = NEW.id;
END;
