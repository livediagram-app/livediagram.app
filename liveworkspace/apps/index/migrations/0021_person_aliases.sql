-- The guests merged into each person (src/person-aliases.ts; liveworkspace/docs/specs/004-index/
-- one-explorer-contracts.md "Becoming an account", Work Tracker 678): a guest who signs in keeps the dots, answers and
-- reactions they left under their guest collab key, since every grant for the person names those keys too. One row
-- per guest, naming the person it now belongs to; a guest merged into a guest that merges on follows it. Deleted with
-- the person's other rows when they close. Written by hand.
CREATE TABLE person_aliases (
  guest_id  TEXT    NOT NULL PRIMARY KEY,
  person_id TEXT    NOT NULL,
  merged_at INTEGER NOT NULL
);
CREATE INDEX person_aliases_person ON person_aliases (person_id, merged_at);
