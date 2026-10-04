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

// The operations this build applies; the others parse and are refused until they land.
export const APPLIED_OPERATION_NAMES: readonly EditOperationName[] = ['add', 'set', 'rm'];

// The members each operation's JSON form takes, `op` included.
export const OPERATION_MEMBERS: Readonly<Record<EditOperationName, readonly string[]>> = {
  add: ['op', 'kind', 'id', 'fields', 'place', 'element'],
  set: ['op', 'target', 'fields', 'all'],
  rm: ['op', 'target', 'all', 'keepArrows'],
  move: ['op', 'target', 'place', 'by', 'all'],
  connect: ['op', 'from', 'to', 'id', 'fields', 'again'],
  rewire: ['op', 'target', 'from', 'to'],
  insert: ['op', 'kind', 'id', 'fields', 'between'],
  wrap: ['op', 'targets', 'in', 'id', 'fields', 'tidy', 'absorb', 'makeRoom'],
  unwrap: ['op', 'target'],
  order: ['op', 'target', 'to', 'above', 'below'],
  layout: ['op', 'target', 'style', 'direction'],
  test: ['op', 'target', 'fields'],
};

// Where `add` and `move` put an element (docs/specs/024-agents/edit-operations.md "Placement").
export const PLACEMENT_RELATIONS = [
  'right-of',
  'left-of',
  'above',
  'below',
  'after',
  'inside',
  'align',
] as const;
export type PlacementRelation = (typeof PLACEMENT_RELATIONS)[number];

// The `key:value` selector keys (blueprint "Selectors").
export const SELECTOR_KEYS = [
  'type',
  'shape',
  'in',
  'from',
  'to',
  'downstream',
  'upstream',
] as const;
export type SelectorKey = (typeof SELECTOR_KEYS)[number];

// The line form's flag words and the JSON members they set.
export const FLAG_MEMBERS = {
  all: 'all',
  'keep-arrows': 'keepArrows',
  again: 'again',
  tidy: 'tidy',
  absorb: 'absorb',
  'make-room': 'makeRoom',
} as const;
export type FlagWord = keyof typeof FLAG_MEMBERS;

// Words that always read as keywords, never as refs (EO10).
export const RESERVED_WORDS: ReadonlySet<string> = new Set([
  'selected',
  'all',
  'again',
  'tidy',
  'absorb',
  'make-room',
  'keep-arrows',
  'between',
  'in',
  'frame',
  'lane',
  'front',
  'back',
]);

export const LAYOUT_STYLES = ['flow', 'tree', 'mindmap'] as const;
export const LAYOUT_DIRECTIONS = ['down', 'right'] as const;
export const ORDER_ENDS = ['front', 'back'] as const;
export const WRAP_CONTAINERS = ['frame', 'lane'] as const;

// Keys no object built from input may carry.
export const PROTOTYPE_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

// The layout engine's rank gap (EO23); larger reads as a separate drawing.
export { LAYER_GAP as PLACEMENT_GAP } from '@livediagram/document';
export const PLACEMENT_GAP_MAX = 2000;
// Below it boxes read as touching (EO32).
export const INSERT_MIN_GAP = 16;
// A 4,000-character code value with escapes and its other fields fits (EO3).
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
