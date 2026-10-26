// The Worker's settings. They live apart from src/index.ts because a Worker's entry module may only
// export handlers: the runtime refuses to start on any other export there.

import { INDEX_API_PATH } from '@liveworkspace/index-client';

// The path of liveworkspace.app this Worker owns.
export const API_PATH = INDEX_API_PATH;

// The largest body any route takes: one tab's comment threads and actions are the biggest.
export const MAX_BODY_BYTES = 512 * 1024;

// Opaque ids from callers (folders, tabs, elements): bounded.
export const ID_MAX = 128;
// An app-defined creation intent, and a placement default's key.
export const INTENT_MAX = 100;
export const DEFAULT_KEY_MAX = 100;

// How long a browser and the edge may keep the public keys. Short, so a rotated key is seen soon; an app's
// verifier refetches on an unknown kid anyway.
export const JWKS_MAX_AGE_S = 300;

// The daily run: how many expired Trash items it purges, and how many tombstones it retries, per run.
// Whatever is left waits for the next day.
export const SWEEP_ITEMS_MAX = 500;
export const TOMBSTONES_PER_RUN = 200;
// How many empty, stale items the daily empty clean-up moves to the Trash per run, oldest change first.
export const EMPTY_SWEEP_MAX = 1000;
// Right after a person's own purge, how many app calls are made at once (the rest wait for the run).
export const PURGE_NOW_MAX = 25;
export const APP_CALL_CONCURRENCY = 6;
// How long one call to an app may take.
export const APP_CALL_TIMEOUT_MS = 10_000;

// The migration's handoff (migration-handoff.ts): the largest body it takes, a browser's Local only part with its
// images' references and changesets; how long the app's migration door may take to write it; and how many a
// person may hand off a minute (MIGRATION_LIMITER's own setting, wrangler.toml).
export const HANDOFF_MAX_BYTES = 32 * 1024 * 1024;
export const HANDOFF_APP_TIMEOUT_MS = 30_000;

// How many Inbox rows of each kind one answer holds.
export const INBOX_LIMIT_DEFAULT = 100;

// A per-isolate memory of recent opens, so a burst of opens doesn't even reach D1. Bounded.
export const OPEN_MEMORY_MAX = 5_000;
// A per-isolate memory of checked share passwords (PBKDF2 is slow on purpose). Bounded.
export const PASSWORD_MEMORY_MAX = 1_000;
// How long a visitor refused for guessing a share password too often is told to wait (Retry-After): the period of
// SHARE_GUESS_VISITOR_LIMITER and SHARE_GUESS_ITEM_LIMITER (wrangler.toml), whose own limits are 10 and 30 a minute.
export const SHARE_GUESS_RETRY_AFTER_S = 60;
