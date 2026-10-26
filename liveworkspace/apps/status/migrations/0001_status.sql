-- liveworkspace status history (liveworkspace/docs/specs/009-status/status.md). Public facts about public addresses: no people, no
-- response bodies.

-- Every service's check, once an hour, for 90 days (35 rows an hour). The key leads with the time, so today's checks
-- (the rollup) and the oldest ones (the prune) are both one range of it, with no index of its own to write.
CREATE TABLE checks (
  at INTEGER NOT NULL,
  service TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('up', 'slow', 'down')),
  code INTEGER,
  ms INTEGER NOT NULL,
  error TEXT,
  PRIMARY KEY (at, service)
) WITHOUT ROWID;

-- One row per service per UTC day, worked out again from that day's checks on each run: the page's bars.
CREATE TABLE daily (
  day TEXT NOT NULL,
  service TEXT NOT NULL,
  checks INTEGER NOT NULL,
  up INTEGER NOT NULL,
  slow INTEGER NOT NULL,
  down INTEGER NOT NULL,
  p50 INTEGER,
  p95 INTEGER,
  worst TEXT NOT NULL CHECK (worst IN ('up', 'slow', 'down')),
  PRIMARY KEY (day, service)
) WITHOUT ROWID;

-- A spell of consecutive checks that weren't up: from its first, to the first up check after it (null while open).
CREATE TABLE incidents (
  id INTEGER PRIMARY KEY,
  service TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  ended_at INTEGER,
  worst TEXT NOT NULL CHECK (worst IN ('slow', 'down')),
  checks INTEGER NOT NULL,
  error TEXT
);

-- Each run reads the open ones; the snapshot and the prune read by when they ended.
CREATE INDEX incidents_open_idx ON incidents (service) WHERE ended_at IS NULL;
CREATE INDEX incidents_ended_idx ON incidents (ended_at);

-- The read API's two answers, built once a run, so a read is one row: `latest` and `history`.
CREATE TABLE snapshots (
  key TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  body TEXT NOT NULL
) WITHOUT ROWID;
