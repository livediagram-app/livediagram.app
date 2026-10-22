-- The Community moves to liveworkspace (liveworkspace/docs/community.md; docs/specs/025-community/community.md):
-- every app's posts, likes, copies and reports are now liveworkspace's, in its own database, and this api keeps only
-- the documents and the community links that open them. The move starts the Community empty: nothing is carried
-- over, so the posts, their links and everything on them go here.

DELETE FROM share_links WHERE purpose = 'community';

DROP TABLE community_reports;
DROP TABLE community_copies;
DROP TABLE community_likes;
DROP TABLE community_post_tags;
DROP TABLE community_posts;

-- What this api keeps of each post: its community link, the document and author it was published from, and what
-- the link's own doors need without asking liveworkspace (the post's id and title, whether it is anonymous, and
-- when liveworkspace hid it after reports). `sent_state` is where the document stood when this api last told
-- liveworkspace ('public', 'closed' or 'away'); the sync sends whatever differs.
--
-- Deliberately no foreign keys: when a document is deleted for good its link goes with it, but this row stays until
-- the sync has told liveworkspace the document is gone.
CREATE TABLE community_links (
  share_code TEXT    PRIMARY KEY,
  document_id TEXT   NOT NULL UNIQUE,
  author_id  TEXT    NOT NULL,
  post_id    TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  anonymous  INTEGER NOT NULL DEFAULT 1,
  hidden_at  INTEGER NULL,
  sent_state TEXT    NULL CHECK (sent_state IN ('public', 'closed', 'away'))
);
