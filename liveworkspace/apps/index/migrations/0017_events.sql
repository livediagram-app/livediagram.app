-- The Timeline goes; a short-lived event log stays (liveworkspace/docs/specs/004-index/one-explorer-contracts.md
-- "The event log"). Events now feed only an item's History, its webhooks and its team's audit log, and are kept 30
-- days (src/events.ts sweepEvents, the daily run). Nobody reads a person's feed any more, so what only the feed
-- needed goes:
-- - timeline_event_scopes (who saw each event), timeline_scope_state (when each person last looked) and
--   timeline_dismissals (Remove from Timeline), with their indexes. History is read through the events' item index and
--   checked against who reaches the item now (src/history.ts).
-- - The kinds nothing reads any more: share_link_expiring, image_uploaded, taken_offline, and accounts' team_deleted
--   and API token events. An old row of these would otherwise wait out the sweep, or show in a History.
-- Then timeline_events becomes `events`, its indexes renamed to match (SQLite can't rename an index, so each is
-- dropped and made again), and an index on `occurred_at` lets the sweep take the oldest in chunks.
--
-- Foreign keys: the two dropped tables that referenced timeline_events (scopes, dismissals) go first, so the rename
-- rewrites no other table's REFERENCES and nothing else points at it (0008's webhook outbox and deliveries, 0011's
-- audit log and 0014 keep event ids as plain text). Dropping a child table only deletes its own rows, so no cascade
-- runs. `events.item_id` still references items and cascades, as 0009 left it: a purged item takes its events.
-- Nothing else changes; no row of a kind still kept is touched.
DROP INDEX IF EXISTS timeline_scopes_app;
DROP INDEX IF EXISTS timeline_scopes_all;
DROP INDEX IF EXISTS timeline_scopes_event;
DROP TABLE timeline_event_scopes;
DROP INDEX IF EXISTS timeline_dismissals_event;
DROP TABLE timeline_dismissals;
DROP TABLE timeline_scope_state;

DELETE FROM timeline_events
WHERE type IN ('share_link_expiring', 'image_uploaded', 'taken_offline', 'team_deleted',
               'token_created', 'token_revoked', 'token_expiring');

DROP INDEX timeline_events_item;
DROP INDEX timeline_events_actor;
ALTER TABLE timeline_events RENAME TO events;
-- History: one item's events, newest first (ties by id, so a page's cursor is exact without a sort).
CREATE INDEX events_item ON events (item_id, occurred_at DESC, id DESC);
-- Closing an account and its notices: what a person did.
CREATE INDEX events_actor ON events (actor_id);
-- The daily sweep: the oldest first.
CREATE INDEX events_occurred ON events (occurred_at);
