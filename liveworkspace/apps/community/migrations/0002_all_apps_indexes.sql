-- All Apps (liveworkspace/docs/specs/007-community/community.md "One page for every app"): the Community page lists and
-- counts every app's posts together, `state = 'listed' AND document_state = 'public'` with no app. The indexes in 0001
-- lead with the app, so these lead with the state instead, one per sort and one for a category, and each sort walks
-- its own as one app's does.
CREATE INDEX idx_posts_all_new ON posts (state, document_state, published_at DESC);
CREATE INDEX idx_posts_all_loved ON posts (state, document_state, like_count DESC, published_at DESC);
CREATE INDEX idx_posts_all_copied ON posts (state, document_state, copy_count DESC, published_at DESC);
CREATE INDEX idx_posts_all_category ON posts (category, state, document_state, published_at DESC);
