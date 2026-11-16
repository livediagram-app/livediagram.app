// The Worker's settings. They live apart from src/index.ts because a Worker's entry module may only export handlers.

export const DAY_MS = 86_400_000;
// Checks, days and closed incidents are kept this long (liveworkspace/docs/specs/009-status/status.md).
export const RETENTION_DAYS = 90;
export const RETENTION_MS = RETENTION_DAYS * DAY_MS;

// A Worker waits on at most six answers at a time; more would queue inside fetch and be timed while queued.
export const PROBE_CONCURRENCY = 6;

// The data changes once an hour, so a couple of minutes stale is fine, and a crowd on the page is answered from the
// edge cache rather than D1.
export const CACHE_SECONDS = 120;

// The Cron Trigger that runs the signed-in Explorer check alone, every 5 minutes but minute 7, where the hourly run
// makes it (liveworkspace/docs/specs/009-status/status.md "The signed-in check"). Any other trigger is the hourly run.
export const SIGNED_IN_CRON = '2,12,17,22,27,32,37,42,47,52,57 * * * *';
// Each step of the guest hand-off gives up after this long.
export const HANDOFF_TIMEOUT_MS = 5_000;
// How far back the check before this one may be and still count as "in a row": one missed run's gap.
export const SIGNED_IN_LOOKBACK_MS = 15 * 60_000;

// Who is asking, for anyone reading their logs.
export const USER_AGENT = 'liveworkspace-status/1 (+https://www.liveworkspace.app/status)';
