-- The team audit log (liveworkspace/docs/specs/004-index/team-audit-log.md, Work Tracker #160): what a team's admins can
-- look back on, append-only and kept a year. One new table; nothing existing changes. It references nothing, so a
-- row outlives the item it names (a document deleted for good keeps its id and name here) and a rebuild of items
-- never touches it.

CREATE TABLE team_audit_events (
  team_id     TEXT    NOT NULL,
  -- The Timeline event's id it was copied from; `del:<item>:<at>` for a permanent delete, `wh+:` / `wh-:<webhook>`
  -- for a webhook added or removed. One row per team and event: an event sent again adds nothing.
  id          TEXT    NOT NULL,
  -- TEAM_AUDIT_EVENT_TYPES (@liveworkspace/index-client).
  type        TEXT    NOT NULL,
  -- The document's app; `liveworkspace` for a team's own event and a webhook's.
  app         TEXT    NOT NULL,
  -- Who did it; `deleted` once their account closes. Null when no person did (none today).
  actor_id    TEXT    NULL,
  -- The name accounts sent with a team event; null for the index's own (it keeps no names of people).
  actor_name  TEXT    NULL,
  -- Whom a team event is about (its detail's `personId`); `deleted` once their account closes.
  subject_id  TEXT    NULL,
  -- The document, for a document event. No foreign key: the row stays when the item goes.
  item_id     TEXT    NULL,
  -- The document's, team's or webhook's name then.
  title       TEXT    NOT NULL,
  -- The event's detail as JSON (string values), as on the Timeline.
  detail      TEXT    NULL,
  occurred_at INTEGER NOT NULL,
  PRIMARY KEY (team_id, id)
);
-- A team's log, newest first, and a date range of it.
CREATE INDEX team_audit_time ON team_audit_events (team_id, occurred_at DESC, id DESC);
-- Filtered by who did it.
CREATE INDEX team_audit_actor ON team_audit_events (team_id, actor_id, occurred_at DESC, id DESC);
-- Filtered by kind.
CREATE INDEX team_audit_type ON team_audit_events (team_id, type, occurred_at DESC, id DESC);
-- The daily sweep of rows past the year, the oldest first.
CREATE INDEX team_audit_age ON team_audit_events (occurred_at);
-- Closing an account: the rows they did, and the rows about them.
CREATE INDEX team_audit_people ON team_audit_events (actor_id);
CREATE INDEX team_audit_subject ON team_audit_events (subject_id) WHERE subject_id IS NOT NULL;
