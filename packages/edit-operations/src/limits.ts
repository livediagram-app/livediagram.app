// The engine's bounds, the same in every product (docs/specs/024-agents/blueprints/edit-operations.md
// in each product). A product's `vocabulary.ts` re-exports them beside its own operations and words.

// Keys no object built from input may carry.
export const PROTOTYPE_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

// A whole element in the JSON form, a 4,000-character code value with escapes included, fits (EO3).
export const EDIT_LINE_MAX_CHARS = 16_384;
// A readable candidate list; the rest counted (EO45).
export const REJECTION_CANDIDATES_MAX = 10;

// Enough to fix a batch of typos in one round (EO7).
export const EDIT_MAX_ERRORS = 10;
// The few nearest elements worth trying, within typos and short slips (EO45).
export const NEAREST_CANDIDATES_MAX = 5;
export const NEAREST_MAX_DISTANCE = 3;
// "did you mean" offers a name only this close (EO45).
export const DID_YOU_MEAN_MAX_DISTANCE = 2;
// Where result and rejection lines cut a string (EO43, the views' cuts).
export const LABEL_CUT_CHARS = 60;
export const VALUE_CUT_CHARS = 48;
