-- Item types (docs/specs/026-plan/item-types.md "Storage and sync"): a document's own type catalogue,
-- whole, as JSON. NULL (every document until somebody changes its types) means the built-in types,
-- read from code. Written only by PUT /api/documents/:id/item-types, never by a meta save.
ALTER TABLE documents ADD COLUMN item_types TEXT NULL;
