// A repeating card's schedule in the plan's SQLite (docs/specs/026-plan/items.md "Repeating cards", blueprint
// item-store.md "Repeats"): the plan schema's step V12 (plan-schema.ts). One row per card holding a rule: the last day
// settled for it (a copy made, or the day a look started from) and when its next copy is due. Triggers on `items` keep
// it, so no write path (a patch, many patches, a create, a copy, an import, the migration door, an undo) can forget
// one; the room's alarm reads it (card-repeats.ts). A plan without a repeating card has no rows, and its writes pay
// only the triggers' `json_extract` reads.
//
// Every statement is IF NOT EXISTS: the step runs again harmlessly.
export const CARD_REPEATS_SCHEMA = `
CREATE TABLE IF NOT EXISTS item_repeats (
  item_id   TEXT    PRIMARY KEY,
  last_made TEXT    NULL,
  next_at   INTEGER NULL,
  dirty     INTEGER NOT NULL DEFAULT 1
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS item_repeats_due ON item_repeats (dirty, next_at);

CREATE TRIGGER IF NOT EXISTS item_repeats_insert AFTER INSERT ON items
  WHEN json_extract(NEW.fields, '$.repeat') IS NOT NULL
BEGIN
  INSERT INTO item_repeats (item_id, dirty) VALUES (NEW.id, 1)
    ON CONFLICT (item_id) DO UPDATE SET dirty = 1;
END;
CREATE TRIGGER IF NOT EXISTS item_repeats_update AFTER UPDATE OF fields ON items
  WHEN (json_extract(NEW.fields, '$.repeat') IS NOT NULL OR json_extract(OLD.fields, '$.repeat') IS NOT NULL)
   AND (json_extract(NEW.fields, '$.repeat') IS NOT json_extract(OLD.fields, '$.repeat')
     OR json_extract(NEW.fields, '$.status') IS NOT json_extract(OLD.fields, '$.status'))
BEGIN
  INSERT INTO item_repeats (item_id, dirty) VALUES (NEW.id, 1)
    ON CONFLICT (item_id) DO UPDATE SET dirty = 1;
END;
CREATE TRIGGER IF NOT EXISTS item_repeats_delete AFTER DELETE ON items
BEGIN
  DELETE FROM item_repeats WHERE item_id = OLD.id;
END;
`;
