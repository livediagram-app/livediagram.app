// Largest Image (subscription.md "Tiers and limits"), apart from the limits table in tiers.ts: a page that only stops
// a file too large to take (an upload's ceiling) imports this alone, so its first load carries none of the table.
// tiers.ts reads its imageMaxBytes from here, so the number is still written once.

const MB = 1000 * 1000;

/** The largest single image, the same on every tier (owner, 2026-11-23: no point gating Pro on it). */
export const IMAGE_MAX_BYTES = 25 * MB;

/** The largest image any tier takes: every tier's. */
export const IMAGE_MAX_BYTES_ANY_TIER = IMAGE_MAX_BYTES;
