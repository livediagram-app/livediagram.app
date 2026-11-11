-- Home's New (liveworkspace/docs/specs/004-index/one-explorer.md "New, on Home"): each scope's live items, the most
-- recently made first, so `newest=N` walks N rows a scope and stops. Keyed on created_at, which never changes, so a
-- rename, a summary push or any other update leaves these entries alone. Written by hand.
CREATE INDEX items_new ON items (scope, created_at DESC, id DESC) WHERE trashed_at IS NULL;
-- The same, filtered to one app (each app's Explorer opens on its own items).
CREATE INDEX items_new_app ON items (scope, app, created_at DESC, id DESC) WHERE trashed_at IS NULL;
