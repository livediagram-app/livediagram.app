// Formula fields' limits (docs/specs/026-plan/item-types.md "Formula fields", Safety): what a formula may hold and
// how much working one out may cost, so a hostile or careless formula can never hang a board.

// The longest formula, in characters, as written with names or as stored with ids.
export const FORMULA_MAX = 1000;
// The deepest nesting of brackets, function calls and leading signs.
export const FORMULA_DEPTH_MAX = 32;
// The most steps working a formula out on one card may take, other formulas it reads included.
export const FORMULA_STEPS_MAX = 10_000;
// round()'s places, 0 to this.
export const FORMULA_ROUND_PLACES_MAX = 10;
// Compiled formulas kept, by stored text, before the oldest is dropped.
export const FORMULA_CACHE_MAX = 512;

// How a Formula's value reads, sorts and exports, in the order the editor offers them.
export const FORMULA_RESULTS = [
  'number',
  'currency',
  'percent',
  // Whole minutes, read as a Duration field reads ("2h 30m"; docs/specs/026-plan/item-types.md "Duration").
  'duration',
  'text',
  'date',
  'checkbox',
] as const;
export type FormulaResult = (typeof FORMULA_RESULTS)[number];
export const FORMULA_RESULT_DEFAULT: FormulaResult = 'number';

export const FORMULA_RESULT_LABELS: Readonly<Record<FormulaResult, string>> = {
  number: 'Number',
  currency: 'Currency',
  percent: 'Percent',
  duration: 'Duration',
  text: 'Text',
  date: 'Date',
  checkbox: 'Checkbox',
};

export const isFormulaResult = (v: unknown): v is FormulaResult =>
  (FORMULA_RESULTS as readonly unknown[]).includes(v);
