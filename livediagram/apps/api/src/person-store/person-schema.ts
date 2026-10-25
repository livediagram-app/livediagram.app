// A person's own SQLite (person-store.ts): what livediagram keeps for one person rather than for one canvas.
// Each change appends a step and never edits an earlier one, so a store at any version reaches the latest.

import type { ItemSql as DocumentSql } from '@liveworkspace/index-app';

const V1 = `
-- Shape libraries (docs/specs/013-workspace/shape-libraries.md): the person's named sets of reusable shapes. The
-- items are the validated list as JSON (shape-library-row.ts parses it).
CREATE TABLE IF NOT EXISTS shape_libraries (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  source     TEXT    NOT NULL,
  items      TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- The retired browser-only Google Drive mirror (removed in 721646113; the platform's mirror replaced it): the person's one connection (sealed
-- refresh token, root folder, change cursor, cross-device lease, Google account and a pending switch)...
CREATE TABLE IF NOT EXISTS drive_connections (
  id                        INTEGER PRIMARY KEY CHECK (id = 1),
  refresh_token_enc         TEXT,
  root_folder_id            TEXT,
  page_token                TEXT,
  page_token_saved_at       INTEGER,
  status                    TEXT    NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'needs_reconnect')),
  connected_at              INTEGER NOT NULL,
  lease_holder              TEXT,
  lease_expires_at          INTEGER,
  google_account_id         TEXT,
  pending_refresh_token_enc TEXT,
  pending_google_account_id TEXT,
  pending_expires_at        INTEGER
);

-- ...and each canvas and folder it mirrors, one Drive file each.
CREATE TABLE IF NOT EXISTS drive_items (
  item_kind         TEXT    NOT NULL CHECK (item_kind IN ('document', 'folder')),
  ld_id             TEXT    NOT NULL,
  drive_file_id     TEXT    NOT NULL UNIQUE,
  name              TEXT    NOT NULL,
  ld_name           TEXT    NOT NULL,
  parent_id         TEXT,
  trashed           INTEGER NOT NULL DEFAULT 0,
  md5               TEXT,
  head_revision_id  TEXT,
  mirrored_saved_at INTEGER,
  notice            TEXT    CHECK (notice IS NULL OR notice = 'unseen_folder'),
  notice_parent_id  TEXT,
  PRIMARY KEY (item_kind, ld_id)
);
`;

// livediagram's own Google Drive mirror is gone (liveworkspace/docs/drive.md "Coming from livediagram's mirror"):
// Google Drive sync is liveworkspace's service now, which keeps its rows itself. Its two tables go, with every
// connection's sealed token and every mirrored item in them. The files stay in the person's Drive.
const V2 = `
DROP TABLE IF EXISTS drive_items;
DROP TABLE IF EXISTS drive_connections;
`;

const STEPS: readonly string[] = [V1, V2];

// Bring the person's SQLite up to date. Idempotent: the version row skips what already ran.
export function migratePersonSchema(sql: DocumentSql): void {
  sql.exec('CREATE TABLE IF NOT EXISTS _person_schema (version INTEGER NOT NULL)');
  const row = sql.exec('SELECT version FROM _person_schema LIMIT 1').toArray()[0];
  const at = typeof row?.version === 'number' ? row.version : 0;
  if (at >= STEPS.length) return;
  for (let step = at; step < STEPS.length; step++) sql.exec(STEPS[step]!);
  sql.exec('DELETE FROM _person_schema');
  sql.exec(`INSERT INTO _person_schema (version) VALUES (${STEPS.length})`);
}

// Whether the store holds anything at all: a read that writes nothing, for a store that may never have started.
export function hasPersonSchema(sql: DocumentSql): boolean {
  return (
    sql.exec("SELECT 1 AS present FROM sqlite_master WHERE name = '_person_schema'").toArray()
      .length > 0
  );
}
