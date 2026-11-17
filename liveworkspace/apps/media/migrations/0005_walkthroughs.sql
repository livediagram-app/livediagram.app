-- Walkthroughs (liveworkspace/docs/specs/006-media/walkthroughs.md): the narrated recordings the canvas apps keep. One
-- row each; the media at R2 `walkthroughs/<id>/media` and the events at `walkthroughs/<id>/events.json`. A row is
-- ready once its media has arrived; one that never is goes in the daily sweep.
CREATE TABLE walkthroughs (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  app TEXT NOT NULL,
  item TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  duration_ms INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  media_bytes INTEGER NOT NULL,
  events_bytes INTEGER NOT NULL,
  camera INTEGER NOT NULL,
  ready INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX walkthroughs_item_idx ON walkthroughs (app, item, created_at DESC);
CREATE INDEX walkthroughs_owner_idx ON walkthroughs (owner);
CREATE INDEX walkthroughs_pending_idx ON walkthroughs (ready, created_at);
