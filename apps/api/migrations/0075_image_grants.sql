-- Placement grants (docs/specs/009-elements/images.md, "Placement grants"). A
-- document serves an image when the image's owner owns the document, or the
-- document holds a grant for it. Grants are written when the image's owner is
-- tied to the document as a body is saved, and when a copy carries an image its
-- source could serve, so an id pasted into an unrelated document serves nothing.
-- No foreign keys, like image_refs: the document-removal batch deletes them.
CREATE TABLE image_grants (
  document_id TEXT NOT NULL,
  image_id    TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (document_id, image_id)
) WITHOUT ROWID;

-- Every reference that already crosses owners keeps rendering. There is no way
-- to tell an old paste from a legitimate placement, so all of them are granted.
INSERT OR IGNORE INTO image_grants (document_id, image_id, created_at)
SELECT DISTINCT dt.document_id, r.image_id, CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM image_refs r
  JOIN document_tabs dt ON dt.tab_id = r.tab_id
  JOIN images i ON i.id = r.image_id
  JOIN documents d ON d.id = dt.document_id
 WHERE i.owner_id <> d.owner_id;
