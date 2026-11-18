-- Unconfirmed references (liveworkspace/docs/specs/006-media/media.md "Unconfirmed references"): the pictures a
-- document will report but has not yet, as its source vouched for them (a liveplanner plan for its copy). A release
-- and the sweep keep any image one names; the document's own report drops them. No foreign key, as `refs`.
CREATE TABLE IF NOT EXISTS pending_refs (
  app        TEXT NOT NULL,
  document   TEXT NOT NULL,
  image_id   TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (app, document, image_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS pending_refs_image_idx ON pending_refs (image_id);
