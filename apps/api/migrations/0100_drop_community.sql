-- liveplanner has no Community gallery: its tables (0068, 0069, 0070) go, children before the posts they
-- reference. The community links those posts owned go with them; share_links.purpose stays at its 'share' default.
DELETE FROM share_links WHERE purpose = 'community';
DROP TABLE IF EXISTS community_reports;
DROP TABLE IF EXISTS community_copies;
DROP TABLE IF EXISTS community_likes;
DROP TABLE IF EXISTS community_post_tags;
DROP TABLE IF EXISTS community_posts;
