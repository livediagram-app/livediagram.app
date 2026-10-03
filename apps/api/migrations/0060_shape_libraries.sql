-- Shape libraries, per docs/specs/013-workspace/shape-libraries.md.
--
-- Owner-scoped (Clerk sub or the X-Owner-Id guest id, like custom_themes),
-- guests included. `items` is the JSON array of library items as the api
-- validated them (validateShapeLibraryItems), within the tab byte budget.
-- The (owner_id, created_at) index serves the newest-first list and the
-- per-owner count. 0059 is taken by an open pull request; if the merge
-- order changes, this file takes the next free number.

CREATE TABLE shape_libraries (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  source      TEXT NOT NULL,
  items       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX shape_libraries_owner_created_idx ON shape_libraries (owner_id, created_at DESC);
