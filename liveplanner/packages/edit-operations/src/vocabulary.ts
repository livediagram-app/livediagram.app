// The closed vocabulary and the engine's limits (docs/specs/024-agents/edit-operations.md "The
// vocabulary", blueprint "Constants and configuration").

// A Plan tab's elements are few and whole (a board, a Sheet, a Dashboard's views and charts), so the vocabulary is
// the four operations that change them: put one on, change its fields, take it off, and check it first.
export const EDIT_OPERATION_NAMES = ['add', 'set', 'rm', 'test'] as const;
export type EditOperationName = (typeof EDIT_OPERATION_NAMES)[number];

// The members each operation's JSON form takes, `op` included.
export const OPERATION_MEMBERS: Readonly<Record<EditOperationName, readonly string[]>> = {
  add: ['op', 'element'],
  set: ['op', 'target', 'fields', 'all'],
  rm: ['op', 'target', 'all'],
  test: ['op', 'target', 'fields'],
};

// The `key:value` selector keys (blueprint "Selectors"); `label~` is read on its own.
export const SELECTOR_KEYS = ['type'] as const;

// The line form's flag words and the JSON members they set.
export const FLAG_MEMBERS = { all: 'all' } as const;
export type FlagWord = keyof typeof FLAG_MEMBERS;

// Words that always read as keywords, never as refs (EO10).
export const RESERVED_WORDS: ReadonlySet<string> = new Set(['selected', 'all']);

// Keys no object built from input may carry.
export const PROTOTYPE_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

// A whole element in the JSON form, a board's columns or a chart's settings included, fits (EO3).
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
