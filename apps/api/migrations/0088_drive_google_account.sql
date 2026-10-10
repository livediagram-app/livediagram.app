-- docs/specs/022-drive-mirror/drive-mirror.md "Data": the Google account a broker connection belongs to
-- (Drive's `about.user.permissionId`, a stable per-account id), recorded on every consent. A consent by a
-- different Google account clears the root folder, the page token and every drive_items row, which name
-- the first account's files. NULL on rows made before this migration and on browser-only connections;
-- the first consent after it records the account without clearing anything.
ALTER TABLE drive_connections ADD COLUMN google_account_id TEXT;
