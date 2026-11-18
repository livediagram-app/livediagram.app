// Guests from before accounts stamped them (liveworkspace/docs/specs/003-accounts/accounts.md "Guests who never come
// back", "Guests from before the stamp"): the index's daily cron sends accounts its guest owners, and accounts dates
// each one it has no `guest_seen` row for. What the two sides share.

// The origin the index calls accounts at for it, over its ACCOUNTS service binding. `.internal` is reserved for
// private use and is no zone of ours, so no public request can arrive on it: accounts refuses the route on any other
// host, which keeps it the binding's alone.
export const ACCOUNTS_BINDING_ORIGIN = 'https://accounts.internal';

// The route, with the key the index and accounts share (accounts' INDEX_MERGE_KEY, the index's MERGE_KEY).
export const GUEST_SEEN_BACKFILL_PATH = '/api/account/index/guests-seen';

// Guest ids a call, and so a daily run: at most this many.
export const GUEST_SEEN_BACKFILL_PAGE = 500;

/** The body: `{ ids }`. The answer: `{ added }`, how many rows accounts wrote. */
export type GuestSeenBackfillAnswer = { added: number };
