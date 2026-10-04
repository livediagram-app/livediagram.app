// The closed vocabulary and the engine's limits (docs/specs/024-agents/edit-operations.md "The
// vocabulary", blueprint "Constants and configuration").

export const EDIT_OPERATION_NAMES = [
  'add',
  'set',
  'rm',
  'move',
  'connect',
  'rewire',
  'insert',
  'wrap',
  'unwrap',
  'order',
  'layout',
  'test',
] as const;
export type EditOperationName = (typeof EDIT_OPERATION_NAMES)[number];

// The operations this build applies; the rest of the vocabulary arrives with the full engine.
export const APPLIED_OPERATION_NAMES = [
  'add',
  'set',
  'rm',
] as const satisfies readonly EditOperationName[];
export type AppliedOperationName = (typeof APPLIED_OPERATION_NAMES)[number];

// The members each applied operation's JSON form takes, `op` included.
export const OPERATION_MEMBERS: Readonly<Record<AppliedOperationName, readonly string[]>> = {
  add: ['op', 'element'],
  set: ['op', 'target', 'fields', 'all'],
  rm: ['op', 'target', 'all', 'keepArrows'],
};

// Keys no object built from input may carry.
export const PROTOTYPE_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

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
