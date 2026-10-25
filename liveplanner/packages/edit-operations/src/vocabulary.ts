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
