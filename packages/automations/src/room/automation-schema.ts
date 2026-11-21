// An item's Automations in its own SQLite (liveworkspace/docs/specs/018-automations/automations.md "Where rules live
// and run"; blueprint engine.md "Tables"). Its rules (each the rule's JSON, its on or off and its place in the list
// mirrored in columns, and its failures in a row), the triggers waiting for the alarm, and the Audit Trail, whose id
// is the run's (a hash of the trigger and the rule) so a second insert of one run is ignored: a rule never runs
// twice for one trigger. An item never given a rule has empty tables and does no rule work on any save.
//
// The queue's id is the rowid, in insert order (no AUTOINCREMENT: its sqlite_sequence table would outlive a purge in
// node's test SQLite, and a reused id after the queue empties orders nothing wrongly). Every statement is IF NOT
// EXISTS: a step runs again harmlessly.
//
// Each app appends AUTOMATION_SCHEMA_STEPS, in order, to its own schema's steps. A step, once shipped, is never
// edited: an item that already ran it would never see the change. The first app registers each at the version it
// shipped it under, by name.
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

// When each time-trigger rule that is on next runs (one row per rule, none for another trigger or a rule that is
// off), indexed so the room's alarm asks MIN(next_at) in one read; and each rule's place in a step that takes turns.
// Asks before it adds the column, so the step runs again harmlessly.
export const AUTOMATION_SCHEDULE_SCHEMA = `
CREATE TABLE IF NOT EXISTS automation_schedule (
  rule_id TEXT    PRIMARY KEY,
  next_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS automation_schedule_next ON automation_schedule (next_at);
`;

export type SchemaExec = (query: string) => { toArray(): Record<string, unknown>[] };

export function automationsScheduleStep(exec: SchemaExec): void {
  exec(AUTOMATION_SCHEDULE_SCHEMA);
  const columns = exec('PRAGMA table_info(automation_rules)').toArray();
  if (!columns.some((c) => c.name === 'turn'))
    exec('ALTER TABLE automation_rules ADD COLUMN turn INTEGER NOT NULL DEFAULT 0');
}

// Each Incoming Webhook rule's secret, as its SHA-256 hash and last 4 characters (never the secret), when it was
// made and last used, and its rate limit's minute (when the minute started and the calls in it). A table of its
// own, so no rule body (every list, copy and file) holds the hash.
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

// The runs a Wait holds, each under its run's id, with the rule, when it goes on, and the resume event the wake
// queues then; indexed so the alarm asks MIN(at).
export const AUTOMATION_WAITING_SCHEMA = `
CREATE TABLE IF NOT EXISTS automation_waiting (
  id      TEXT    PRIMARY KEY,
  rule_id TEXT    NOT NULL,
  at      INTEGER NOT NULL,
  event   TEXT    NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS automation_waiting_at ON automation_waiting (at);
`;

