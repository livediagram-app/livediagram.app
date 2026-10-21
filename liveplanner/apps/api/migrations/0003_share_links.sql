-- Multiple share links per diagram, each with its own role. Replaces
-- the single-code model from migration 0002 by:
--   1. introducing a share_links table keyed on the short code,
--   2. backfilling existing shared diagrams as `edit` links,
--   3. leaving the `share_code` / `shareable` columns in place for
--      now so the API can roll out gradually. A future migration can
--      drop them once nothing reads them.
--
-- Role vocabulary is intentionally narrow: 'edit' grants full
-- read/write to the diagram, 'view' is read-only. Anything more
-- granular can be added with a new column or a separate permissions
-- table later.

CREATE TABLE share_links (
  code        TEXT    PRIMARY KEY,
  diagram_id  TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('edit', 'view')),
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

CREATE INDEX idx_share_links_diagram ON share_links (diagram_id);

-- Backfill: every currently-shared diagram becomes an `edit` link
-- under its existing code. Older diagrams whose share_code is NULL
-- are left untouched.
INSERT INTO share_links (code, diagram_id, role, created_at)
SELECT share_code, id, 'edit', created_at
FROM diagrams
WHERE share_code IS NOT NULL AND shareable = 1;
