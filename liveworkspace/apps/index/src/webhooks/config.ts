// Webhooks' numbers (liveworkspace/docs/specs/004-index/webhooks.md); the shared limits are @liveworkspace/index-client's.

// An event recorded longer ago than this is never queued: a merge, a migration or a resent push replaying history.
export const WEBHOOK_FRESH_MS = 60 * 60 * 1000;
// A delivery's answer must come within this.
export const DELIVERY_TIMEOUT_MS = 10_000;
// After each failed try, the wait before the next: seven tries in about 21 hours, then given up.
export const RETRY_DELAYS_MS: readonly number[] = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
  12 * 60 * 60_000,
];
// One alarm sends at most this many deliveries, this many webhooks at once; more due, it runs again at once.
export const DISPATCH_BATCH = 50;
export const DISPATCH_CONCURRENCY = 6;
// Deliveries given up in a row before a webhook pauses itself.
export const FAILING_PAUSE_AFTER = 20;
// When accounts can't say whether a team webhook's creator is still an admin: held, not counted as a try.
export const ACCESS_RETRY_MS = 60_000;
// The one dispatcher's name.
export const DISPATCHER_NAME = 'deliveries';
