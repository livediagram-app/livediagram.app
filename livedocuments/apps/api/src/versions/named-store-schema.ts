// The named versions' rows beside the snapshots' store (docs/specs/006-document/version-history.md "Where versions are
// kept"; blueprint VH20 to VH23), schema step 11 of the document's SQLite (document-schema.ts). Additive and
// idempotent: the platform's snapshot tables (the same IF NOT EXISTS SQL its store runs on first use), then this
// table, its index and the trigger that takes a version's snapshot rows with it. Nothing existing is altered, so a room
// that fails here still reads every version `tab_versions` holds.

import { SNAPSHOT_SCHEMA } from '@liveworkspace/snapshots/server';

export const NAMED_VERSION_SCHEMA = `
CREATE TABLE IF NOT EXISTS tab_named_versions (
  snapshot_id   TEXT    PRIMARY KEY,
  tab_id        TEXT    NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  rev           INTEGER NOT NULL,
  tab_name      TEXT    NOT NULL,
  element_count INTEGER NOT NULL,
  saved_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tab_named_versions_by_tab ON tab_named_versions (tab_id, rev);

CREATE TRIGGER IF NOT EXISTS tab_named_versions_gone AFTER DELETE ON tab_named_versions
BEGIN
  DELETE FROM snapshot_chunks WHERE snapshot_id = OLD.snapshot_id;
  DELETE FROM snapshots WHERE id = OLD.snapshot_id;
END;
`;

// Step 11: the snapshot tables first, since the trigger names them.
export const NAMED_STORE_STEP = `${SNAPSHOT_SCHEMA}\n${NAMED_VERSION_SCHEMA}`;
