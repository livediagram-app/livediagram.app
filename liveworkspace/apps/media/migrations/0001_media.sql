-- liveworkspace's media service (liveworkspace/docs/specs/006-media/media.md): every app's uploaded images, indexed here,
-- their bytes in the R2 bucket bound as MEDIA (key = images.id).

-- One row per stored image. (owner, sha256) is unique, so the same person uploading the same bytes in any
-- app gets the one image back. `app` is where it was uploaded; any app may place it.
CREATE TABLE images (
  id            TEXT PRIMARY KEY,
  owner         TEXT NOT NULL,
  app           TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  byte_size     INTEGER NOT NULL,
  width         INTEGER NOT NULL,
  height        INTEGER NOT NULL,
  sha256        TEXT NOT NULL,
  original_name TEXT,
  created_at    INTEGER NOT NULL
);
CREATE UNIQUE INDEX images_owner_sha_idx ON images (owner, sha256);
CREATE INDEX images_owner_created_idx ON images (owner, created_at DESC);
CREATE INDEX images_created_idx ON images (created_at);

-- Which images each app's documents place, as each app last reported it. The app's own documents are the
-- source of truth; this is what the unused-image sweep and the usage map read. No foreign key to images: a
-- document may place an image deleted from its gallery, and that reference is harmless.
CREATE TABLE refs (
  app      TEXT NOT NULL,
  document TEXT NOT NULL,
  image_id TEXT NOT NULL,
  PRIMARY KEY (app, document, image_id)
) WITHOUT ROWID;
CREATE INDEX refs_image_idx ON refs (image_id);

-- When each app finished sending every document it holds at least once. The sweep deletes nothing until
-- every app with a key has: an app that hasn't reported yet would read as placing nothing.
CREATE TABLE ref_sync (
  app          TEXT PRIMARY KEY,
  completed_at INTEGER NOT NULL
) WITHOUT ROWID;
