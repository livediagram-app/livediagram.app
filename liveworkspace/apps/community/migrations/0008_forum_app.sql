-- The Forum's app field (liveworkspace/docs/specs/007-community/community.md "Categories and apps"): apps are no
-- longer categories. A topic names its app in `app` (NULL: Any App) and its kind in `category`. Posts made before
-- the split move: one in an app's category becomes a Question about that app; General stays General, Any App.
-- A reply's category and app are never read (its topic's are), so replies are left as they are.

ALTER TABLE forum_posts ADD COLUMN app TEXT;

UPDATE forum_posts
   SET app = category || '.app', category = 'question'
 WHERE topic_id IS NULL
   AND category IN ('livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle');

CREATE INDEX idx_forum_topics_app ON forum_posts (app, state, activity_at DESC) WHERE topic_id IS NULL;
