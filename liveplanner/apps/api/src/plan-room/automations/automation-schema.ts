// A plan's Automations in its own SQLite (docs/specs/026-plan/automations.md; blueprint automations.md "Storage"): the
// plan schema's step V18 (plan-schema.ts). Its rules (each the rule's JSON, its on or off and its place in the list
// mirrored in columns, and its failures in a row), the triggers waiting for the alarm, and the Audit Trail, whose id is
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

// Phase 2 (#712), the plan schema's step V19: when each time-trigger rule that is on next runs (one row per rule,
// none for a card trigger or a rule that is off), indexed so the room's alarm asks MIN(next_at) in one read; and each
// rule's place in Assign in Turn. Asks before it adds the column, so the step runs again harmlessly.
export const AUTOMATION_SCHEDULE_SCHEMA = `
CREATE TABLE IF NOT EXISTS automation_schedule (
  rule_id TEXT    PRIMARY KEY,
  next_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS automation_schedule_next ON automation_schedule (next_at);
`;

export function automationsV19(
  exec: (query: string) => { toArray(): Record<string, unknown>[] },
): void {
  exec(AUTOMATION_SCHEDULE_SCHEMA);
  const columns = exec('PRAGMA table_info(automation_rules)').toArray();
  if (!columns.some((c) => c.name === 'turn'))
    exec('ALTER TABLE automation_rules ADD COLUMN turn INTEGER NOT NULL DEFAULT 0');
}

// Phase 3 (#713), the plan schema's step V20: each Incoming Webhook rule's secret, as its SHA-256 hash and last 4
// characters (never the secret), when it was made and last used, and its rate limit's minute (when the minute
// started and the calls in it). A table of its own, so no rule body (every list, copy and file) holds the hash.
export const AUTOMATION_HOOKS_SCHEMA = `
CREATE TABLE IF NOT EXISTS automation_hooks (
  rule_id      TEXT    PRIMARY KEY,
  hash         TEXT    NOT NULL,
  last4        TEXT    NOT NULL,
  made_at      INTEGER NOT NULL,
  used_at      INTEGER,
  window_at    INTEGER NOT NULL DEFAULT 0,
  window_calls INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;
`;

// The plan schema's step V22: the runs a Wait holds (docs/specs/026-plan/automations.md "Wait"), each under its run's
// id, with the rule, when it goes on, and the resume event the wake queues then; indexed so the alarm asks MIN(at).
export const AUTOMATION_WAITING_SCHEMA = `
CREATE TABLE IF NOT EXISTS automation_waiting (
  id      TEXT    PRIMARY KEY,
  rule_id TEXT    NOT NULL,
  at      INTEGER NOT NULL,
  event   TEXT    NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS automation_waiting_at ON automation_waiting (at);
`;

// The plan schema's step V24: Describe a Rule's asks (docs/specs/026-plan/automations.md "Describe a Rule"), one row
// each (`retry` 1 for a draft's second ask), so drafts share the day's AI steps with the rules' and a plan drafts at
// most 20 rules a day. Rows past two days are deleted on each insert: at most a couple of days' asks are kept.
export const AUTOMATION_AI_DRAFTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS automation_ai_drafts (
  at    INTEGER NOT NULL,
  retry INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS automation_ai_drafts_at ON automation_ai_drafts (at);
`;
