// Validation rules (docs/specs/029-sheets/data-validation.md, blueprint sheet-rules.md "Engine"): which rule covers a
// cell, whether a value is one it allows, and the line that says what it allows. Pure; the editor and the api share
// it, so the two never disagree.
import { formatRange } from '../address';
import { posRangeOf } from '../layout';
import { displayValue } from '../number-format';
import { isError, isArray, numberText, scalarOf, type Scalar, type Value } from '../formula/values';
import {
  cellKey,
  type CellInput,
  type DropdownOption,
  type SheetLayout,
  type ValidationRule,
} from '../sheet';
import type { Workbook } from '../engine/workbook';
import { DROPDOWN_OPTIONS_MAX } from '../limits';
import { firstRuleAt, ruleIndex } from './rule-index';

// A Date rule's dates: 31 December 1899 to 31 December 9999 (data-validation.md "What each rule allows").
export const DATE_SERIAL_MIN = 1;
export const DATE_SERIAL_MAX = 2_958_465;
// How many options a refusal line names before "and N more".
const LINE_OPTIONS_SHOWN = 5;

// One value a Dropdown from a Range offers: its value and how it is shown.
export type RangeOption = { value: Exclude<Scalar, null>; shown: string };
// The options a Dropdown from a Range offers now (the editor works them out; the api cannot, so it skips them).
export type RangeValues = (rule: ValidationRule) => readonly RangeOption[];

export type RuleCtx = { locale: string; layout: SheetLayout; rangeValues?: RangeValues };

const EMPTY: readonly ValidationRule[] = [];

