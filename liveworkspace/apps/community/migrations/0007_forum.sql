-- The Forum (liveworkspace/docs/specs/007-community/community.md "The Forum"): one forum for every app. Only adds
-- tables; nothing existing changes.

-- A topic (topic_id NULL) or a reply to one. Deleting a topic deletes its replies; deleting the reply a topic marked as
-- its answer clears the mark. author_id is the account's id and is never answered to the public.
CREATE TABLE forum_posts (
  id           TEXT    PRIMARY KEY,
  topic_id     TEXT    REFERENCES forum_posts (id) ON DELETE CASCADE,
  category     TEXT    NOT NULL,
  author_id    TEXT    NOT NULL,
  author_name  TEXT    NOT NULL,
  author_color TEXT    NOT NULL,
  title        TEXT    NOT NULL DEFAULT '',
  body         TEXT    NOT NULL,
  -- listed: everyone sees it. pending: waiting for the check. refused: the check failed. hidden: after reports, final.
  state        TEXT    NOT NULL DEFAULT 'pending' CHECK (state IN ('listed', 'pending', 'refused', 'hidden')),
  answer_id    TEXT    REFERENCES forum_posts (id) ON DELETE SET NULL,
  check_tries  INTEGER NOT NULL DEFAULT 0,
  checked_at   INTEGER NOT NULL DEFAULT 0,
  hidden_at    INTEGER,
  created_at   INTEGER NOT NULL,
  edited_at    INTEGER,
  -- A topic's latest listed reply, or its creation.
  activity_at  INTEGER NOT NULL
);

CREATE INDEX idx_forum_topics_active ON forum_posts (state, activity_at DESC) WHERE topic_id IS NULL;
CREATE INDEX idx_forum_topics_new ON forum_posts (state, created_at DESC) WHERE topic_id IS NULL;
CREATE INDEX idx_forum_topics_category ON forum_posts (category, state, activity_at DESC) WHERE topic_id IS NULL;
CREATE INDEX idx_forum_replies ON forum_posts (topic_id, state, created_at);
CREATE INDEX idx_forum_author ON forum_posts (author_id);
CREATE INDEX idx_forum_pending ON forum_posts (checked_at) WHERE state = 'pending';

-- One per account, post and kind.
CREATE TABLE forum_reactions (
  post_id    TEXT    NOT NULL REFERENCES forum_posts (id) ON DELETE CASCADE,
  account_id TEXT    NOT NULL,
  reaction   TEXT    NOT NULL CHECK (reaction IN ('helpful', 'thanks', 'celebrate')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, account_id, reaction)
);

CREATE INDEX idx_forum_reactions_account ON forum_reactions (account_id);

-- As a gallery post's reports: once per community key, three keys on three networks hide the post.
CREATE TABLE forum_reports (
  post_id      TEXT    NOT NULL REFERENCES forum_posts (id) ON DELETE CASCADE,
  reporter_key TEXT    NOT NULL,
  network_hash TEXT    NOT NULL,
  reason       TEXT    NOT NULL
    CHECK (reason IN ('spam', 'offensive', 'personal-info', 'copyright', 'other')),
  note         TEXT,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (post_id, reporter_key)
);

-- Per-account limits and the day's checks, one row per subject and window (w:<account>, r:<account> per hour; checks
-- per day). The cron drops windows older than two days.
CREATE TABLE forum_counters (
  subject TEXT    NOT NULL,
  bucket  INTEGER NOT NULL,
  n       INTEGER NOT NULL,
  PRIMARY KEY (subject, bucket)
);
