-- What each app still has to hear about a guest who became an account (src/person-merges.ts): one row per app,
-- so the app moves what it keeps for the person beside their items (images, its own per-person store) to the
-- account. Delivered at once after the merge and by the frequent cron, and deleted once the app confirms.
CREATE TABLE person_app_merges (
  guest_id        TEXT    NOT NULL,
  user_id         TEXT    NOT NULL,
  app             TEXT    NOT NULL,
  created_at      INTEGER NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER NULL,
  PRIMARY KEY (guest_id, app)
);
CREATE INDEX person_app_merges_due ON person_app_merges (last_attempt_at);
