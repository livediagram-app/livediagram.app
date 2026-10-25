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
  'front',
  'back',
]);

export const LAYOUT_STYLES = ['flow', 'tree', 'mindmap'] as const;
export const LAYOUT_DIRECTIONS = ['down', 'right'] as const;
export const ORDER_ENDS = ['front', 'back'] as const;
export const WRAP_CONTAINERS = ['frame'] as const;

// The layout engine's rank gap (EO23); larger reads as a separate drawing.
export { LAYER_GAP as PLACEMENT_GAP } from '@livedesign/design';
export const PLACEMENT_GAP_MAX = 2000;
// Below it boxes read as touching (EO32).
export const INSERT_MIN_GAP = 16;

// The engine's bounds, the same in every product.
export {
  PROTOTYPE_KEYS,
  EDIT_LINE_MAX_CHARS,
  REJECTION_CANDIDATES_MAX,
  EDIT_MAX_ERRORS,
  NEAREST_CANDIDATES_MAX,
  NEAREST_MAX_DISTANCE,
  DID_YOU_MEAN_MAX_DISTANCE,
  LABEL_CUT_CHARS,
  VALUE_CUT_CHARS,
} from '@liveworkspace/edit-operations/limits';
