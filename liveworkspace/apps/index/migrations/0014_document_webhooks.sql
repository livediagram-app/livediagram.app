-- Webhooks per document (liveworkspace/docs/specs/004-index/webhooks.md, "Who adds one", "Earlier webhooks"): a
-- webhook belongs to one item and reports only on it, managed by whoever can edit the whole item. The account and team
-- webhooks before this (a `scope` of `p:<person>` or `t:<team>`) are retired: they and their deliveries are deleted,
-- and both tables are made again, empty, keyed to the item. Written by hand.
--
-- `webhooks.item_id` references `items` and cascades, so a document deleted for good takes its webhooks with it, and
-- their deliveries cascade from the webhook. A later migration that rebuilds `items` (as 0009 did) must copy
-- `webhooks` and `webhook_deliveries` aside with its other children.

DROP TABLE webhook_deliveries;
DROP TABLE webhooks;

-- One per webhook, tied to one item. The URL and the signing secret are sealed (AES-GCM under WEBHOOK_KEY, the
-- webhook's id bound in); only the URL's host is kept in the clear, for the list. `events` is a comma-wrapped list
-- (`,renamed,shared,`) so one `instr` matches an event type. `who`: `anyone`, or `me` for only its creator's actions.
CREATE TABLE webhooks (
  id            TEXT    PRIMARY KEY,
  item_id       TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  kind          TEXT    NOT NULL CHECK (kind IN ('json', 'slack', 'teams')),
  name          TEXT    NOT NULL,
  url_sealed    TEXT    NOT NULL,
  host          TEXT    NOT NULL,
  secret_sealed TEXT,
  events        TEXT    NOT NULL,
  who           TEXT    NOT NULL DEFAULT 'anyone' CHECK (who IN ('anyone', 'me')),
  created_by    TEXT    NOT NULL,
  created_at    INTEGER NOT NULL,
  paused_at     INTEGER,
  paused_reason TEXT,
  -- Deliveries given up in a row; 20 pauses it.
  failures      INTEGER NOT NULL DEFAULT 0
);
-- The outbox statement's probe: the live webhooks of one item.
CREATE INDEX webhooks_item_live ON webhooks (item_id) WHERE paused_at IS NULL;
-- The dialog's list and the per-document limit.
CREATE INDEX webhooks_item ON webhooks (item_id, created_at);
-- Closing an account: the webhooks a person made.
CREATE INDEX webhooks_creator ON webhooks (created_by);

-- The outbox and the recent list in one, as in 0008: a row per (webhook, event), written pending in the batch that
-- records the event, sent by the dispatcher's alarm, then kept (delivered or failed) as one of the webhook's recent
-- deliveries, its newest WEBHOOK_DELIVERIES_KEPT only.
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
CREATE INDEX webhook_deliveries_due ON webhook_deliveries (next_at) WHERE state = 'pending';
CREATE INDEX webhook_deliveries_webhook ON webhook_deliveries (webhook_id, state, id);
