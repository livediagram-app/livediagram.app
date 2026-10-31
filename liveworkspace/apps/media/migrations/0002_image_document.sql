-- The document each image was uploaded for, when the app named one (liveworkspace/docs/specs/006-media/media.md
-- "Uploads"). Null for images uploaded before this column, and for uploads with no document the server holds (a This
-- Browser plan). The sweep reads it: a claimed image's own app vouches for it document by document, so it can go
-- once every other keyed app has reported; an unclaimed one waits for every keyed app, its own included.
ALTER TABLE images ADD COLUMN document TEXT;
