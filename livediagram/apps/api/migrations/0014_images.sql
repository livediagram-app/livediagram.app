-- Image element gallery, per docs/specs/009-elements/images.md.
--
-- Each row indexes one image whose bytes live in the R2 bucket bound
-- as IMAGES (key === images.id). The (owner_id, sha256) unique index
-- drives dedupe so a second upload of identical bytes by the same
-- owner short-circuits without touching R2. The (owner_id, created_at)
-- index serves the gallery list endpoint.

CREATE TABLE images (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  byte_size     INTEGER NOT NULL,
  width         INTEGER NOT NULL,
  height        INTEGER NOT NULL,
  sha256        TEXT NOT NULL,
  original_name TEXT,
  created_at    INTEGER NOT NULL
);

CREATE UNIQUE INDEX images_owner_sha_idx ON images (owner_id, sha256);
CREATE INDEX images_owner_created_idx ON images (owner_id, created_at DESC);
