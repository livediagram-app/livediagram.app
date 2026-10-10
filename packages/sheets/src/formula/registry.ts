// Every function the engine knows (docs/specs/029-sheets/formulas.md "Functions"); any other name is #NAME?. A
// null-prototype object, looked up by upper-cased own keys only, so a formula can never reach Object.prototype.
import type { FnDef } from './fn';
import { ARRAY_FUNCTIONS } from './functions/array';
import { CARD_FUNCTIONS } from './functions/cards';
import { DATE_FUNCTIONS } from './functions/date';
import { FINANCE_FUNCTIONS } from './functions/finance';
import { INFO_FUNCTIONS, LOGIC_FUNCTIONS } from './functions/logic';
import { LOOKUP_FUNCTIONS } from './functions/lookup';
import { MATH_FUNCTIONS } from './functions/math';
import { STATS_FUNCTIONS } from './functions/stats';
import { TEXT_FUNCTIONS } from './functions/text';

export type FunctionFamily =
  | 'Maths'
  | 'Statistics'
  | 'Logic'
  | 'Information'
  | 'Lookup'
  | 'Text'
  | 'Date and time'
  | 'Arrays'
  | 'Finance'
  | 'Plan cards';

export const FUNCTION_FAMILIES: readonly [FunctionFamily, Record<string, FnDef>][] = [
  ['Maths', MATH_FUNCTIONS],
  ['Statistics', STATS_FUNCTIONS],
  ['Logic', LOGIC_FUNCTIONS],
  ['Information', INFO_FUNCTIONS],
  ['Lookup', LOOKUP_FUNCTIONS],
  ['Text', TEXT_FUNCTIONS],
  ['Date and time', DATE_FUNCTIONS],
  ['Arrays', ARRAY_FUNCTIONS],
  ['Finance', FINANCE_FUNCTIONS],
  ['Plan cards', CARD_FUNCTIONS],
];

export const FUNCTIONS: Readonly<Record<string, FnDef>> = Object.freeze(
  Object.assign(
    Object.create(null) as Record<string, FnDef>,
    ...FUNCTION_FAMILIES.map(([, fns]) => fns),
  ),
);

export const FUNCTION_NAMES: readonly string[] = Object.freeze(
  FUNCTION_FAMILIES.flatMap(([, fns]) => Object.keys(fns)),
);

export const CARD_FUNCTION_NAMES: ReadonlySet<string> = new Set(Object.keys(CARD_FUNCTIONS));

export function familyOf(name: string): FunctionFamily | undefined {
  return FUNCTION_FAMILIES.find(([, fns]) => Object.prototype.hasOwnProperty.call(fns, name))?.[0];
}

export function isKnownFunction(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(FUNCTIONS, name.toUpperCase());
}
