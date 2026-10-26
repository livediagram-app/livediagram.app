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

// Who is asking, for anyone reading their logs.
export const USER_AGENT = 'liveworkspace-status/1 (+https://www.liveworkspace.app/status)';
