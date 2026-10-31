// Formula values (docs/specs/026-plan/item-types.md "Formula fields", Values): what an expression works with. A
// number, text, true or false, blank (null), a date (a whole day), or a list (a field holding several). A problem on
// one card is a FormulaFail, thrown inside the evaluator and caught at its edge, so no caller ever sees a throw.

export interface FormulaDate {
  // Whole days since 1970-01-01.
  day: number;
}

export interface FormulaList {
  list: readonly FormulaValue[];
  // The field it came from, for the message when it is misused.
  field: string;
}

export type FormulaValue = number | string | boolean | null | FormulaDate | FormulaList;

export class FormulaFail extends Error {
  readonly error: string;
  constructor(error: string) {
    super(error);
    this.error = error;
  }
}

export const fail = (error: string): never => {
  throw new FormulaFail(error);
};

export const isDate = (v: FormulaValue): v is FormulaDate =>
  typeof v === 'object' && v !== null && 'day' in v;
export const isList = (v: FormulaValue): v is FormulaList =>
  typeof v === 'object' && v !== null && 'list' in v;

const DAY_MS = 86_400_000;

// A stored day ("2026-10-31") as a date; null for anything that is not one.
export function dateOf(text: string): FormulaDate | null {
  // Fixed shape, checked a character at a time: never a regex over stored text.
  if (text.length < 10 || text[4] !== '-' || text[7] !== '-') return null;
  for (const i of [0, 1, 2, 3, 5, 6, 8, 9]) {
    const c = text[i]!;
    if (c < '0' || c > '9') return null;
  }
  const y = Number(text.slice(0, 4));
  const m = Number(text.slice(5, 7));
  const d = Number(text.slice(8, 10));
  const ms = Date.UTC(y, m - 1, d);
  const back = new Date(ms);
  if (back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return { day: Math.round(ms / DAY_MS) };
}

// A date as a stored day: "2026-10-31".
export function dayText(date: FormulaDate): string {
  return new Date(date.day * DAY_MS).toISOString().slice(0, 10);
}

// What a value is called in a message.
export function kindName(v: FormulaValue): string {
  if (v === null) return 'blank';
  if (typeof v === 'number') return 'a number';
  if (typeof v === 'string') return 'text';
  if (typeof v === 'boolean') return 'true or false';
  return isDate(v) ? 'a date' : 'a list';
}

const listFail = (v: FormulaList): never => fail(`${v.field} holds several: count them with len()`);

// A value where one value is needed: a list is refused, naming its field.
export function single(v: FormulaValue): Exclude<FormulaValue, FormulaList> {
  return isList(v) ? listFail(v) : v;
}

// A value as a number: blank is 0.
export function toNumber(v: FormulaValue): number {
  const s = single(v);
  if (s === null) return 0;
  if (typeof s === 'number') return s;
  return fail(`Expected a number, got ${kindName(s)}`);
}

// Whether a value tests true: blank, 0, "" and an empty list are false.
export function truthy(v: FormulaValue): boolean {
  if (v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v !== '';
  return isList(v) ? v.list.length > 0 : true;
}

// A number as text: up to ten decimals, no grouping ("2500", "0.25").
const numberText = (n: number) => String(Math.round(n * 1e10) / 1e10);

// A value as text: blank is "", true and false "Yes" and "No", a date its day, a list its values joined by ", ".
export function toText(v: FormulaValue): string {
  if (v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return numberText(v);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (isDate(v)) return dayText(v);
  return v.list.map(toText).join(', ');
}

// A number a sum gave: an overflow is a problem, never Infinity on a card.
export function finite(n: number): number {
  return Number.isFinite(n) ? n : fail('The number is too large');
}
