// Formula functions (docs/specs/026-plan/item-types.md "Formula fields", Functions): the fixed set, each with how
// many values it takes and how it works them out. Each takes its values unworked, so if(), and() and or() work out
// only what they need.
import { FORMULA_ROUND_PLACES_MAX } from './limits';
import type { FormulaNode } from './parse';
import {
  fail,
  isDate,
  isList,
  kindName,
  single,
  toNumber,
  toText,
  truthy,
  type FormulaDate,
  type FormulaValue,
} from './values';

export interface FunctionEnv {
  // Works a value out.
  run: (node: FormulaNode) => FormulaValue;
  // Today, as a date.
  today: () => FormulaDate;
}

interface FunctionDef {
  min: number;
  max: number;
  call: (args: readonly FormulaNode[], env: FunctionEnv) => FormulaValue;
}

const MANY = 64;

// The smallest or largest of numbers, or of dates; blanks are skipped, and all blank is blank.
function extreme(args: readonly FormulaNode[], env: FunctionEnv, pick: 1 | -1): FormulaValue {
  let best: number | null = null;
  let dates: boolean | null = null;
  for (const a of args) {
    const v = single(env.run(a));
    if (v === null) continue;
    const date = isDate(v);
    if (dates !== null && dates !== date) fail('min and max compare numbers or dates, not both');
    dates = date;
    const n = date ? v.day : toNumber(v);
    if (best === null || (n - best) * pick > 0) best = n;
  }
  if (best === null) return null;
  return dates ? { day: best } : best;
}

function round(args: readonly FormulaNode[], env: FunctionEnv): FormulaValue {
  const x = toNumber(env.run(args[0]!));
  const places = args[1] ? toNumber(env.run(args[1])) : 0;
  if (!Number.isInteger(places) || places < 0 || places > FORMULA_ROUND_PLACES_MAX)
    fail(`round's places are 0 to ${FORMULA_ROUND_PLACES_MAX}`);
  const f = 10 ** places;
  // Half away from zero, as people round money (-2.5 is -3); nudged by one part in 2^52 so 1.005 rounds to 1.01.
  const r = (Math.sign(x) * Math.round(Math.abs(x) * f * (1 + Number.EPSILON))) / f;
  // A number too large to scale has no fraction left to round.
  return Number.isFinite(r) ? r : x;
}

export const FUNCTIONS = {
  round: { min: 1, max: 2, call: round },
  min: { min: 1, max: MANY, call: (args, env) => extreme(args, env, -1) },
  max: { min: 1, max: MANY, call: (args, env) => extreme(args, env, 1) },
  abs: { min: 1, max: 1, call: (args, env) => Math.abs(toNumber(env.run(args[0]!))) },
  if: {
    min: 2,
    max: 3,
    call: (args, env) =>
      truthy(env.run(args[0]!)) ? env.run(args[1]!) : args[2] ? env.run(args[2]) : null,
  },
  and: { min: 1, max: MANY, call: (args, env) => args.every((a) => truthy(env.run(a))) },
  or: { min: 1, max: MANY, call: (args, env) => args.some((a) => truthy(env.run(a))) },
  not: { min: 1, max: 1, call: (args, env) => !truthy(env.run(args[0]!)) },
  days: {
    min: 1,
    max: 1,
    call: (args, env) => {
      const v = single(env.run(args[0]!));
      if (v === null) return null;
      if (isDate(v)) return v.day - env.today().day;
      return toNumber(v);
    },
  },
  today: { min: 0, max: 0, call: (_args, env) => env.today() },
  concat: {
    min: 1,
    max: MANY,
    call: (args, env) => args.map((a) => toText(env.run(a))).join(''),
  },
  len: {
    min: 1,
    max: 1,
    call: (args, env) => {
      const v = env.run(args[0]!);
      if (v === null) return 0;
      if (isList(v)) return v.list.length;
      if (typeof v === 'string') return [...v].length;
      return fail(`len counts a list or text, not ${kindName(v)}`);
    },
  },
} satisfies Record<string, FunctionDef>;

export type FunctionName = keyof typeof FUNCTIONS;
export const FUNCTION_NAMES = Object.keys(FUNCTIONS) as FunctionName[];

// A function by the name written, ignoring case.
export function functionNamed(name: string): FunctionName | undefined {
  const key = name.toLowerCase();
  return Object.hasOwn(FUNCTIONS, key) ? (key as FunctionName) : undefined;
}

// How many values a function takes, in words: "1 value", "1 or 2 values", "1 to 64 values", "no values".
export function arityText(fn: FunctionName): string {
  const { min, max } = FUNCTIONS[fn];
  const values = (n: number) => `${n} value${n === 1 ? '' : 's'}`;
  if (max === 0) return 'no values';
  if (min === max) return values(min);
  return `${min} ${max === min + 1 ? 'or' : 'to'} ${values(max)}`;
}
