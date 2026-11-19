-- What each app still has to hear about a revoked AI tool's token (src/assistant-notices.ts, Work Tracker 1294): one
-- row per item of an app that keeps assistants (liveplanner) the person may have reached, so the item forgets the
-- tool (`client`, the token's name) and hands back the cards it holds. Delivered by the frequent cron in batches of up
-- to 100 items per (person, tool, app), deleted once the app confirms, given up on after a week.
CREATE TABLE assistant_notices (
  person_id       TEXT    NOT NULL,
  client          TEXT    NOT NULL,
  app             TEXT    NOT NULL,
  item_id         TEXT    NOT NULL,
  created_at      INTEGER NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER NULL,
  PRIMARY KEY (person_id, client, app, item_id)
);
CREATE INDEX assistant_notices_due ON assistant_notices (last_attempt_at);
