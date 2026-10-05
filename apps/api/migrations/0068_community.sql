-- Community (docs/specs/025-community/community.md; blueprint docs/specs/025-community/blueprints/community.md §3):
-- documents published to the public gallery, their likes, copies and reports, and the community link each post owns.

-- What a share link is for. 'community' marks a post's own link: never listed for the owner, never expiring, no room,
-- no comments. Every existing link is an ordinary one.
ALTER TABLE share_links ADD COLUMN purpose TEXT NOT NULL DEFAULT 'share'
  CHECK (purpose IN ('share', 'community'));

-- One row per published document. Deleting the document (permanent delete) or the community link (unpublish)
-- cascades the post away with its likes, copies, reports and tags. The Trash leaves it alone: public reads join
-- `documents` and skip a trashed one, so a restore lists it again.
CREATE TABLE community_posts (
  id           TEXT    PRIMARY KEY,
  document_id  TEXT    NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  share_code   TEXT    NOT NULL UNIQUE REFERENCES share_links(code) ON DELETE CASCADE,
  author_id    TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  description  TEXT    NOT NULL,
  category     TEXT    NOT NULL,
  -- The display array (JSON); community_post_tags holds the same set for filtering.
  tags         TEXT    NOT NULL DEFAULT '[]',
  -- Lowercased title, description and tags: what search matches against.
  search_text  TEXT    NOT NULL,
  like_count   INTEGER NOT NULL DEFAULT 0,
  copy_count   INTEGER NOT NULL DEFAULT 0,
  state        TEXT    NOT NULL DEFAULT 'listed' CHECK (state IN ('listed', 'hidden')),
  hidden_by    TEXT    NULL CHECK (hidden_by IN ('reports', 'operator')),
  published_at INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX idx_community_posts_new ON community_posts (state, published_at DESC);
CREATE INDEX idx_community_posts_loved ON community_posts (state, like_count DESC, published_at DESC);
CREATE INDEX idx_community_posts_copied ON community_posts (state, copy_count DESC, published_at DESC);
CREATE INDEX idx_community_posts_category ON community_posts (category, state, published_at DESC);
CREATE INDEX idx_community_posts_author ON community_posts (author_id);

CREATE TABLE community_post_tags (
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);

CREATE INDEX idx_community_post_tags_tag ON community_post_tags (tag);

-- One like per community key (a random per-browser key, never an owner id) per post.
CREATE TABLE community_likes (
  post_id    TEXT    NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  liker_key  TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, liker_key)
);

-- One row per distinct person who copied the post's document through its community link.
CREATE TABLE community_copies (
  post_id    TEXT    NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  copier_id  TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, copier_id)
);

-- One report per community key per post. `network_hash` is a one-way hash of the reporter's address salted with the
-- post id, so automatic hiding can require distinct networks without it being comparable across posts.
CREATE TABLE community_reports (
  post_id      TEXT    NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  reporter_key TEXT    NOT NULL,
  network_hash TEXT    NOT NULL,
  reason       TEXT    NOT NULL
    CHECK (reason IN ('spam', 'offensive', 'personal-info', 'copyright', 'other')),
  note         TEXT    NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (post_id, reporter_key)
);
