-- Steps in other apps (liveworkspace/docs/specs/018-automations/automations.md "Steps in other apps", blueprint
-- cross-app.md "The index", Work Tracker 1366). `automation_step_days`: an author's steps in other apps a UTC day,
-- across every app (the cap is 500), one row a person a day, rows before yesterday deleted on a day's first write.
CREATE TABLE automation_step_days (
  person_id TEXT    NOT NULL,
  day       INTEGER NOT NULL,
  count     INTEGER NOT NULL,
  PRIMARY KEY (person_id, day)
) WITHOUT ROWID;
CREATE INDEX automation_step_days_day ON automation_step_days (day);

-- A Notify step's notices: one row a person named, shown in their Inbox for 30 days. `item_id` is the item whose rule
-- sent it (the person can reach it); `rule` is cut to 60 characters and `text` to 2,000. The rows cascade from the
-- item, so a purged item takes its notices with it.
CREATE TABLE automation_notices (
  id        TEXT    PRIMARY KEY,
  person_id TEXT    NOT NULL,
  app       TEXT    NOT NULL,
  item_id   TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  rule      TEXT    NOT NULL,
  text      TEXT    NOT NULL,
  at        INTEGER NOT NULL
);
-- The Inbox's read: a person's newest notices.
CREATE INDEX automation_notices_person ON automation_notices (person_id, at DESC);
