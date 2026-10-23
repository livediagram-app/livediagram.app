-- Images move to liveworkspace's media service (liveworkspace/docs/media.md): the bytes, the gallery, dedupe and
-- the caps are its now, and this api keeps what its own access rules need. Nothing is carried over: the images
-- uploaded before this stay in `images` and the IMAGES bucket, unserved, until they are migrated.
--
-- Whose each image is, as this api names owners (an account id or a guest id), for every image this api has
-- met: one uploaded here, one listed in someone's gallery here, or one a document asked for. The placement
-- grants (0075) read it in place of `images`. An owner of '' is an id the service doesn't know, so a document
-- placing it doesn't ask again on every read.
CREATE TABLE media_images (
  id       TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL
) WITHOUT ROWID;

CREATE INDEX media_images_owner_idx ON media_images (owner_id);

-- The documents whose images changed since the service last heard (liveworkspace/docs/media.md "References"):
-- written in the same batch as the change, sent by the every-minute cron. `queued_at` moves on each change, so
-- the cron deletes only the rows it sent.
CREATE TABLE media_ref_outbox (
  document_id TEXT PRIMARY KEY,
  queued_at   INTEGER NOT NULL
) WITHOUT ROWID;
