-- liveworkspace's Community (liveworkspace/docs/community.md): every app's listings in one database, apart
-- from accounts, telemetry and every app's own data. A post lists a document that stays in its app's own
-- database: the app keeps the document and its community link, and tells this service where the
-- document stands (`document_state`). Nothing here is ever an app's document content.

-- One row per published document, per app. Deleting a post cascades its tags, likes, copies and reports.
CREATE TABLE posts (
  id             TEXT    PRIMARY KEY,
  app            TEXT    NOT NULL,
  -- The app's document id and its community link's code: opaque here, never shown but the code, which is
  -- what the card image, the read-only viewer and the copy open through on the app's own site.
  document       TEXT    NOT NULL,
  share_code     TEXT    NOT NULL,
  -- The author's account id in the app: limits a post count, finds My Shares. Never in a public answer.
  owner          TEXT    NOT NULL,
  -- How the author is shown when the post isn't anonymous, as the app last sent it.
  author_name    TEXT    NOT NULL,
  author_color   TEXT    NOT NULL,
  author_picture TEXT    NULL,
  anonymous      INTEGER NOT NULL DEFAULT 1,
  title          TEXT    NOT NULL,
  description    TEXT    NOT NULL,
  category       TEXT    NOT NULL,
  -- The display array (JSON); post_tags holds the same set for filtering.
  tags           TEXT    NOT NULL DEFAULT '[]',
  -- Lowercased title, description and tags: what search matches against.
  search_text    TEXT    NOT NULL,
  -- Where the document stands in its app, as the app last said: 'public' when it passes the app's public
  -- rule; 'closed' while it is in a team library or has a share password (still its author's, so still in
  -- My Shares); 'away' while it is in the Trash or belongs to someone other than the author.
  document_state TEXT    NOT NULL DEFAULT 'public' CHECK (document_state IN ('public', 'closed', 'away')),
  like_count     INTEGER NOT NULL DEFAULT 0,
  copy_count     INTEGER NOT NULL DEFAULT 0,
  -- Hidden after reports is final.
  state          TEXT    NOT NULL DEFAULT 'listed' CHECK (state IN ('listed', 'hidden')),
  hidden_at      INTEGER NULL,
  published_at   INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  UNIQUE (app, document),
  UNIQUE (app, share_code)
);

-- What the public sees is `state = 'listed' AND document_state = 'public'`, one app at a time: each sort walks its index.
CREATE INDEX idx_posts_new ON posts (app, state, document_state, published_at DESC);
CREATE INDEX idx_posts_loved ON posts (app, state, document_state, like_count DESC, published_at DESC);
CREATE INDEX idx_posts_copied ON posts (app, state, document_state, copy_count DESC, published_at DESC);
CREATE INDEX idx_posts_category ON posts (app, category, state, document_state, published_at DESC);
CREATE INDEX idx_posts_owner ON posts (app, owner);
CREATE INDEX idx_posts_hidden ON posts (app, hidden_at) WHERE hidden_at IS NOT NULL;

CREATE TABLE post_tags (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);

CREATE INDEX idx_post_tags_tag ON post_tags (tag);

-- One like per community key (a random per-browser key, never an owner id) per post. `network_hash` is a
-- one-way hash of the liker's address range salted with the post id: a post's like count takes at most
-- five from one network, and nothing can be compared across posts.
CREATE TABLE likes (
  post_id      TEXT    NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  liker_key    TEXT    NOT NULL,
  network_hash TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (post_id, liker_key)
);

-- The featured six count the last three months' likes.
CREATE INDEX idx_likes_created ON likes (created_at);

-- One row per distinct person who copied the post's document through its community link. `copier` is the
-- app's one-way hash of who, never an owner id.
CREATE TABLE copies (
  post_id      TEXT    NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  copier       TEXT    NOT NULL,
  network_hash TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (post_id, copier)
);

CREATE INDEX idx_copies_copier ON copies (copier);

-- One report per community key per post; three from distinct keys on distinct networks hide the post.
CREATE TABLE reports (
  post_id      TEXT    NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_key TEXT    NOT NULL,
  network_hash TEXT    NOT NULL,
  reason       TEXT    NOT NULL
    CHECK (reason IN ('spam', 'offensive', 'personal-info', 'copyright', 'other')),
  note         TEXT    NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (post_id, reporter_key)
);
