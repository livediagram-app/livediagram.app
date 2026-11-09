-- The day counts (liveworkspace/docs/specs/008-telemetry/telemetry.md "Sending events"): one row per UTC day, app and
-- event, holding how many arrived. Ingest adds to them in the same batch as the events; the dashboard reads only
-- them, so a summary reads one row per day and event rather than every event of 59 days.
--
-- `type` is '' for an event without one: a primary key column can't be NULL in a WITHOUT ROWID table, and NULLs
-- never conflict, so the upsert couldn't find the row. No stored type is '' (TELEMETRY_TYPE_PATTERN needs 1 to 40
-- characters); the summary reads '' back as NULL. The key starts with the app, so one app's read is a range of it.
CREATE TABLE event_counts (
  app TEXT NOT NULL,
  day TEXT NOT NULL,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  type TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (app, day, category, action, type)
) WITHOUT ROWID;

-- The first fill: every event already stored (the table holds only the 60-day window), so the dashboard's numbers
-- are the same on the day this ships. One statement: production held 44,203 events in November 2026 (about 30 ms
-- of D1 time); a local SQLite copy fills 1 million in 2 to 4 s, so D1's 30-second limit is millions of events away.
INSERT INTO event_counts (app, day, category, action, type, count)
SELECT app, date(ts / 1000, 'unixepoch'), category, action, COALESCE(type, ''), COUNT(*)
  FROM events
 GROUP BY app, date(ts / 1000, 'unixepoch'), category, action, COALESCE(type, '');

-- Nothing reads one app's range of events any more (the day counts answer it), so its index only cost a write per
-- event. `events_ts_idx` stays, for the sweep and for counting a day again.
DROP INDEX events_app_ts_idx;
