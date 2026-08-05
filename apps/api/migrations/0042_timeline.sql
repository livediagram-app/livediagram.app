-- Timeline (spec/138) — the Explorer's landing feed.
--
-- Two tables plus a per-scope state row. The split matters: an event
-- row holds WHAT happened once, and the scopes table holds WHO should
-- see it. A comment on a diagram in a twelve-person team library is one
-- `timeline_events` row and twelve `timeline_event_scopes` rows, not
-- twelve copies of the comment text.
--
-- Deliberately NOT a view over existing tables. Comments and assigned
-- actions live inside element JSON in `tabs` (packages/diagram), so
-- there is nothing to index or sort without parsing every tab; and the
-- events we care about (a member joined, an invite arrived) have no
-- durable row at all today. Every event is written at the moment it
-- happens, by the api worker, on the write path.

CREATE TABLE timeline_events (
  id TEXT PRIMARY KEY,
  -- Owner id of whoever did the thing: a Clerk `sub`, or a guest
  -- participant id (spec/04 hybrid identity). NULL for system events
  -- with no human actor, e.g. a token-expiry warning.
  actor_id TEXT,
  -- The domain object this is about. 'diagram' | 'team' | 'account'.
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  -- What happened to it. One source produces many event types over its
  -- life, which is why this is separate from source_type.
  event_type TEXT NOT NULL,
  -- '' for one-shot events (a diagram is created once). Carries
  -- '<actorId>:<YYYY-MM-DD>' for the coalesced editing event, which is
  -- the one event type that deliberately extends itself through a day
  -- rather than emitting per save (spec/138 §4.2).
  dedupe_key TEXT NOT NULL DEFAULT '',
  -- Title Case category, never user content ("Comment Added").
  title TEXT NOT NULL,
  -- Where user content goes (diagram names, comment text, people).
  description TEXT,
  -- Sort key, epoch ms. Integer rather than the ISO strings the shape
  -- was borrowed from: SQLite string-compares a TEXT column, and a
  -- mix of `datetime('now')` output, `toISOString()`, and date-only
  -- values does not sort. `change_log.created_at` is already epoch ms.
  occurred_at INTEGER NOT NULL,
  -- JSON extras the renderer needs, captured at emit time so drawing
  -- the feed never fans out into other tables.
  snapshot TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  -- Makes emission idempotent: a retried request, or a backfill
  -- covering ground a live emit already covered, updates this row
  -- instead of duplicating it.
  UNIQUE (source_type, source_id, event_type, dedupe_key)
);

-- The retention sweep's predicate (spec/138 §3.5).
CREATE INDEX timeline_events_occurred_idx ON timeline_events (occurred_at);

CREATE TABLE timeline_event_scopes (
  event_id TEXT NOT NULL REFERENCES timeline_events (id) ON DELETE CASCADE,
  -- v1 emits only 'user' (scope_id = an owner id). Free text with no
  -- CHECK on purpose: a later per-diagram or per-team feed is a new
  -- value here plus a renderer, not a migration.
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  -- Doubles as the read index: the feed query is a prefix scan on
  -- (scope_type, scope_id).
  PRIMARY KEY (scope_type, scope_id, event_id)
);

-- Cascade lookups when a source entity is deleted, and the guest ->
-- Clerk id migration on sign-up.
CREATE INDEX timeline_event_scopes_event_idx ON timeline_event_scopes (event_id);

CREATE TABLE timeline_scope_state (
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  -- NULL until the one-shot backfill has seeded this scope from the
  -- caller's existing diagrams + team memberships (spec/138 §5).
  backfilled_at INTEGER,
  last_refreshed_at INTEGER,
  PRIMARY KEY (scope_type, scope_id)
);
