-- liveworkspace telemetry (liveworkspace/docs/specs/008-telemetry/telemetry.md). Anonymous: each row is the app it came
-- from, the three-field event and a server-stamped time. No identity, no IP, no owner column.
CREATE TABLE events (
  app TEXT NOT NULL,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  type TEXT,
  ts INTEGER NOT NULL
);

-- The dashboard's one query reads a 59-day range, for one app or for all of them, and the retention
-- sweep deletes by age: one index for each shape.
CREATE INDEX events_app_ts_idx ON events (app, ts);
CREATE INDEX events_ts_idx ON events (ts);
