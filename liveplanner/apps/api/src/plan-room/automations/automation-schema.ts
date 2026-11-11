// A plan's Automations in its own SQLite (docs/specs/026-plan/automations.md; blueprint automations.md "Storage"): the
// plan schema's step V18 (plan-schema.ts). Its rules (each the rule's JSON, its on or off and its place in the list
// mirrored in columns, and its failures in a row), the triggers waiting for the alarm, and the Run Log, whose id is
// the run's (a hash of the trigger and the rule) so a second insert of one run is ignored: a rule never runs twice
// for one trigger. A plan never given a rule has three empty tables and does no rule work on any save.
//
// The queue's id is the rowid, in insert order (no AUTOINCREMENT: its sqlite_sequence table would outlive a purge in
// node's test SQLite, and a reused id after the queue empties orders nothing wrongly). Every statement is IF NOT
// EXISTS: the step runs again harmlessly.
export const AUTOMATIONS_SCHEMA = `
CREATE TABLE IF NOT EXISTS automation_rules (
  id       TEXT    PRIMARY KEY,
  body     TEXT    NOT NULL,
  enabled  INTEGER NOT NULL,
  position INTEGER NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS automation_queue (
  id    INTEGER PRIMARY KEY,
  event TEXT    NOT NULL,
  at    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS automation_runs (
  id      TEXT    PRIMARY KEY,
  rule_id TEXT    NOT NULL,
  at      INTEGER NOT NULL,
  result  TEXT    NOT NULL,
  body    TEXT    NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS automation_runs_at ON automation_runs (at);
CREATE INDEX IF NOT EXISTS automation_runs_rule ON automation_runs (rule_id, at);
CREATE INDEX IF NOT EXISTS automation_runs_result ON automation_runs (result, at);
`;
