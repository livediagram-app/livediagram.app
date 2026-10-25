-- What each app still has to hear about a closed account (src/person-notices.ts): one row per app for the
-- person (`item_id` ''), so the app drops what it keeps for them beside their items, and one per item of
-- someone else's that names them (their comments, actions and edits), so the app takes their name off it.
-- Delivered by the frequent cron in batches of up to 100 items per app, and deleted once the app confirms.
CREATE TABLE person_app_notices (
  person_id       TEXT    NOT NULL,
  app             TEXT    NOT NULL,
  item_id         TEXT    NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER NULL,
  PRIMARY KEY (person_id, app, item_id)
);
CREATE INDEX person_app_notices_due ON person_app_notices (last_attempt_at);
