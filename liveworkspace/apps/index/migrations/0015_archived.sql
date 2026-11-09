-- Archived (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Archived", blueprints/archive.md): an item
-- its owner put away. When set, the item's scope is `a:<owner>`, a scope in no person's or team's list, so every live
-- list (driven by scope through items_live and its siblings) leaves it out without a new index, and the Archived view
-- reads that one scope through items_live. Written by hand.
ALTER TABLE items ADD COLUMN archived_at INTEGER NULL;
