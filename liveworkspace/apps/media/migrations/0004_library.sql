-- The Library (liveworkspace/docs/specs/006-media/libraries.md): the things people save once and place in every
-- document, in every app. One row per item, in a person's Personal library (scope 'personal', scope_id their media
-- owner) or a team's (scope 'team', scope_id the team id). Its elements are the saving app's portable JSON.
CREATE TABLE library_items (
  id          TEXT PRIMARY KEY,
  scope       TEXT NOT NULL CHECK (scope IN ('personal', 'team')),
  scope_id    TEXT NOT NULL,
  folder      TEXT NOT NULL DEFAULT '',
  title       TEXT NOT NULL,
  width       REAL NOT NULL,
  height      REAL NOT NULL,
  kinds       TEXT NOT NULL,
  elements    TEXT NOT NULL,
  images      TEXT NOT NULL DEFAULT '[]',
  preview     TEXT,
  app         TEXT NOT NULL,
  created_by  TEXT NOT NULL,
  -- An old shape library's item this one was copied from on first write: '<app>~<libraryId>~<itemId>'.
  legacy_ref  TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX library_items_scope_idx ON library_items (scope, scope_id, created_at DESC);

-- The old shape libraries already copied into a person's Personal library ('<app>~<libraryId>'), so the read in
-- place leaves them out from then on.
CREATE TABLE library_legacy_copies (
  owner      TEXT NOT NULL,
  legacy     TEXT NOT NULL,
  copied_at  INTEGER NOT NULL,
  PRIMARY KEY (owner, legacy)
) WITHOUT ROWID;
