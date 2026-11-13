// Automations: the reading primitives the rule check is built from (docs/specs/026-plan/automations.md "A rule",
// "Limits"). Each answers the value read, or throws a `Refused` with the `path` of the part at fault, which
// readRuleBody (validate.ts) catches at the top of its walk. Pure.

import { isDay } from '../repeat-dates';
import type { AutomationDay } from './types';
import { unknownValueIn, type ValuePlace } from './values';
import { clockMinutes } from './schedule';

export type RuleRefusal = {
  error:
    | 'automation_invalid'
    | 'automation_value_unknown'
    | 'automation_condition_unsupported'
    | 'automation_step_unsupported';
  path: string;
  message: string;
};

// The most ids one list in a rule names (columns, types, fields, people).
export const AUTOMATION_LIST_MAX = 50;
export const ID_MAX = 80;
const DAYS_MAX = 3650;

// A refusal thrown inside the walk and caught at its top, so each check is one line.
export class Refused extends Error {
  readonly refusal: RuleRefusal;
  constructor(refusal: RuleRefusal) {
    super(refusal.message);
    this.refusal = refusal;
  }
}
export const refuse = (path: string, message: string): never => {
  throw new Refused({ error: 'automation_invalid', path, message });
};
export const unsupported = (
  error: 'automation_condition_unsupported' | 'automation_step_unsupported',
  path: string,
  message: string,
): never => {
  throw new Refused({ error, path, message });
};

export type Obj = Record<string, unknown>;
export const isObj = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const obj = (v: unknown, path: string): Obj =>
  isObj(v) ? v : refuse(path, `${path} must be an object`);

export const id = (v: unknown, path: string): string =>
  typeof v === 'string' && v.length > 0 && v.length <= ID_MAX
    ? v
    : refuse(path, `${path} must name one`);

export function ids(v: unknown, path: string, opts: { min?: number } = {}): string[] {
  if (!Array.isArray(v) || v.length < (opts.min ?? 0) || v.length > AUTOMATION_LIST_MAX)
    refuse(path, `${path} must be a list of ${opts.min ?? 0} to ${AUTOMATION_LIST_MAX}`);
  return [...new Set((v as unknown[]).map((x, i) => id(x, `${path}.${i}`)))];
}

export const optionalIds = (v: unknown, path: string) =>
  v === undefined ? undefined : ids(v, path);

// Text a rule writes: within its bound, every value one the builder knows (a branch's knows the triggering card's).
export function text(
  v: unknown,
  path: string,
  max: number,
  opts: { empty?: boolean } & ValuePlace = {},
): string {
  if (typeof v !== 'string' || v.length > max || (!opts.empty && v.trim() === ''))
    refuse(path, `${path} must be text of ${opts.empty ? 'up to' : '1 to'} ${max} characters`);
  const unknown = unknownValueIn(v as string, opts);
  if (unknown !== null)
    throw new Refused({
      error: 'automation_value_unknown',
      path,
      message: `{{${unknown}}} is not a value`,
    });
  return v as string;
}

export const not = (v: unknown, path: string): { not?: true } =>
  v === undefined || v === false
    ? {}
    : v === true
      ? { not: true }
      : refuse(path, `${path} must be true`);

export function day(v: unknown, path: string): AutomationDay {
  const o = obj(v, path);
  if (typeof o['day'] === 'string' && isDay(o['day'])) return { day: o['day'] };
  const n = o['today'];
  if (typeof n === 'number' && Number.isInteger(n) && Math.abs(n) <= DAYS_MAX) return { today: n };
  return refuse(path, `${path} must be a day or today ± days`);
}

export function clock(v: unknown, path: string): string {
  if (clockMinutes(v) === null)
    refuse(path, `${path} must be a time on the quarter hour, as 09:15`);
  return v as string;
}

export const whole = (v: unknown, path: string, min: number, max: number): number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max
    ? (v as number)
    : refuse(path, `${path} must be a whole number from ${min} to ${max}`);
