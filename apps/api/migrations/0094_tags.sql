-- Tags (docs/specs/013-workspace/tags.md): coloured labels a person makes and puts on their documents.
--
-- Personal, like favourites: a tag belongs to one owner, and putting it on a team document marks it for that owner
-- only. Their own tables rather than keys in the 4 KB user_preferences blob, which a person's tags and links would
-- outgrow, failing every preference write.
--
-- `colour` is a standard colour's name ('blue') or a custom '#rrggbb'. One name per owner, ignoring case.
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  colour TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Serves every read by owner, and the one-name-per-person rule.
CREATE UNIQUE INDEX tags_owner_name ON tags (owner_id, name COLLATE NOCASE);

-- One tag on one document. Both sides cascade: deleting a tag takes it off every document, and a purged document drops
-- its tags. The primary key serves the list's join from tags; the document index keeps a document delete's cascade a
-- seek rather than a scan.
CREATE TABLE document_tags (
  tag_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (tag_id, document_id),
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX document_tags_document_idx ON document_tags (document_id);
