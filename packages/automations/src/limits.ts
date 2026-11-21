// Automations: the numbers every app's rules share (liveworkspace/docs/specs/018-automations/automations.md "A rule",
// "Runs, limits and loops"). An app adds the limits of its own kinds beside these, never a second value for one here.

export const AUTOMATION_RULES_MAX = 50;
export const AUTOMATION_CONDITIONS_MAX = 10;
export const AUTOMATION_ACTIONS_MAX = 20;
export const AUTOMATION_CHAIN_MAX = 5;
export const AUTOMATION_RUNS_PER_DAY = 1000;
export const AUTOMATION_QUEUE_MAX = 500;
export const AUTOMATION_FAILURES_TO_PAUSE = 10;
export const AUTOMATION_LOG_MAX = 2000;
export const AUTOMATION_LOG_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const AUTOMATION_TEXT_MAX = 2000;
export const AUTOMATION_NAME_MAX = 60;
// An email's subject line.
export const AUTOMATION_SUBJECT_MAX = 200;
// The messages one rule sends through connections.
export const AUTOMATION_OUTGOING_MAX = 5;
// How late a missed time still runs.
export const AUTOMATION_LATE_MAX_MS = 24 * 60 * 60 * 1000;
// AI: the asks an item makes a day (UTC), the AI steps one rule holds and a summary's length.
export const AUTOMATION_AI_PER_DAY = 100;
export const AUTOMATION_AI_STEPS_MAX = 3;
export const AUTOMATION_AI_SUMMARY_MAX = 600;
// Wait: the Waits a rule holds, how long one holds (hours), and the runs an item holds waiting.
export const AUTOMATION_WAITS_MAX = 3;
export const AUTOMATION_WAIT_HOURS_MIN = 1;
export const AUTOMATION_WAIT_HOURS_MAX = 30 * 24;
export const AUTOMATION_WAITING_RUNS_MAX = 500;
// Send Email's typed-in addresses: the most one step holds, and the emails an item sends to such addresses a UTC
// day, over every rule, each address one. 50 is the owner's choice (2026-11-13): a team's own notices to a few
// outside people fit in it many times over, while an item can never be turned into a bulk mailer.
export const AUTOMATION_EMAIL_ADDRESSES_MAX = 10;
export const AUTOMATION_ADDRESS_EMAILS_PER_DAY = 50;
