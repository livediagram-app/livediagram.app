-- The type catalogue's revision (docs/specs/026-plan/item-types.md "Storage and sync"): raised by every write of
-- `item_types`, and named by a write as the catalogue it changed (`expectedRev`), so two editors saving at once never
-- overwrite each other: the one that read an older catalogue is refused (409) and re-applies its change.
ALTER TABLE documents ADD COLUMN item_types_rev INTEGER NOT NULL DEFAULT 0;