// Describe a Rule's asks, one row each (`retry` 1 for a draft's second ask), so drafts share the day's AI steps
// with the rules' and an item drafts at most 20 rules a day. Rows past two days are deleted on each insert: at most
// a couple of days' asks are kept.
export const AUTOMATION_AI_DRAFTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS automation_ai_drafts (
  at    INTEGER NOT NULL,
  retry INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS automation_ai_drafts_at ON automation_ai_drafts (at);
`;

// The event ids a wake has queued for a time rule that runs once per thing it finds, apart from the Audit Trail,
// whose trim would otherwise let one that still matches run again. Indexed by rule for the wake's one read, and by
// when for the trim (automation-fired.ts).
export const AUTOMATION_FIRED_SCHEMA = `
CREATE TABLE IF NOT EXISTS automation_fired (
  id      TEXT    PRIMARY KEY,
  rule_id TEXT    NOT NULL,
  at      INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS automation_fired_rule ON automation_fired (rule_id);
CREATE INDEX IF NOT EXISTS automation_fired_at ON automation_fired (at);
`;

// Send Email's typed-in addresses. `automation_email_addresses` holds each address the item's rules have emailed,
// with the unguessable token its unsubscribe link carries, and when it unsubscribed (null: it has not); at most 50
// new ones a day, the day's limit. `automation_email_days` counts the day's emails to such addresses (UTC midnight,
// ms), one row a day, rows before yesterday deleted as a day's first email is counted (automation-addresses.ts).
export const AUTOMATION_ADDRESSES_SCHEMA = `
CREATE TABLE IF NOT EXISTS automation_email_addresses (
  address         TEXT    PRIMARY KEY,
  token           TEXT    NOT NULL UNIQUE,
  unsubscribed_at INTEGER
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS automation_email_days (
  day  INTEGER PRIMARY KEY,
  sent INTEGER NOT NULL
);
`;

// Two small counts. `automation_hook_seen`: each signature an Incoming Webhook rule took in the last 10 minutes, so
// a replayed call is refused; rows past the window go on each take (by `at`), and a rule keeps its newest 600 (by
// `rule_id, at`). `automation_ai_days`: the AI calls asked each UTC day (midnight, ms), one row a day, bumped as each
// call is asked, rows before yesterday deleted on a day's first ask: the day's AI count reads one row, never the
// Audit Trail's bodies (automation-ai.ts aiToday).
export const AUTOMATION_COUNTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS automation_hook_seen (
  rule_id   TEXT    NOT NULL,
  signature TEXT    NOT NULL,
  at        INTEGER NOT NULL,
  PRIMARY KEY (rule_id, signature)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS automation_hook_seen_at ON automation_hook_seen (at);
CREATE INDEX IF NOT EXISTS automation_hook_seen_rule ON automation_hook_seen (rule_id, at);
CREATE TABLE IF NOT EXISTS automation_ai_days (
  day  INTEGER PRIMARY KEY,
  asks INTEGER NOT NULL
);
`;

// A wake that failed as a whole (liveworkspace/docs/specs/018-automations/automations.md "Runs, limits and loops"):
// one row while wakes keep failing, with how many in a row and when the next may try (automation-wake.ts). In SQLite,
// so a room that restarts keeps both: a deterministic failure backs off and gives up, never retries every minute.
export const AUTOMATION_WAKE_SCHEMA = `
CREATE TABLE IF NOT EXISTS automation_wake (
  id       INTEGER PRIMARY KEY CHECK (id = 1),
  failures INTEGER NOT NULL,
  retry_at INTEGER NOT NULL
);
`;

// A schema step as an app's own list of steps takes one: SQL to run, or a function that asks before it changes.
export type AutomationSchemaStep = {
  name:
    | 'rules'
    | 'schedule'
    | 'hooks'
    | 'waiting'
    | 'ai_drafts'
    | 'fired'
    | 'addresses'
    | 'counts'
    | 'wake';
  run: string | ((exec: SchemaExec) => void);
};

// Every table, in the order they shipped. A later change adds a step here, never edits one.
export const AUTOMATION_SCHEMA_STEPS: readonly AutomationSchemaStep[] = [
  { name: 'rules', run: AUTOMATIONS_SCHEMA },
  { name: 'schedule', run: automationsScheduleStep },
  { name: 'hooks', run: AUTOMATION_HOOKS_SCHEMA },
  { name: 'waiting', run: AUTOMATION_WAITING_SCHEMA },
  { name: 'ai_drafts', run: AUTOMATION_AI_DRAFTS_SCHEMA },
  { name: 'fired', run: AUTOMATION_FIRED_SCHEMA },
  { name: 'addresses', run: AUTOMATION_ADDRESSES_SCHEMA },
  { name: 'counts', run: AUTOMATION_COUNTS_SCHEMA },
  { name: 'wake', run: AUTOMATION_WAKE_SCHEMA },
];

/** The step of that name, for an app that registered the steps one by one as they shipped. */
export function automationSchemaStep(
  name: AutomationSchemaStep['name'],
): AutomationSchemaStep['run'] {
  return AUTOMATION_SCHEMA_STEPS.find((s) => s.name === name)!.run;
}
