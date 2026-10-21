-- Tab-scoped share links (docs/specs/013-workspace/tab-scoped-share-links.md). A link scoped to one
-- tab opens only that tab; NULL = All tabs, which is what every existing
-- link is. shared_with records the scope the visitor was last granted, so
-- the Shared list and Activity never hand back a broader code.

ALTER TABLE share_links ADD COLUMN tab_id TEXT NULL;
ALTER TABLE shared_with ADD COLUMN tab_id TEXT NULL;

-- A room ticket carries the scope and the code that granted it from the mint
-- to the upgrade, so the room confines the session and can close it when
-- that code is revoked or rescoped.
ALTER TABLE ws_tickets ADD COLUMN tab_scope TEXT NULL;
ALTER TABLE ws_tickets ADD COLUMN share_code TEXT NULL;
