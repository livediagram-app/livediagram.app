-- Default folders, per docs/specs/013-workspace/default-folders.md.
--
-- One row per person and default key (`mode:diagram`, `mode:draw`): the folder
-- that person's new documents of that key land in when no place is chosen.
-- Owner-scoped (Clerk sub or the X-Owner-Id guest id), guests included.
--
-- `folder_id` deliberately has no foreign key and no ON DELETE: a default whose
-- folder is gone is skipped when used and kept, so a restore that recreates
-- the same folder id revives it. The primary key's owner_id prefix serves the
-- only read, "this person's defaults".

CREATE TABLE placement_defaults (
  owner_id    TEXT NOT NULL,
  default_key TEXT NOT NULL,
  folder_id   TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (owner_id, default_key)
);
