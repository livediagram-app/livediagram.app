-- Google Drive mirror (docs/specs/022-drive-mirror/drive-mirror.md, "Data";
-- blueprint docs/specs/022-drive-mirror/blueprints/drive-mirror.md).
--
-- drive_connections: one row per signed-in user who connected Drive. The
-- refresh token is AES-GCM sealed under DRIVE_TOKEN_KEY before it lands here
-- and is never read back out by any route; it is NULL for a browser-only
-- connection (a deployment with a client id but no secret). The lease columns
-- keep two devices from writing the mirror at once.
CREATE TABLE drive_connections (
  owner_id TEXT PRIMARY KEY,
  refresh_token_enc TEXT,
  root_folder_id TEXT,
  page_token TEXT,
  page_token_saved_at INTEGER,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'needs_reconnect')),
  connected_at INTEGER NOT NULL,
  lease_holder TEXT,
  lease_expires_at INTEGER
);

-- drive_items: one row per mirrored diagram or folder, holding the Drive state
-- livediagram last wrote (or accepted), so a change read back from Drive is
-- recognised as an echo of our own write. Removed with the diagram (in
-- diagramRemovalStatements), the folder (deleteFolder) or the account.
CREATE TABLE drive_items (
  owner_id TEXT NOT NULL,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('diagram', 'folder')),
  ld_id TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  ld_name TEXT NOT NULL,
  parent_id TEXT,
  trashed INTEGER NOT NULL DEFAULT 0,
  md5 TEXT,
  head_revision_id TEXT,
  mirrored_saved_at INTEGER,
  notice TEXT CHECK (notice IS NULL OR notice = 'unseen_folder'),
  notice_parent_id TEXT,
  PRIMARY KEY (owner_id, item_kind, ld_id),
  UNIQUE (owner_id, drive_file_id)
);

-- The removal paths delete by (item_kind, ld_id) across owners.
CREATE INDEX drive_items_ld_idx ON drive_items (item_kind, ld_id);
