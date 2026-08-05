-- Timeline unread marker (spec/138 §2.5).
--
-- `last_refreshed_at` was written by the Refresh button, which is gone:
-- the feed loads on mount and seeds itself off that same read, so a
-- manual refresh had nothing to do. The column is repurposed for the
-- question the feed actually needs to answer — "what has happened since
-- I was last here" — which is the whole premise of the surface and had
-- nothing tracking it.
--
-- A rename rather than a new column: the old value was a read timestamp
-- for the same scope by the same user, so it is a truthful (if
-- conservative) starting point for "last seen". Nobody loses a marker.

ALTER TABLE timeline_scope_state RENAME COLUMN last_refreshed_at TO last_seen_at;