// The validation rule covering a cell, or null.
export function validationRuleAt(layout: SheetLayout, r: number, c: number): ValidationRule | null {
  const list = layout.rules;
  if (!list?.length) return null;
  return firstRuleAt(ruleIndex(layout, list ?? EMPTY), r, c);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?:\/\/[^\s]+|[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?)$/i;

export function isEmail(text: string): boolean {
  return EMAIL_RE.test(text.trim());
}

export function isUrl(text: string): boolean {
  return URL_RE.test(text.trim());
}

// A checkbox cell's value: true or false, null when empty, undefined for anything else.
export function checkboxValue(v: Scalar | undefined): boolean | null | undefined {
  if (v === null || v === undefined || v === '') return null;
  return typeof v === 'boolean' ? v : undefined;
}

function scalarText(v: Exclude<Scalar, null>): string {
  if (typeof v === 'number') return numberText(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (isError(v)) return v.e;
  return v;
}

// A Dropdown's option matching a value, case aside (a number or true/false by its text).
export function optionFor(
  rule: ValidationRule,
  v: Exclude<Scalar, null> | string,
): DropdownOption | null {
  const text = scalarText(v).trim().toLowerCase();
  return rule.opts?.find((o) => o.v.trim().toLowerCase() === text) ?? null;
}

function inRange(n: number, a: number, b: number): boolean {
  return n >= Math.min(a, b) && n <= Math.max(a, b);
}

function numberMeets(op: string | undefined, n: number, a: number, b: number): boolean {
  switch (op) {
    case 'between':
      return inRange(n, a, b);
    case 'notBetween':
      return !inRange(n, a, b);
    case 'gt':
      return n > a;
    case 'gte':
      return n >= a;
    case 'lt':
      return n < a;
    case 'lte':
      return n <= a;
    case 'eq':
      return n === a;
    case 'neq':
      return n !== a;
    default:
      return true;
  }
}

function dateMeets(op: string | undefined, n: number, a: number, b: number): boolean {
  if (!(n >= DATE_SERIAL_MIN && n <= DATE_SERIAL_MAX + 1)) return false;
  const day = Math.floor(n);
  const da = Math.floor(a);
  switch (op) {
    case 'before':
      return day < da;
    case 'onOrBefore':
      return day <= da;
    case 'after':
      return day > da;
    case 'onOrAfter':
      return day >= da;
    case 'on':
      return day === da;
    case 'between':
      return inRange(day, da, Math.floor(b));
    case 'notBetween':
      return !inRange(day, da, Math.floor(b));
    default:
      return true;
  }
}

// Whether a rule allows a value (never empty: clearing is always allowed). `shown` is the value as its cell shows it,
// for Text rules over numbers; without it a number's own text is used.
export function scalarAllowed(
  rule: ValidationRule,
  v: Exclude<Scalar, null>,
  ctx: RuleCtx,
  shown?: string,
): boolean {
  if (isError(v)) return true;
  switch (rule.is) {
    case 'list':
      return optionFor(rule, v) !== null;
    case 'range': {
      // The api cannot work a range's values out: it lets them through, and the editor checks.
      if (!ctx.rangeValues) return true;
      const text = scalarText(v).toLowerCase();
      return ctx
        .rangeValues(rule)
        .some((o) =>
          typeof v === 'number' && typeof o.value === 'number'
            ? o.value === v
            : o.shown.toLowerCase() === text || scalarText(o.value).toLowerCase() === text,
        );
    }
    case 'check':
      return typeof v === 'boolean';
    case 'num':
      return (
        typeof v === 'number' &&
        numberMeets(rule.op, v, Number(rule.a ?? 0), Number(rule.b ?? rule.a ?? 0))
      );
    case 'date':
      return (
        typeof v === 'number' &&
        dateMeets(rule.op, v, Number(rule.a ?? 0), Number(rule.b ?? rule.a ?? 0))
      );
    case 'text': {
      if (typeof v === 'boolean') return false;
      const text = (shown ?? scalarText(v)).toLowerCase();
      const a = String(rule.a ?? '').toLowerCase();
      switch (rule.op) {
        case 'contains':
          return text.includes(a);
        case 'notContains':
          return !text.includes(a);
        case 'exactly':
          return text === a;
        case 'email':
          return isEmail(text);
        case 'url':
          return isUrl(text);
        default:
          return true;
      }
    }
  }
}

function inputScalar(input: CellInput): Exclude<Scalar, null> | null {
  if ('n' in input) return input.n;
  if ('s' in input) return input.s === '' ? null : input.s;
  if ('b' in input) return input.b;
  return null;
}

// Whether a rule allows an input as stored. A formula's value is checked where it is drawn, never here.
export function inputAllowed(rule: ValidationRule, input: CellInput, ctx: RuleCtx): boolean {
  if ('f' in input) return true;
  const v = inputScalar(input);
  return v === null || scalarAllowed(rule, v, ctx);
}

// Whether a cell's value (as worked out) breaks its rule: drawn with the invalid mark.
export function valueInvalid(
  rule: ValidationRule,
  value: Value,
  shown: string,
  ctx: RuleCtx,
): boolean {
  const v = isArray(value) ? scalarOf(value) : value;
  if (v === null || v === '') return false;
  return !scalarAllowed(rule, v, ctx, shown);
}

// What a typed input becomes under a rule: a dropdown's option in its own spelling; a checkbox's 1 or 0 as TRUE or
// FALSE (data-validation.md "Where values are checked").
export function inputForRule(rule: ValidationRule, input: CellInput): CellInput {
  if (rule.is === 'list' && ('s' in input || 'n' in input || 'b' in input)) {
    const o = optionFor(rule, inputScalar(input) ?? '');
    return o ? { s: o.v } : input;
  }
  if (rule.is === 'check' && 'n' in input && (input.n === 1 || input.n === 0))
    return { b: input.n === 1 };
  if (rule.is === 'check' && 's' in input) {
    const t = input.s.trim().toLowerCase();
    if (t === 'true' || t === 'false') return { b: t === 'true' };
  }
  return input;
}

function dateText(n: number, locale: string): string {
  return displayValue(n, { nf: 'date' }, locale).text;
}

const NUM_WORDS: Record<string, string> = {
  gt: 'greater than',
  gte: 'greater than or equal to',
  lt: 'less than',
  lte: 'less than or equal to',
  eq: 'equal to',
  neq: 'not equal to',
};
const DATE_WORDS: Record<string, string> = {
  before: 'before',
  onOrBefore: 'on or before',
  after: 'after',
  onOrAfter: 'on or after',
  on: 'on',
};

// The rule's own line: what it allows, said as a request (data-validation.md "What each rule allows").
export function ruleLine(rule: ValidationRule, ctx: Pick<RuleCtx, 'locale' | 'layout'>): string {
  switch (rule.is) {
    case 'list': {
      const opts = (rule.opts ?? []).map((o) => o.v);
      const named = opts.slice(0, LINE_OPTIONS_SHOWN).join(', ');
      const more = opts.length - LINE_OPTIONS_SHOWN;
      return `Choose one of the dropdown's options: ${named}${more > 0 ? `, and ${more} more` : ''}`;
    }
    case 'range': {
      const p = rule.src ? posRangeOf(ctx.layout, rule.src) : null;
      return p
        ? `Choose one of the values in ${formatRange(p)}`
        : 'Choose one of the listed values';
    }
    case 'check':
      return 'This cell is a checkbox: type TRUE or FALSE';
    case 'num': {
      const a = numberText(Number(rule.a ?? 0));
      const b = numberText(Number(rule.b ?? 0));
      if (rule.op === 'between') return `Enter a number between ${a} and ${b}`;
      if (rule.op === 'notBetween') return `Enter a number not between ${a} and ${b}`;
      return `Enter a number ${NUM_WORDS[rule.op ?? 'eq'] ?? 'equal to'} ${a}`;
    }
    case 'date': {
      const a = dateText(Number(rule.a ?? 0), ctx.locale);
      const b = dateText(Number(rule.b ?? 0), ctx.locale);
      if (rule.op === 'valid' || !rule.op) return 'Enter a date';
      if (rule.op === 'between') return `Enter a date between ${a} and ${b}`;
      if (rule.op === 'notBetween') return `Enter a date not between ${a} and ${b}`;
      return `Enter a date ${DATE_WORDS[rule.op] ?? 'on'} ${a}`;
    }
    case 'text': {
      const a = String(rule.a ?? '');
      if (rule.op === 'email') return 'Enter an email address';
      if (rule.op === 'url') return 'Enter a web address';
      if (rule.op === 'notContains') return `Enter text that does not contain “${a}”`;
      if (rule.op === 'exactly') return `Enter exactly “${a}”`;
      return `Enter text that contains “${a}”`;
    }
  }
}

// What a refused or invalid value says: the rule's Help Text, else its line.
export function ruleMessage(rule: ValidationRule, ctx: Pick<RuleCtx, 'locale' | 'layout'>): string {
  return rule.help?.trim() || ruleLine(rule, ctx);
}

// A Dropdown from a Range's options now: its cells' distinct shown values (empty aside), the first 500.
export function rangeOptions(wb: Workbook, sheetId: string, rule: ValidationRule): RangeOption[] {
  const sheet = wb.sheet(sheetId);
  const p = sheet && rule.src ? posRangeOf(sheet.layout, rule.src) : null;
  if (!sheet || !p) return [];
  const out: RangeOption[] = [];
  const seen = new Set<string>();
  for (let r = p.r1; r <= p.r2 && out.length < DROPDOWN_OPTIONS_MAX; r++)
    for (let c = p.c1; c <= p.c2 && out.length < DROPDOWN_OPTIONS_MAX; c++) {
      const value = wb.value(sheetId, r, c);
      if (value === null || value === '' || isError(value) || isArray(value)) continue;
      const format = sheet.cells.get(cellKey(sheet.layout.rows[r]!, sheet.layout.cols[c]!))?.format;
      const shown = displayValue(value, format, wb.locale).text;
      const key = shown.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ value, shown });
    }
  return out;
}
