-- Start With (liveworkspace/docs/specs/007-community/community.md "Start With"): each app's top posts per category by
-- the likes they received in the last 30 days. Reading each of the app's public posts' likes in the window by
-- (post_id, created_at), with the network in the index too, keeps the read inside the index and to the app's own
-- month of likes, where idx_likes_created alone reads every app's month and each row's table page (measured: 33 ms
-- against 167 ms over 200,000 likes; 208 ms against 1,174 ms over a million).
CREATE INDEX idx_likes_post_created ON likes (post_id, created_at, network_hash);
