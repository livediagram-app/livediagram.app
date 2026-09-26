-- Anonymous product telemetry, per docs/specs/017-telemetry/telemetry.md. Each row is a three-field
-- event (category / action / type) plus a server-stamped timestamp.
-- There is deliberately NO owner / IP / user-generated-content column:
-- rows are anonymous by construction, so the public /telemetry
-- dashboard can never surface anything identifying.
--
-- Lives in the existing DB (not a separate database) so self-hosters
-- who already provisioned it get telemetry + the dashboard with zero
-- extra setup. The ts index serves the fixed-window aggregate queries
-- (today / last 7 days / last 30 days).

CREATE TABLE events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  action   TEXT NOT NULL,
  type     TEXT,
  ts       INTEGER NOT NULL
);

CREATE INDEX events_ts_idx ON events (ts);
