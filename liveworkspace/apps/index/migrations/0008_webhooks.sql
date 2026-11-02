-- Webhooks (liveworkspace/docs/specs/004-index/webhooks.md, Work Tracker #153): what a person's or a team's items do,
-- sent to another tool. Two new tables; nothing existing changes.

-- One per webhook, tied to a scope (`p:<person>` or `t:<team>`), never to an item. The URL and the signing secret are
-- sealed (AES-GCM under WEBHOOK_KEY, the webhook's id bound in); only the URL's host is kept in the clear, for the
-- list. `events` is a comma-wrapped list (`,created,moved,`) so one `instr` matches an event type.
CREATE TABLE webhooks (
  id            TEXT    PRIMARY KEY,
  scope         TEXT    NOT NULL,
  kind          TEXT    NOT NULL CHECK (kind IN ('json', 'slack', 'teams')),
  name          TEXT    NOT NULL,
  url_sealed    TEXT    NOT NULL,
  host          TEXT    NOT NULL,
  secret_sealed TEXT,
  events        TEXT    NOT NULL,
  created_by    TEXT    NOT NULL,
  created_at    INTEGER NOT NULL,
  paused_at     INTEGER,
  paused_reason TEXT,
  -- Deliveries given up in a row; 20 pauses it.
  failures      INTEGER NOT NULL DEFAULT 0
);
-- The outbox statement's probe: the live webhooks of one scope.
CREATE INDEX webhooks_scope_live ON webhooks (scope) WHERE paused_at IS NULL;
-- Closing an account: the webhooks a person made.
CREATE INDEX webhooks_creator ON webhooks (created_by);

-- The outbox and the recent list in one: a row per (webhook, event), written pending in the batch that records the
-- event, sent by the dispatcher's alarm, then kept (delivered or failed) as one of the webhook's recent deliveries,
-- its newest WEBHOOK_DELIVERIES_KEPT only. The event is copied in as it was, so a delivery reads no other table.
CREATE TABLE webhook_deliveries (
  id           INTEGER PRIMARY KEY,
  webhook_id   TEXT    NOT NULL REFERENCES webhooks (id) ON DELETE CASCADE,
  event_id     TEXT    NOT NULL,
  type         TEXT    NOT NULL,
  app          TEXT    NOT NULL,
  item_id      TEXT,
  title        TEXT    NOT NULL,
  actor_id     TEXT,
  actor_name   TEXT,
  detail       TEXT,
  occurred_at  INTEGER NOT NULL,
  state        TEXT    NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'delivered', 'failed')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  next_at      INTEGER NOT NULL,
  status       INTEGER,
  error        TEXT,
  last_at      INTEGER,
  UNIQUE (webhook_id, event_id)
);
-- The dispatcher's read: what is due, soonest first.
CREATE INDEX webhook_deliveries_due ON webhook_deliveries (next_at) WHERE state = 'pending';
-- A webhook's recent list, its pending count and its trim.
CREATE INDEX webhook_deliveries_webhook ON webhook_deliveries (webhook_id, state, id);
